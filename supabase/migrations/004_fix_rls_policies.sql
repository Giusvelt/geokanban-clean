-- =====================================================
-- MIGRATION 004: Fix RLS Policies (Missing DELETE)
-- =====================================================

-- 1. FIX MILESTONES
-- Aggiungi policy per la cancellazione (mancava del tutto)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'milestones' AND policyname = 'Auth Delete Milestones'
    ) THEN
        CREATE POLICY "Auth Delete Milestones" ON milestones FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
    END IF;
END $$;

-- 2. FIX GEOFENCES
-- Aggiungi policy per la cancellazione
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'geofences' AND policyname = 'Auth Delete Geofences'
    ) THEN
        CREATE POLICY "Auth Delete Geofences" ON geofences FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
    END IF;
END $$;

-- 3. FIX VESSELS
-- Assicuriamoci che RLS sia attivo e ci siano le policy base
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vessels' AND policyname = 'Public Read Vessels') THEN
        CREATE POLICY "Public Read Vessels" ON vessels FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vessels' AND policyname = 'Auth Insert Vessels') THEN
        CREATE POLICY "Auth Insert Vessels" ON vessels FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vessels' AND policyname = 'Auth Update Vessels') THEN
        CREATE POLICY "Auth Update Vessels" ON vessels FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vessels' AND policyname = 'Auth Delete Vessels') THEN
        CREATE POLICY "Auth Delete Vessels" ON vessels FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
    END IF;
END $$;
