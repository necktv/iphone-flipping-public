-- Migrazione 002: Price History + Scanner Support
-- Tabella per tracciare ogni variazione di prezzo degli annunci

CREATE TABLE IF NOT EXISTS listing_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  old_price NUMERIC(10, 2) NOT NULL,
  new_price NUMERIC(10, 2) NOT NULL,
  price_change_pct NUMERIC(6, 2) NOT NULL,  -- es. -15.30 = ribasso del 15.3%
  detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_listing ON listing_price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_price_history_detected ON listing_price_history(detected_at DESC);

-- Nuove colonne sulla tabella listings per supportare lo scanner
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_listings_last_scanned ON listings(last_scanned_at);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active) WHERE is_active = TRUE;
