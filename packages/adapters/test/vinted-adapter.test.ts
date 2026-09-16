import { describe, expect, it } from 'vitest';
import { VintedAdapter } from '../src/vinted/vinted.adapter.js';
import { MockMarketplaceAdapter } from '../src/mock/mock.adapter.js';
import { VintedItem } from '../src/vinted/vinted.types.js';

describe('Vinted Adapter & Mapping', () => {
  it('mappa correttamente un oggetto JSON Vinted in RawListing', () => {
    const adapter = new VintedAdapter();

    const mockVintedItem: VintedItem = {
      id: 987654321,
      title: 'iPhone 13 128GB azzurro',
      price: '420.00',
      currency: 'EUR',
      url: '/items/987654321-iphone-13-128gb-azzurro',
      description: 'Batteria 90%, completo di scatola',
      photos: [
        { id: 1, url: 'https://images.vinted.net/photo1.jpg' }
      ],
      user: {
        id: 112233,
        login: 'utente_vinted',
        feedback_reputation: 4.9,
      },
      status: 'Buono',
      created_at_ts: 1700000000,
    };

    const rawListing = adapter.mapVintedItemToRawListing(mockVintedItem);

    expect(rawListing).not.toBeNull();
    expect(rawListing?.marketplace).toBe('vinted');
    expect(rawListing?.externalId).toBe('987654321');
    expect(rawListing?.price).toBe(420);
    expect(rawListing?.sellerName).toBe('utente_vinted');
    expect(rawListing?.url).toBe('https://www.vinted.it/items/987654321-iphone-13-128gb-azzurro');
  });

  it('funziona correttamente con il MockMarketplaceAdapter', async () => {
    const mockAdapter = new MockMarketplaceAdapter();
    const results = await mockAdapter.fetchLatestListings({ searchQuery: 'iphone' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].marketplace).toBe('mock_marketplace');
    expect(results[0].price).toBeGreaterThan(0);
  });
});
