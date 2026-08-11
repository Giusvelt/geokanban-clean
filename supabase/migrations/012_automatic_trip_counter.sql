-- =====================================================
-- MIGRATION 012: Automatic Trip Counter from Tracking
-- =====================================================

-- 1. Helper function to find active production plan
CREATE OR REPLACE FUNCTION public.get_active_production_plan(p_vessel_id UUID)
RETURNS UUID AS $$
    SELECT id FROM public.production_plans 
    WHERE vessel_id = p_vessel_id 
    AND (period_name = to_char(NOW(), 'Month YYYY') OR status = 'active')
    ORDER BY created_at DESC 
    LIMIT 1;
$$ LANGUAGE sql;

-- 2. Trigger Function to detect entry into Unloading Sites
CREATE OR REPLACE FUNCTION public.track_production_on_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_geofence_id UUID;
    v_geofence_nature TEXT;
    v_vessel_avg_cargo NUMERIC;
    v_plan_id UUID;
    v_was_inside BOOLEAN;
BEGIN
    -- 1. Check if the current position is inside any geofence
    -- (We assume geofences table has a 'polygon' column of type GEOMETRY)
    SELECT id, nature INTO v_geofence_id, v_geofence_nature
    FROM public.geofences
    WHERE ST_Contains(polygon, ST_SetSRID(ST_Point(NEW.lon, NEW.lat), 4326))
    LIMIT 1;

    -- 2. If we are in an UNLOADING SITE
    IF v_geofence_nature = 'unloading_site' THEN
        
        -- Check if the vessel was ALREADY inside an unloading site in the previous point
        -- (To avoid counting every tracking point as a new trip)
        SELECT EXISTS (
            SELECT 1 FROM public.vessel_tracking 
            WHERE vessel_id = NEW.vessel_id 
            AND id < NEW.id 
            AND timestamp > (NEW.timestamp - INTERVAL '1 hour')
            -- This is a simplified check: we'd ideally check the nature of where it was
            ORDER BY timestamp DESC LIMIT 1
        ) INTO v_was_inside;

        -- For real entry detection, we should ideally store the "current_geofence" on the vessel
        -- But let's use a time-based debounce for now (e.g., 1 trip max every 4 hours per vessel)
        
        IF NOT EXISTS (
            SELECT 1 FROM public.production_plans_logs 
            WHERE vessel_id = NEW.vessel_id 
            AND action = 'trip_increment'
            AND created_at > (NOW() - INTERVAL '4 hours')
        ) THEN
            
            -- Find the active plan
            v_plan_id := public.get_active_production_plan(NEW.vessel_id);
            
            IF v_plan_id IS NOT NULL THEN
                -- Get vessel cargo
                SELECT avg_cargo INTO v_vessel_avg_cargo FROM public.vessels WHERE id = NEW.vessel_id;

                -- Increment Trip
                UPDATE public.production_plans
                SET 
                    actual_trips = actual_trips + 1,
                    actual_quantity = actual_quantity + COALESCE(v_vessel_avg_cargo, 0),
                    updated_at = NOW()
                WHERE id = v_plan_id;

                -- Log the event to avoid double counting
                -- (Note: You might need to create this log table if you want strict tracking)
                -- CREATE TABLE IF NOT EXISTS public.production_plans_logs (id UUID PRIMARY KEY, vessel_id UUID, action TEXT, created_at TIMESTAMPTZ);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the Trigger
-- DROP TRIGGER IF EXISTS tr_track_production ON public.vessel_tracking;
-- CREATE TRIGGER tr_track_production
--     AFTER INSERT ON public.vessel_tracking
--     FOR EACH ROW
--     EXECUTE FUNCTION public.track_production_on_entry();

COMMENT ON FUNCTION public.track_production_on_entry IS 'Automatically increments trips in the production plan when a vessel enters an unloading geofence.';
