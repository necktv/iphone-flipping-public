-- Migration 003: User Pricing + Nuovi modelli iPhone (16e, SE 2, SE 3)

-- 1. Aggiungi i nuovi modelli all'enum iphone_model (se non esistono già)
DO $$ BEGIN
  ALTER TYPE iphone_model ADD VALUE IF NOT EXISTS 'IPHONE_16E';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE iphone_model ADD VALUE IF NOT EXISTS 'IPHONE_SE_2';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE iphone_model ADD VALUE IF NOT EXISTS 'IPHONE_SE_3';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tabella Listino Prezzi Utente (P50 + P25)
CREATE TABLE IF NOT EXISTS user_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model iphone_model NOT NULL,
  storage_gb INT NOT NULL,
  
  -- P50: Prezzo mediano di vendita (vendita normale in ~7 giorni)
  p50_price NUMERIC(10, 2) NOT NULL,
  
  -- P25: Prezzo vendita rapida (vendita sicura in ~24h)
  p25_price NUMERIC(10, 2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_model_storage UNIQUE (model, storage_gb)
);

CREATE INDEX IF NOT EXISTS idx_user_pricing_model ON user_pricing(model, storage_gb);

-- 3. Aggiungi colonna flipping_score alla tabella opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS flipping_score INT;

-- 4. Aggiungi colonne last_scanned_at e is_active alla tabella listings (se mancano)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
