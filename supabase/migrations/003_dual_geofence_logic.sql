-- =====================================================
-- MIGRATION 003: Aggiornamento Doppio Geofence (From/To)
-- =====================================================

-- 1. Modifica la tabella milestones
-- Rimuoviamo la colonna singola 'geofence_id' e aggiungiamo 'from' e 'to'
ALTER TABLE milestones DROP COLUMN IF EXISTS geofence_id;

ALTER TABLE milestones 
ADd COLUMN IF NOT EXISTS geofence_from_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS geofence_to_id UUID REFERENCES geofences(id) ON DELETE SET NULL;

-- 2. Aggiorna i commenti per chiarezza
COMMENT ON COLUMN milestones.geofence_from_id IS 'Geofence di inizio attività (es. Entrata in zona scarico, o Partenza da ancoraggio)';
COMMENT ON COLUMN milestones.geofence_to_id IS 'Geofence di fine attività (es. Uscita da zona scarico, o Arrivo in porto)';
COMMENT ON TABLE milestones IS 'Programma lavori. Se From=To, è un''attività di stazionamento (es. scarico). Se From!=To, è un movimento.';

-- 3. (Opzionale) Pulisci i dati vecchi se inconsistenti
-- TRUNCATE milestones;
