ALTER TABLE vessels ADD COLUMN IF NOT EXISTS default_unloading_id UUID REFERENCES geofences(id) ON DELETE SET NULL;

COMMENT ON COLUMN vessels.default_unloading_id IS 'Standard unloading site (geofence) assigned to this vessel for automated logic';
