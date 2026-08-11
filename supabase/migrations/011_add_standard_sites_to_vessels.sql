-- Add standard loading and base sites to vessels
ALTER TABLE vessels 
ADD COLUMN IF NOT EXISTS default_loading_id UUID REFERENCES geofences(id),
ADD COLUMN IF NOT EXISTS default_base_id UUID REFERENCES geofences(id);

-- Add comments for documentation
COMMENT ON COLUMN vessels.default_loading_id IS 'Standard loading site (quarry/banhina) for this vessel';
COMMENT ON COLUMN vessels.default_base_id IS 'Standard base port or berth for this vessel';
