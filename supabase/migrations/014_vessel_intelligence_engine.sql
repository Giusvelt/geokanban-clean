-- =====================================================
-- MIGRATION 014: Vessel Intelligence Engine (Deterministic)
-- =====================================================

-- 1. Ensure Geofence Nature exists
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS nature TEXT DEFAULT 'general';
COMMENT ON COLUMN geofences.nature IS 'quarry, unloading_site, base_port, roadstead, general';

-- 2. State tracking for the detection engine
CREATE TABLE IF NOT EXISTS vessel_geofence_status (
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    geofence_id UUID REFERENCES geofences(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'outside', -- inside, outside
    current_activity TEXT,         -- mooring, loading, unloading
    entered_at TIMESTAMPTZ,
    last_transition_at TIMESTAMPTZ DEFAULT NOW(),
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (vessel_id, geofence_id)
);

-- 3. Configuration table for the engine thresholds (The "DNA" of the logic)
CREATE TABLE IF NOT EXISTS intelligence_config (
    key TEXT PRIMARY KEY,
    value_minutes INTEGER,
    description TEXT
);

INSERT INTO intelligence_config (key, value_minutes, description) VALUES
    ('quarry_loading_threshold', 40, 'Minuti di sosta in cava per passare da Mooring a Loading'),
    ('unloading_site_threshold', 20, 'Minuti di sosta in sito scarico per passare da Mooring a Unloading')
ON CONFLICT (key) DO UPDATE SET value_minutes = EXCLUDED.value_minutes;

-- 4. Add 'DUMMY' column for automated vs manual milestones
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT false;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS detection_confidence NUMERIC DEFAULT 1.0;
