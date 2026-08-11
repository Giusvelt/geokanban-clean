-- =====================================================
-- MIGRATION 010: Vessel Operational DNA (The Rail System)
-- =====================================================

-- 1. Link Vessels to their standard sites
ALTER TABLE public.vessels ADD COLUMN IF NOT EXISTS default_loading_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL;
ALTER TABLE public.vessels ADD COLUMN IF NOT EXISTS default_base_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL;

-- 2. Daily Assignments table (The only manual input needed)
CREATE TABLE IF NOT EXISTS public.daily_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    unloading_geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vessel_id, assignment_date)
);

-- 3. Comments for clarity
COMMENT ON TABLE public.daily_assignments IS 'Daily target for vessels. Defines which unloading site the vessel is working on for a specific day.';
COMMENT ON COLUMN public.vessels.default_loading_id IS 'Standard loading site for the vessel route (The Rail Start).';
COMMENT ON COLUMN public.vessels.default_base_id IS 'Standard base/night mooring for the vessel (The Rail End/Rest).';

-- 4. Enable RLS
ALTER TABLE daily_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to daily_assignments" ON daily_assignments FOR ALL USING (true);
