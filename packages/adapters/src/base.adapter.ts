import { RawListing } from '@iphone-flipping/core';

export interface FetchQueryOptions {
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  maxPages?: number;
  sinceDate?: Date;
}

/**
 * Interfaccia modulare che ogni adapter di marketplace (Vinted, Subito, eBay, Mock) deve implementare.
 */
export interface MarketplaceAdapter {
  readonly marketplaceName: string;

  /**
   * Recupera la lista di annunci grezzi dal marketplace
   */
  fetchLatestListings(options?: FetchQueryOptions): Promise<RawListing[]>;

  /**
   * Verifica la connettività / salute dell'adapter
   */
  checkHealth(): Promise<boolean>;
}
