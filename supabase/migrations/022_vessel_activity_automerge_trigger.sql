-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.3.2 — Auto-Merge Trigger & Temporal Integrity
-- ═══════════════════════════════════════════════════════════════

-- 1. Funzione per il merge automatico di attività consecutive identiche
CREATE OR REPLACE FUNCTION public.auto_merge_vessel_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_id UUID;
    v_prev_end TIMESTAMPTZ;
    v_merge_interval INTERVAL := '15 minutes';
BEGIN
    -- Solo per attività completate
    IF NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    -- Se è una Navigation, cerchiamo se c'è una Navigation precedente vicina
    IF NEW.activity_type = 'Navigation' THEN
        SELECT id, end_time INTO v_prev_id, v_prev_end
        FROM public.vessel_activity
        WHERE vessel_id = NEW.vessel_id
          AND activity_type = 'Navigation'
          AND status = 'completed'
          AND id != NEW.id
          AND end_time <= NEW.start_time
          AND NEW.start_time - end_time < v_merge_interval
        ORDER BY end_time DESC LIMIT 1;

        IF v_prev_id IS NOT NULL THEN
            -- TRASFERIMENTO DATI PRIMA DELLA CANCELLAZIONE
            UPDATE public.activity_messages SET vessel_activity_id = v_prev_id WHERE vessel_activity_id = NEW.id;
            UPDATE public.logbook_entries SET vessel_activity_id = v_prev_id WHERE vessel_activity_id = NEW.id
               AND NOT EXISTS (SELECT 1 FROM public.logbook_entries WHERE vessel_activity_id = v_prev_id);
            
            UPDATE public.vessel_activity SET end_time = NEW.end_time WHERE id = v_prev_id;
            
            -- Cancelliamo la nuova riga ridondante
            DELETE FROM public.vessel_activity WHERE id = NEW.id;
            RETURN NULL;
        END IF;
    END IF;

    -- Per Loading/Unloading usiamo un intervallo più lungo (45 min) e lo stesso geofence
    IF NEW.activity_type IN ('Loading', 'Unloading') AND NEW.geofence_id IS NOT NULL THEN
        SELECT id, end_time INTO v_prev_id, v_prev_end
        FROM public.vessel_activity
        WHERE vessel_id = NEW.vessel_id
          AND activity_type = NEW.activity_type
          AND geofence_id = NEW.geofence_id
          AND status = 'completed'
          AND id != NEW.id
          AND end_time <= NEW.start_time
          AND NEW.start_time - end_time < interval '45 minutes'
        ORDER BY end_time DESC LIMIT 1;

        IF v_prev_id IS NOT NULL THEN
            UPDATE public.activity_messages SET vessel_activity_id = v_prev_id WHERE vessel_activity_id = NEW.id;
            UPDATE public.logbook_entries SET vessel_activity_id = v_prev_id WHERE vessel_activity_id = NEW.id
               AND NOT EXISTS (SELECT 1 FROM public.logbook_entries WHERE vessel_activity_id = v_prev_id);
            
            UPDATE public.vessel_activity SET end_time = NEW.end_time WHERE id = v_prev_id;
            DELETE FROM public.vessel_activity WHERE id = NEW.id;
            RETURN NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger AFTER UPDATE (per quando viene chiusa un'attività) e AFTER INSERT
DROP TRIGGER IF EXISTS tr_auto_merge_activity ON public.vessel_activity;
CREATE TRIGGER tr_auto_merge_activity
AFTER INSERT OR UPDATE OF status, end_time ON public.vessel_activity
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.auto_merge_vessel_activity();
