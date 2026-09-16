import {
  calculateBenchmarkFromPricePoints,
  IphoneModel,
  MarketBenchmark,
  normalizeIphoneListing,
} from '@iphone-flipping/core';
import { VintedAdapter } from './vinted.adapter.js';

export class VintedBenchmarkAdapter {
  private vintedAdapter: VintedAdapter;

  constructor(headless: boolean = true) {
    this.vintedAdapter = new VintedAdapter(headless);
  }

  /**
   * Esegue lo Scraper A a bassa frequenza per calcolare i prezzi medi di mercato
   * di dispositivi "senza graffi / in ottime condizioni"
   */
  async computeMarketBenchmarks(targetModels: IphoneModel[]): Promise<MarketBenchmark[]> {
    const benchmarks: MarketBenchmark[] = [];

    for (const model of targetModels) {
      if (model === 'UNKNOWN') continue;

      const queryText = model.toLowerCase().replace('_', ' ');
      
      // Esegue la ricerca specifica per articoli in buone/ottime condizioni
      const listings = await this.vintedAdapter.fetchLatestListings({
        searchQuery: `${queryText} ottimo stato`,
        maxPages: 2,
      });

      // Raggruppa i prezzi per GB di memoria per oggetti in buone condizioni ("senza graffi")
      const priceMapByStorage: Record<number, number[]> = {};

      for (const raw of listings) {
        const normalized = normalizeIphoneListing(raw);
        
        // Filtra solo quelli dello stesso modello, NON danneggiati e NON cover/accessori
        if (
          normalized.model === model &&
          normalized.condition !== 'FOR_PARTS_DAMAGED' &&
          normalized.storageGb !== null &&
          !normalized.isLocked
        ) {
          if (!priceMapByStorage[normalized.storageGb]) {
            priceMapByStorage[normalized.storageGb] = [];
          }
          priceMapByStorage[normalized.storageGb].push(normalized.normalizedPrice);
        }
      }

      // Calcola medie e mediane senza outlier per ciascun taglio di memoria
      for (const [storageGbStr, prices] of Object.entries(priceMapByStorage)) {
        const storageGb = parseInt(storageGbStr, 10);
        const benchmark = calculateBenchmarkFromPricePoints(
          model,
          storageGb,
          'EXCELLENT',
          prices
        );

        if (benchmark) {
          benchmarks.push(benchmark);
        }
      }
    }

    return benchmarks;
  }
}
