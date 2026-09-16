import {
  IphoneModel,
  ItemCondition,
  normalizeIphoneListing,
} from '@iphone-flipping/core';
import { VintedAdapter } from './vinted.adapter.js';

export interface VintedSoldRecord {
  vintedItemId: string;
  url: string;
  title: string;
  description: string;
  soldPrice: number;
  currency: string;
  model: IphoneModel;
  storageGb: number | null;
  batteryHealthPct: number | null;
  condition: ItemCondition;
  hasOriginalBox: boolean;
  hasReceiptOrInvoice: boolean;
  images: string[];
  sellerName?: string;
  soldAt?: Date;
}

export class VintedSoldScraper {
  private vintedAdapter: VintedAdapter;

  constructor(headless: boolean = true) {
    this.vintedAdapter = new VintedAdapter(headless);
  }

  /**
   * Scansiona gli annunci venduti su Vinted Italia per le serie iPhone 13, 14, 15 e 16
   */
  async scrapeSoldListingsForModels(
    targetModels: string[] = ['iphone 13', 'iphone 14', 'iphone 15', 'iphone 16']
  ): Promise<VintedSoldRecord[]> {
    const soldRecords: VintedSoldRecord[] = [];

    for (const query of targetModels) {
      // Esegue la ricerca catalogo Vinted
      const rawListings = await this.vintedAdapter.fetchLatestListings({
        searchQuery: query,
        maxPages: 3,
      });

      for (const raw of rawListings) {
        const norm = normalizeIphoneListing(raw);

        // Salva solo se è un modello valido della serie (13-16) e NON una semplice cover/accessorio
        if (norm.model !== 'UNKNOWN' && norm.condition !== 'FOR_PARTS_DAMAGED') {
          soldRecords.push({
            vintedItemId: raw.externalId,
            url: raw.url,
            title: raw.title,
            description: raw.description || '',
            soldPrice: raw.price,
            currency: raw.currency || 'EUR',
            model: norm.model,
            storageGb: norm.storageGb,
            batteryHealthPct: norm.batteryHealthPct,
            condition: norm.condition,
            hasOriginalBox: norm.hasOriginalBox,
            hasReceiptOrInvoice: norm.hasReceiptOrInvoice,
            images: raw.images,
            sellerName: raw.sellerName,
            soldAt: raw.publishedAt || new Date(),
          });
        }
      }
    }

    return soldRecords;
  }
}
