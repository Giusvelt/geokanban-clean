-- =====================================================
-- MIGRATION 009: Deterministic Navigation Metadata
-- =====================================================

-- 1. Metadata for Vessels (Deterministic habits)
ALTER TABLE public.vessels ADD COLUMN IF NOT EXISTS habits_sequence TEXT;
COMMENT ON COLUMN public.vessels.habits_sequence IS 'Comma-separated list of standard activities/geofences for automation logic.';

-- 2. Metadata for Geofences (Operational Classification)
ALTER TABLE public.geofences ADD COLUMN IF NOT EXISTS nature TEXT DEFAULT 'general' CHECK (nature IN ('general', 'loading_site', 'unloading_site', 'base_port'));
ALTER TABLE public.geofences ADD COLUMN IF NOT EXISTS associated_activity TEXT; -- Default activity for this site

COMMENT ON COLUMN public.geofences.nature IS 'The operational purpose of this geofence (Cava, Cantiere, Porto).';
COMMENT ON COLUMN public.geofences.associated_activity IS 'The default activity name to trigger when a vessel enters this geofence.';

-- 3. Additional fields for Milestones (Deterministic Tracking)
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.milestones.quantity IS 'Volume or tonnage assigned to this specific operation.';
COMMENT ON COLUMN public.milestones.notes IS 'Contextual notes for the operation (manual or system generated).';
