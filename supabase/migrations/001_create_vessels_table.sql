-- =====================================================
-- MIGRATION 001: Tabella VESSELS (Navi Monitorate)
-- =====================================================
-- Questa tabella contiene le navi che monitoriamo.
-- Gli MMSI vengono usati per interrogare l'API Datalastic.
-- =====================================================

-- Crea tabella vessels
CREATE TABLE IF NOT EXISTS vessels (
  -- Chiave primaria UUID (generata automaticamente)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- MMSI: identificativo univoco della nave (usato per API Datalastic)
  mmsi TEXT UNIQUE NOT NULL,
  
  -- Nome della nave
  name TEXT NOT NULL,
  
  -- Tipo di nave (es: "Cargo", "Tanker", "Passenger")
  vessel_type TEXT NOT NULL,
  
  -- Bandiera (es: "IT", "MT", "PA")
  flag TEXT,
  
  -- Timestamp creazione/aggiornamento
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indice su MMSI per query veloci
CREATE INDEX IF NOT EXISTS vessels_mmsi_idx ON vessels (mmsi);

-- Indice su name per ricerche
CREATE INDEX IF NOT EXISTS vessels_name_idx ON vessels (name);

-- Commenti per documentazione
COMMENT ON TABLE vessels IS 'Navi monitorate dal sistema. Gli MMSI vengono usati per interrogare API Datalastic.';
COMMENT ON COLUMN vessels.mmsi IS 'Maritime Mobile Service Identity - identificativo univoco internazionale';
COMMENT ON COLUMN vessels.vessel_type IS 'Tipologia nave (Cargo, Tanker, Passenger, etc.)';

-- =====================================================
-- DATI INIZIALI (seed)
-- =====================================================
-- Inserisci le 5 navi del MVP

INSERT INTO vessels (mmsi, name, vessel_type, flag) VALUES
  ('247123456', 'Sider RODI', 'Cargo', 'IT'),
  ('247234567', 'Sider ORION', 'Cargo', 'IT'),
  ('247345678', 'Sider ONDA', 'Cargo', 'IT'),
  ('247456789', 'AnnaMaria Z', 'Tanker', 'MT'),
  ('247567890', 'STELLA', 'Cargo', 'IT')
ON CONFLICT (mmsi) DO NOTHING; -- Non duplicare se già esistono

-- =====================================================
-- VERIFICA
-- =====================================================
-- Esegui questa query per verificare che tutto funzioni:
-- SELECT * FROM vessels ORDER BY name;
