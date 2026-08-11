-- =====================================================
-- MIGRATION 005: Milestone Messages
-- =====================================================

-- 1. TABELLA MESSAGGI
CREATE TABLE IF NOT EXISTS milestone_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE NOT NULL,
    sender TEXT NOT NULL, -- Es: 'Crew', 'Office', 'System'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. ABILITA RLS
ALTER TABLE milestone_messages ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES
-- Lettura: Tutti possono leggere (Auth + Anon)
CREATE POLICY "Public Read Messages" ON milestone_messages FOR SELECT USING (true);

-- Scrittura: Tutti possono scrivere (Auth + Anon)
CREATE POLICY "Public Insert Messages" ON milestone_messages FOR INSERT WITH CHECK (true);

-- 4. INDICI
CREATE INDEX IF NOT EXISTS milestone_messages_milestone_id_idx ON milestone_messages(milestone_id);

-- 5. COMMENTI
COMMENT ON TABLE milestone_messages IS 'Messaggi scambiati dal crew/office relativi a una specifica milestone.';
