-- =====================================================
-- MIGRATION 002: Geofences e Milestones (Work Program)
-- =====================================================

-- 1. TABELLA GEOFENCES (Aree Geografiche)
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- Unique Name
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    radius INTEGER NOT NULL DEFAULT 500, -- Raggio in metri (default 500m)
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Abilita RLS per Geofences
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Geofences" ON geofences FOR SELECT USING (true);
CREATE POLICY "Auth Insert Geofences" ON geofences FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Auth Update Geofences" ON geofences FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');


-- Dati iniziali Geofences (Seed)
INSERT INTO geofences (name, lat, lon, radius, color) VALUES
    ('Zona Ancoraggio', 44.3500, 8.9500, 1000, '#3b82f6'),
    ('Banchina Ovest', 44.4063, 8.9463, 300, '#10b981'),
    ('Banchina Est', 44.3800, 9.0200, 300, '#14b8a6'),
    ('Canale Manovra', 44.3300, 9.1500, 800, '#f59e0b'),
    ('Unload Alpha', 44.2500, 9.0000, 500, '#06b6d4')
ON CONFLICT (name) DO NOTHING;

-- 2. TABELLA MILESTONES (Work Program)
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Vessel (Foreign Key)
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE NOT NULL,
    
    -- Geofence (Foreign Key - Opzionale, se l'attività è legata a una zona)
    geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
    
    -- Dettagli attività
    activity TEXT NOT NULL, -- Es: "Arrivo", "Carico", "Partenza"
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
    
    -- Date Pianificate (Work Program Planned)
    planned_entry TIMESTAMPTZ NOT NULL,
    planned_exit TIMESTAMPTZ,
    
    -- Date Effettive (Work Program Actual - popolate da logica PostGIS/Client)
    actual_entry TIMESTAMPTZ,
    actual_exit TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Abilita RLS per Milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Milestones" ON milestones FOR SELECT USING (true);
CREATE POLICY "Auth Insert Milestones" ON milestones FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Auth Update Milestones" ON milestones FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Indici per performance
CREATE INDEX IF NOT EXISTS milestones_vessel_idx ON milestones(vessel_id);
CREATE INDEX IF NOT EXISTS milestones_status_idx ON milestones(status);
CREATE INDEX IF NOT EXISTS milestones_planned_entry_idx ON milestones(planned_entry);

-- Commenti
COMMENT ON TABLE milestones IS 'Programma di lavoro (Planned vs Actual). Le date Actual vengono aggiornate quando la nave entra nel geofence.';
