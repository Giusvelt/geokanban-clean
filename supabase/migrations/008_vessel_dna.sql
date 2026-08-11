-- =====================================================
-- MIGRATION 008: Vessel Lifetime Stats & DNA
-- =====================================================

-- 1. Add Lifetime Trips to Vessels
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS lifetime_trips INTEGER DEFAULT 0;
COMMENT ON COLUMN vessels.lifetime_trips IS 'Cumulative number of completed trips across all periods.';

-- 2. Add DNA/Rail fields to Vessels (The recurring frequency pattern)
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS source_geofence_id UUID REFERENCES geofences(id);
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS destination_geofence_id UUID REFERENCES geofences(id);
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS standard_cycle_hours NUMERIC DEFAULT 24;
COMMENT ON COLUMN vessels.standard_cycle_hours IS 'Standard time for one complete cycle (Loading -> Unloading -> Return).';

-- 3. Function to auto-increment lifetime_trips and update production plans
-- This can be called when a "Scarico" (Unloading) milestone is completed.
CREATE OR REPLACE FUNCTION handle_trip_completion() 
RETURNS TRIGGER AS $$
DECLARE
    v_avg_cargo NUMERIC;
    v_period TEXT;
BEGIN
    -- Check if it just became 'completed' and it was an unloading activity
    -- (We assume ONE trip = ONE unloading event completed)
    IF (NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.activity ILIKE '%Scarico%') THEN
        
        -- 1. Increment Lifetime Trips
        UPDATE vessels SET lifetime_trips = lifetime_trips + 1 WHERE id = NEW.vessel_id;
        
        -- 2. Update Production Plan for the current period
        v_period := to_char(NEW.actual_exit, 'Month YYYY'); -- Format matches period_name logic
        
        SELECT avg_cargo INTO v_avg_cargo FROM vessels WHERE id = NEW.vessel_id;
        
        -- Upsert/Update the actuals in production_plans
        INSERT INTO production_plans (vessel_id, period_name, actual_trips, actual_quantity)
        VALUES (NEW.vessel_id, v_period, 1, NEW.quantity)
        ON CONFLICT (vessel_id, period_name) DO UPDATE SET
            actual_trips = production_plans.actual_trips + 1,
            actual_quantity = production_plans.actual_quantity + EXCLUDED.actual_quantity,
            updated_at = NOW();
            
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger on milestones
DROP TRIGGER IF EXISTS tr_milestones_trip_completion ON milestones;
CREATE TRIGGER tr_milestones_trip_completion
    AFTER UPDATE ON milestones
    FOR EACH ROW
    EXECUTE FUNCTION handle_trip_completion();
