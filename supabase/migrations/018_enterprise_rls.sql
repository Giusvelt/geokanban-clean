-- =====================================================
-- MIGRATION 018: Enterprise RLS (Isolamento Crew/Admin)
-- =====================================================

-- 1. SICUREZZA VESSEL_ACTIVITY
ALTER TABLE vessel_activity ENABLE ROW LEVEL SECURITY;

-- 1.1 Elimina le vecchie "Public / Authenticated" policies (se c'erano)
DROP POLICY IF EXISTS "Public Read Vessel Activity" ON vessel_activity;
DROP POLICY IF EXISTS "Auth Insert Vessel Activity" ON vessel_activity;
DROP POLICY IF EXISTS "Auth Update Vessel Activity" ON vessel_activity;
DROP POLICY IF EXISTS "Auth Delete Vessel Activity" ON vessel_activity;
-- Copertura eventuale di defaults standard:
DROP POLICY IF EXISTS "Enable read access for all users" ON vessel_activity;
DROP POLICY IF EXISTS "Enable insert access for all users" ON vessel_activity;
DROP POLICY IF EXISTS "Enable update access for all users" ON vessel_activity;
DROP POLICY IF EXISTS "Enable delete access for all users" ON vessel_activity;

-- 1.2 Policy per ADMIN (Tutto permesso)
CREATE POLICY "Admins_vessel_activity_all"
  ON vessel_activity FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('operation_admin', 'operation'))
  );

-- 1.3 Policy per CREW_ADMIN (Solo le navi della loro flotta / company)
CREATE POLICY "CrewAdmins_vessel_activity_all"
  ON vessel_activity FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN vessels v ON v.company_id = up.company_id
      WHERE up.id = auth.uid() AND up.role = 'crew_admin' AND v.id = vessel_activity.vessel_id
    )
  );

-- 1.4 Policy per CREW (Solo propria nave: Select e Update)
CREATE POLICY "Crew_vessel_activity_select"
  ON vessel_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      WHERE up.id = auth.uid() AND up.role = 'crew' AND v.id = vessel_activity.vessel_id
    )
  );

CREATE POLICY "Crew_vessel_activity_update"
  ON vessel_activity FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      WHERE up.id = auth.uid() AND up.role = 'crew' AND v.id = vessel_activity.vessel_id
    )
  );


-- =====================================================
-- 2. SICUREZZA LOGBOOK_ENTRIES
-- =====================================================
ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON logbook_entries;
DROP POLICY IF EXISTS "Enable insert access for all users" ON logbook_entries;
DROP POLICY IF EXISTS "Enable update access for all users" ON logbook_entries;
DROP POLICY IF EXISTS "Enable delete access for all users" ON logbook_entries;

CREATE POLICY "Admins_logbook_entries_all"
  ON logbook_entries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('operation_admin', 'operation'))
  );

CREATE POLICY "CrewAdmins_logbook_entries_all"
  ON logbook_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN vessels v ON v.company_id = up.company_id
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew_admin' AND va.id = logbook_entries.vessel_activity_id
    )
  );

CREATE POLICY "Crew_logbook_entries_select"
  ON logbook_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew' AND va.id = logbook_entries.vessel_activity_id
    )
  );

CREATE POLICY "Crew_logbook_entries_insert"
  ON logbook_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew' AND va.id = vessel_activity_id
    )
  );

CREATE POLICY "Crew_logbook_entries_update"
  ON logbook_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew' AND va.id = logbook_entries.vessel_activity_id
    )
  );


-- =====================================================
-- 3. SICUREZZA ACTIVITY_MESSAGES
-- =====================================================
ALTER TABLE activity_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON activity_messages;
DROP POLICY IF EXISTS "Enable insert access for all users" ON activity_messages;
DROP POLICY IF EXISTS "Enable update access for all users" ON activity_messages;
DROP POLICY IF EXISTS "Enable delete access for all users" ON activity_messages;

CREATE POLICY "Admins_activity_messages_all"
  ON activity_messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('operation_admin', 'operation'))
  );

CREATE POLICY "Crew_activity_messages_select"
  ON activity_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew' AND va.id = activity_messages.vessel_activity_id
    )
  );

CREATE POLICY "Crew_activity_messages_insert"
  ON activity_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew' AND va.id = vessel_activity_id
    )
  );

CREATE POLICY "Crew_activity_messages_update"
  ON activity_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN vessels v ON (v.id = up.vessel_id OR v.mmsi = up.mmsi)
      JOIN vessel_activity va ON va.vessel_id = v.id
      WHERE up.id = auth.uid() AND up.role = 'crew' AND va.id = activity_messages.vessel_activity_id
    )
  );
