-- =====================================================
-- MIGRATION 013: Fix Automatic Trip Counter & Logging
-- =====================================================

-- 1. Create logs table for trip increments
CREATE TABLE IF NOT EXISTS public.production_plans_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Improve the trigger function to use Radius-based detection
CREATE OR REPLACE FUNCTION public.track_production_on_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_geofence_id UUID;
    v_geofence_nature TEXT;
    v_vessel_avg_cargo NUMERIC;
    v_plan_id UUID;
BEGIN
    -- 1. Find the geofence we are currently inside (using radius)
    -- We use ST_DWithin for circular check based on geofence.radius
    SELECT id, nature INTO v_geofence_id, v_geofence_nature
    FROM public.geofences
    WHERE ST_DWithin(
        ST_SetSRID(ST_Point(lon, lat), 4326)::geography,
        ST_SetSRID(ST_Point(NEW.lon, NEW.lat), 4326)::geography,
        radius
    )
    LIMIT 1;

    -- 2. If we are in an UNLOADING SITE
    IF v_geofence_nature = 'unloading_site' THEN
        
        -- Debounce: Check if we already registered a trip for this vessel in the last 4 hours
        IF NOT EXISTS (
            SELECT 1 FROM public.production_plans_logs 
            WHERE vessel_id = NEW.vessel_id 
            AND action = 'trip_increment'
            AND created_at > (NOW() - INTERVAL '4 hours')
        ) THEN
            
            -- Find the active plan for this vessel
            v_plan_id := public.get_active_production_plan(NEW.vessel_id);
            
            IF v_plan_id IS NOT NULL THEN
                -- Get vessel cargo capacity
                SELECT avg_cargo INTO v_vessel_avg_cargo FROM public.vessels WHERE id = NEW.vessel_id;

                -- 3. Increment Trip & Quantity
                UPDATE public.production_plans
                SET 
                    actual_trips = actual_trips + 1,
                    actual_quantity = actual_quantity + COALESCE(v_vessel_avg_cargo, 0),
                    updated_at = NOW()
                WHERE id = v_plan_id;

                -- 4. Log the success to fulfill debounce requirement
                INSERT INTO public.production_plans_logs (vessel_id, action)
                VALUES (NEW.vessel_id, 'trip_increment');
                
                -- Support real-time updates: Notify after modification
                -- (Supabase handles this automatically if RLS allows and clients are subscribed)
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ACTIVATE THE TRIGGER
DROP TRIGGER IF EXISTS tr_track_production ON public.vessel_tracking;
CREATE TRIGGER tr_track_production
    AFTER INSERT ON public.vessel_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.track_production_on_entry();

COMMENT ON FUNCTION public.track_production_on_entry IS 'Automates trip counting: detect geofence entry, debounce, and increment production plan';
