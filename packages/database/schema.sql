-- Schema PostgreSQL per iPhone Multi-Marketplace Flipping System

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enum Types
DO $$ BEGIN
  CREATE TYPE iphone_model AS ENUM (
    'IPHONE_11', 'IPHONE_11_PRO', 'IPHONE_11_PRO_MAX',
    'IPHONE_12_MINI', 'IPHONE_12', 'IPHONE_12_PRO', 'IPHONE_12_PRO_MAX',
    'IPHONE_13_MINI', 'IPHONE_13', 'IPHONE_13_PRO', 'IPHONE_13_PRO_MAX',
    'IPHONE_14', 'IPHONE_14_PLUS', 'IPHONE_14_PRO', 'IPHONE_14_PRO_MAX',
    'IPHONE_15', 'IPHONE_15_PLUS', 'IPHONE_15_PRO', 'IPHONE_15_PRO_MAX',
    'IPHONE_16', 'IPHONE_16_PLUS', 'IPHONE_16_PRO', 'IPHONE_16_PRO_MAX',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE item_condition AS ENUM (
    'NEW_SEALED', 'LIKE_NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'FOR_PARTS_DAMAGED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_status AS ENUM (
    'NEW', 'REVIEW', 'BUY', 'PASS', 'PURCHASED', 'REJECTED', 'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabella Annunci (Raw + Normalized)
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketplace VARCHAR(50) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'EUR',
  location VARCHAR(255),
  seller_name VARCHAR(255),
  seller_rating NUMERIC(3, 2),
  images JSONB DEFAULT '[]',
  raw_metadata JSONB DEFAULT '{}',
  
  -- Normalizzazione
  model iphone_model DEFAULT 'UNKNOWN',
  storage_gb INT,
  battery_health_pct INT,
  condition item_condition DEFAULT 'GOOD',
  has_original_box BOOLEAN DEFAULT FALSE,
  has_receipt_or_invoice BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  
  -- Deduplicazione
  dedup_hash VARCHAR(64) NOT NULL,
  cluster_id UUID,
  
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_marketplace_external UNIQUE (marketplace, external_id)
);

-- Tabella Opportunità
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  
  fair_value NUMERIC(10, 2) NOT NULL,
  quick_sale_value NUMERIC(10, 2) NOT NULL,
  estimated_profit NUMERIC(10, 2) NOT NULL,
  roi_percentage NUMERIC(6, 2) NOT NULL,
  confidence_score NUMERIC(4, 3) NOT NULL,
  risk_score NUMERIC(4, 3) NOT NULL,
  
  status opportunity_status DEFAULT 'NEW',
  user_notes TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  status_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Feedback Loop / Operazioni Reali
CREATE TABLE IF NOT EXISTS deal_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  
  actual_purchase_price NUMERIC(10, 2) NOT NULL,
  actual_resell_price NUMERIC(10, 2),
  refurbish_cost NUMERIC(10, 2) DEFAULT 0.00,
  shipping_and_fees NUMERIC(10, 2) DEFAULT 0.00,
  actual_net_profit NUMERIC(10, 2),
  
  purchased_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  days_to_sell INT,
  
  is_successful BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_dedup_hash ON listings(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_listings_model_storage ON listings(model, storage_gb);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_roi_profit ON opportunities(roi_percentage DESC, estimated_profit DESC);

-- Tabella Benchmark di Mercato (Aggiornata dallo Scraper A a bassa frequenza)
CREATE TABLE IF NOT EXISTS market_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model iphone_model NOT NULL,
  storage_gb INT NOT NULL,
  condition item_condition DEFAULT 'EXCELLENT',
  
  avg_price NUMERIC(10, 2) NOT NULL,
  median_price NUMERIC(10, 2) NOT NULL,
  min_price NUMERIC(10, 2) NOT NULL,
  max_price NUMERIC(10, 2) NOT NULL,
  sample_count INT NOT NULL DEFAULT 0,
  
-- Tabella Catalogo Annunci Venduti su Vinted Italia
CREATE TABLE IF NOT EXISTS vinted_sold_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vinted_item_id VARCHAR(255) UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sold_price NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'EUR',
  
  -- Classificazione Estratta
  model iphone_model NOT NULL,
  storage_gb INT,
  battery_health_pct INT,
  condition item_condition DEFAULT 'GOOD',
  has_original_box BOOLEAN DEFAULT FALSE,
  has_receipt_or_invoice BOOLEAN DEFAULT FALSE,
  
  images JSONB DEFAULT '[]',
  seller_name VARCHAR(255),
  sold_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sold_model_storage ON vinted_sold_catalog(model, storage_gb);
CREATE INDEX IF NOT EXISTS idx_sold_condition ON vinted_sold_catalog(condition);
CREATE INDEX IF NOT EXISTS idx_sold_date ON vinted_sold_catalog(sold_at DESC);

