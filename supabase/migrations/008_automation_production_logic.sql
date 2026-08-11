-- =====================================================
-- MIGRATION 008: Automatic Production Consumption Logic
-- =====================================================

-- 1. Function to process milestone completion and update production totals
CREATE OR REPLACE FUNCTION public.sync_milestone_to_production()
RETURNS TRIGGER AS $$
DECLARE
    v_avg_cargo NUMERIC;
    v_period TEXT;
BEGIN
    -- Only trigger when milestone is marked COMPLETED
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- Get the vessel's average cargo capacity
        SELECT avg_cargo INTO v_avg_cargo FROM public.vessels WHERE id = NEW.vessel_id;
        
        -- Determine the current period (simplified for now: Month Year)
        v_period := to_char(NEW.actual_exit, 'Month YYYY');
        
        -- Update the matching production plan (if one exists for this vessel/period)
        UPDATE public.production_plans
        SET 
            actual_trips = actual_trips + 1,
            actual_quantity = actual_quantity + COALESCE(v_avg_cargo, 0),
            updated_at = NOW()
        WHERE vessel_id = NEW.vessel_id 
          AND status = 'active'; 
          -- Note: We use 'active' status instead of exact period matching to allow flexibility
          -- if the user hasn't exactly matched the period string.

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS tr_sync_production_on_completion ON public.milestones;
CREATE TRIGGER tr_sync_production_on_completion
    AFTER UPDATE ON public.milestones
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_milestone_to_production();

-- 3. Add comment
COMMENT ON FUNCTION public.sync_milestone_to_production IS 'Automates the decurtamento logic: increments production plan actuals when a vessel completes a milestone.';
