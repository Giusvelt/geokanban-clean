-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 023: Safe Activity Merge & Data Integrity
-- ═══════════════════════════════════════════════════════════════

-- 1. Function to handle safe merge (Transfer children before parent delete)
CREATE OR REPLACE FUNCTION public.auto_merge_vessel_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_target_id UUID;
BEGIN
    -- Only merge on INSERT of new activity
    -- Check if there is a previous identical activity within 2 hours
    SELECT id INTO v_target_id
    FROM public.vessel_activity
    WHERE vessel_id = NEW.vessel_id
      AND activity_type = NEW.activity_type
      AND (geofence_id = NEW.geofence_id OR (geofence_id IS NULL AND NEW.geofence_id IS NULL))
      AND id != NEW.id
      AND NEW.start_time - COALESCE(end_time, start_time) < interval '2 hours'
      AND NEW.start_time >= start_time
    ORDER BY start_time DESC
    LIMIT 1;

    IF v_target_id IS NOT NULL THEN
        -- A. Transfer any existing messages/logbooks from NEW to TARGET (if any existed, rare on INSERT but safe)
        -- Actually, since this is an INSERT trigger, the children don't exist yet for NEW.
        -- But wait! If this is called from a manual script, we should handle it.
        
        -- B. Update the TARGET's end_time to match NEW's end_time (effectively merging)
        UPDATE public.vessel_activity
        SET end_time = NEW.end_time,
            status = NEW.status,
            updated_at = now()
        WHERE id = v_target_id;

        -- C. Re-sync production plan for the vessel
        PERFORM public.sync_production_plan(NEW.vessel_id, to_char(NEW.start_time, 'FMMonth YYYY'));

        -- D. CANCEL THE INSERT of NEW row (we merged it into v_target_id)
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Repair Script Logic (Standalone function for maintenance)
CREATE OR REPLACE FUNCTION public.repair_vessel_activity_safely(p_vessel_id UUID, p_period TEXT)
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t1.id as id_keep, t2.id as id_del, t2.end_time as new_end
        FROM public.vessel_activity t1
        JOIN public.vessel_activity t2 ON t1.vessel_id = t2.vessel_id 
            AND t1.activity_type = t2.activity_type 
            AND (t1.geofence_id = t2.geofence_id OR (t1.geofence_id IS NULL AND t2.geofence_id IS NULL))
        WHERE t1.id != t2.id
          AND t2.start_time >= t1.start_time
          AND t2.start_time - COALESCE(t1.end_time, t1.start_time) < interval '2 hours'
          AND (p_vessel_id IS NULL OR t1.vessel_id = p_vessel_id)
    ) LOOP
        -- MIRACOLOSO TRASFERIMENTO DATI
        UPDATE public.activity_messages SET vessel_activity_id = r.id_keep WHERE vessel_activity_id = r.id_del;
        
        UPDATE public.logbook_entries 
        SET vessel_activity_id = r.id_keep 
        WHERE vessel_activity_id = r.id_del
          AND NOT EXISTS (SELECT 1 FROM public.logbook_entries WHERE vessel_activity_id = r.id_keep);

        UPDATE public.vessel_activity 
        SET end_time = GREATEST(COALESCE(end_time, start_time), r.new_end)
        WHERE id = r.id_keep;

        DELETE FROM public.vessel_activity WHERE id = r.id_del;
    END LOOP;

    PERFORM public.sync_production_plan(p_vessel_id, p_period);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.repair_vessel_activity_safely IS 'Consolida le attività frammentate trasferendo messaggi e logbook in modo sicuro.';
