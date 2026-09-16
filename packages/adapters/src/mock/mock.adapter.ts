import { RawListing, RawListingSchema } from '@iphone-flipping/core';
import { FetchQueryOptions, MarketplaceAdapter } from '../base.adapter.js';

export class MockMarketplaceAdapter implements MarketplaceAdapter {
  readonly marketplaceName = 'mock_marketplace';

  async checkHealth(): Promise<boolean> {
    return true;
  }

  async fetchLatestListings(options: FetchQueryOptions = {}): Promise<RawListing[]> {
    const query = options.searchQuery || 'iphone';
    
    const mockData = [
      {
        marketplace: this.marketplaceName,
        externalId: 'mock-001',
        url: 'https://example.com/item/mock-001',
        title: 'iPhone 13 Pro 128GB Celeste con scatola',
        description: 'iPhone 13 pro da 128 giga in ottime condizioni, batteria 88%. Scatola inclusa.',
        price: 390.0,
        currency: 'EUR',
        sellerName: 'Marco_Phone',
        sellerRating: 4.8,
        images: ['https://example.com/img1.jpg'],
        publishedAt: new Date(),
        rawMetadata: { isMock: true },
      },
      {
        marketplace: this.marketplaceName,
        externalId: 'mock-002',
        url: 'https://example.com/item/mock-002',
        title: 'iPhone 14 Pro Max 256GB Nero',
        description: 'iPhone 14 pro max 256 giga come nuovo, batteria 96%, scontrino garanzia.',
        price: 680.0,
        currency: 'EUR',
        sellerName: 'AppleTrader',
        sellerRating: 4.9,
        images: ['https://example.com/img2.jpg'],
        publishedAt: new Date(),
        rawMetadata: { isMock: true },
      },
      {
        marketplace: this.marketplaceName,
        externalId: 'mock-003',
        url: 'https://example.com/item/mock-003',
        title: 'iPhone 12 64GB Nero da riparare',
        description: 'Vetro crepato dietro, icloud ok, batteria 78%',
        price: 120.0,
        currency: 'EUR',
        sellerName: 'BargainHunter',
        sellerRating: 4.2,
        images: ['https://example.com/img3.jpg'],
        publishedAt: new Date(),
        rawMetadata: { isMock: true },
      },
    ];

    return mockData
      .map((item) => RawListingSchema.parse(item))
      .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  }
}
