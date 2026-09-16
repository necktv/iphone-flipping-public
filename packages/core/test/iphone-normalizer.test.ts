import { describe, expect, it } from 'vitest';
import { normalizeIphoneListing } from '../src/normalizers/iphone-normalizer.js';
import { calculateValuation } from '../src/valuation/valuation-engine.js';
import { RawListing } from '../src/types/domain.js';

describe('iPhone Listing Normalizer', () => {
  it('normalizza correttamente un annuncio per iPhone 13 Pro 128GB', () => {
    const raw: RawListing = {
      marketplace: 'vinted',
      externalId: '123456',
      url: 'https://www.vinted.it/items/123456-iphone-13-pro',
      title: 'iPhone 13 Pro 128GB Celeste con scatola',
      description: 'Vendo iPhone 13 pro da 128 giga in ottime condizioni, batteria 88%. Scatola inclusa.',
      price: 450,
      currency: 'EUR',
      images: [],
      rawMetadata: {},
    };

    const normalized = normalizeIphoneListing(raw);

    expect(normalized.model).toBe('IPHONE_13_PRO');
    expect(normalized.storageGb).toBe(128);
    expect(normalized.batteryHealthPct).toBe(88);
    expect(normalized.condition).toBe('EXCELLENT');
    expect(normalized.hasOriginalBox).toBe(true);
    expect(normalized.isLocked).toBe(false);
  });

  it('calcola profitto e ROI positivi per un affare', () => {
    const raw: RawListing = {
      marketplace: 'vinted',
      externalId: '999888',
      url: 'https://www.vinted.it/items/999888',
      title: 'iPhone 12 128GB come nuovo',
      description: 'Batteria 92%, perfetto in tutto.',
      price: 200,
      currency: 'EUR',
      images: [],
      rawMetadata: {},
    };

    const normalized = normalizeIphoneListing(raw);
    const valuation = calculateValuation(normalized);

    expect(valuation.fairValue).toBeGreaterThan(250);
    expect(valuation.estimatedProfit).toBeGreaterThan(50);
    expect(valuation.roiPercentage).toBeGreaterThan(20);
  });
});
