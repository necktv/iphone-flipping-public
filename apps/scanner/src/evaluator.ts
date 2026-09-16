/**
 * Evaluator — Logica di analisi annunci, confronto prezzi e rilevamento opportunità.
 *
 * Gestisce sia annunci nuovi che price-drop su annunci esistenti.
 */

import type { Pool } from 'pg';
import {
  normalizeIphoneListing,
  generateListingDedupHash,
  calculateValuation,
  RawListing,
  NormalizedListing,
  ValuationResult,
} from '@iphone-flipping/core';
import { ScannerConfig } from './config.js';
import { TelegramNotifier } from './notifier.js';

export interface ScanCycleStats {
  totalProcessed: number;
  newListings: number;
  priceDrops: number;
  priceDropsSkipped: number;
  opportunitiesCreated: number;
  errors: number;
}

export class Evaluator {
  constructor(
    private readonly pool: Pool,
    private readonly config: ScannerConfig,
    private readonly notifier: TelegramNotifier
  ) {}

  /**
   * Processa un batch di annunci grezzi provenienti dall'adapter.
   * Per ogni annuncio:
   *  - Se NUOVO: salva + valuta + eventuale notifica
   *  - Se ESISTE: confronta prezzo, rileva price-drop, ri-valuta
   */
  async processBatch(rawListings: RawListing[]): Promise<ScanCycleStats> {
    const stats: ScanCycleStats = {
      totalProcessed: 0,
      newListings: 0,
      priceDrops: 0,
      priceDropsSkipped: 0,
      opportunitiesCreated: 0,
      errors: 0,
    };

    for (const raw of rawListings) {
      try {
        stats.totalProcessed++;
        await this.processListing(raw, stats);
      } catch (error) {
        stats.errors++;
        console.error(`[Evaluator] Errore processando annuncio ${raw.externalId}:`, error);
      }
    }

    return stats;
  }

  private async processListing(raw: RawListing, stats: ScanCycleStats): Promise<void> {
    const normalized = normalizeIphoneListing(raw);
    const dedupHash = generateListingDedupHash(raw, normalized);

    // Controlla se l'annuncio esiste già nel DB
    const existingRes = await this.pool.query(
      `SELECT id, price FROM listings WHERE marketplace = $1 AND external_id = $2`,
      [raw.marketplace, raw.externalId]
    );

    if (existingRes.rows.length === 0) {
      // --- ANNUNCIO NUOVO ---
      await this.handleNewListing(raw, normalized, dedupHash, stats);
    } else {
      // --- ANNUNCIO ESISTENTE: controlla price-drop ---
      const existingListingId = existingRes.rows[0].id;
      const existingPrice = parseFloat(existingRes.rows[0].price);
      await this.handleExistingListing(raw, normalized, existingListingId, existingPrice, stats);
    }
  }

  /**
   * Gestisce un annuncio mai visto prima: salva, valuta, notifica se è un affare.
   */
  private async handleNewListing(
    raw: RawListing,
    normalized: NormalizedListing,
    dedupHash: string,
    stats: ScanCycleStats
  ): Promise<void> {
    // Inserisci nel DB
    const insertRes = await this.pool.query(
      `INSERT INTO listings
       (marketplace, external_id, url, title, description, price, currency, seller_name, seller_rating, images, raw_metadata,
        model, storage_gb, battery_health_pct, condition, has_original_box, has_receipt_or_invoice, is_locked, dedup_hash, published_at, last_scanned_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, TRUE)
       ON CONFLICT (marketplace, external_id) DO NOTHING
       RETURNING id`,
      [
        raw.marketplace, raw.externalId, raw.url, raw.title, raw.description || '',
        raw.price, raw.currency, raw.sellerName || null, raw.sellerRating || null,
        JSON.stringify(raw.images), JSON.stringify(raw.rawMetadata),
        normalized.model, normalized.storageGb, normalized.batteryHealthPct,
        normalized.condition, normalized.hasOriginalBox, normalized.hasReceiptOrInvoice,
        normalized.isLocked, dedupHash, raw.publishedAt || new Date(),
      ]
    );

    const listingId = insertRes.rows[0]?.id;
    if (!listingId) return; // Race condition / duplicato

    stats.newListings++;

    // Valuta l'annuncio
    const benchmarkPrice = await this.fetchBenchmarkPrice(normalized);
    const valuation = calculateValuation(normalized, benchmarkPrice);

    // Se è un affare, crea opportunità e notifica
    if (this.isOpportunity(valuation)) {
      await this.createOpportunity(listingId, valuation);
      stats.opportunitiesCreated++;

      await this.notifier.sendOpportunityAlert({
        type: 'NEW_LISTING',
        title: raw.title,
        model: normalized.model,
        storageGb: normalized.storageGb,
        condition: normalized.condition,
        currentPrice: raw.price,
        fairValue: valuation.fairValue,
        quickSaleValue: valuation.quickSaleValue,
        estimatedProfit: valuation.estimatedProfit,
        roiPercentage: valuation.roiPercentage,
        riskScore: valuation.riskScore,
        url: raw.url,
      });
    }
  }

  /**
   * Gestisce un annuncio già presente nel DB: rileva price-drop, ri-valuta.
   */
  private async handleExistingListing(
    raw: RawListing,
    normalized: NormalizedListing,
    existingListingId: string,
    existingPrice: number,
    stats: ScanCycleStats
  ): Promise<void> {
    // Aggiorna sempre il timestamp di ultima scansione
    await this.pool.query(
      `UPDATE listings SET last_scanned_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [existingListingId]
    );

    // Controlla se il prezzo è cambiato
    if (raw.price >= existingPrice) {
      // Prezzo uguale o aumentato — niente da fare
      return;
    }

    // --- PRICE DROP RILEVATO ---
    const priceChangePct = ((raw.price - existingPrice) / existingPrice) * 100;

    // Ignora ribassi troppo piccoli
    if (Math.abs(priceChangePct) < this.config.minPriceDropPctThreshold) {
      stats.priceDropsSkipped++;
      return;
    }

    stats.priceDrops++;
    console.log(`[Evaluator] 📉 Price drop rilevato: ${raw.title} — €${existingPrice} → €${raw.price} (${priceChangePct.toFixed(1)}%)`);

    // Registra il price-drop nella tabella storico
    await this.pool.query(
      `INSERT INTO listing_price_history (listing_id, old_price, new_price, price_change_pct)
       VALUES ($1, $2, $3, $4)`,
      [existingListingId, existingPrice, raw.price, priceChangePct]
    );

    // Aggiorna il prezzo nel listing
    await this.pool.query(
      `UPDATE listings SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [raw.price, existingListingId]
    );

    // Ri-valuta con il nuovo prezzo
    const updatedNormalized: NormalizedListing = {
      ...normalized,
      normalizedPrice: raw.price,
    };

    const benchmarkPrice = await this.fetchBenchmarkPrice(updatedNormalized);
    const valuation = calculateValuation(updatedNormalized, benchmarkPrice);

    // Se ora è un affare, crea/aggiorna opportunità e notifica
    if (this.isOpportunity(valuation)) {
      // Controlla se esiste già un'opportunità attiva per questo listing
      const existingOpp = await this.pool.query(
        `SELECT id FROM opportunities WHERE listing_id = $1 AND status IN ('NEW', 'REVIEW')`,
        [existingListingId]
      );

      if (existingOpp.rows.length > 0) {
        // Aggiorna l'opportunità esistente con i nuovi valori
        await this.pool.query(
          `UPDATE opportunities
           SET fair_value = $1, quick_sale_value = $2, estimated_profit = $3,
               roi_percentage = $4, confidence_score = $5, risk_score = $6,
               evaluated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            valuation.fairValue, valuation.quickSaleValue, valuation.estimatedProfit,
            valuation.roiPercentage, valuation.confidenceScore, valuation.riskScore,
            existingOpp.rows[0].id,
          ]
        );
      } else {
        await this.createOpportunity(existingListingId, valuation);
      }

      stats.opportunitiesCreated++;

      await this.notifier.sendOpportunityAlert({
        type: 'PRICE_DROP',
        title: raw.title,
        model: normalized.model,
        storageGb: normalized.storageGb,
        condition: normalized.condition,
        currentPrice: raw.price,
        fairValue: valuation.fairValue,
        quickSaleValue: valuation.quickSaleValue,
        estimatedProfit: valuation.estimatedProfit,
        roiPercentage: valuation.roiPercentage,
        riskScore: valuation.riskScore,
        url: raw.url,
        oldPrice: existingPrice,
        priceChangePct,
      });
    }
  }

  /**
   * Cerca il benchmark di mercato più recente dal DB per questo modello/storage.
   */
  private async fetchBenchmarkPrice(normalized: NormalizedListing): Promise<number | undefined> {
    if (normalized.model === 'UNKNOWN' || !normalized.storageGb) {
      return undefined;
    }

    const res = await this.pool.query(
      `SELECT median_price FROM market_benchmarks WHERE model = $1 AND storage_gb = $2 LIMIT 1`,
      [normalized.model, normalized.storageGb]
    );

    return res.rows[0]?.median_price ? parseFloat(res.rows[0].median_price) : undefined;
  }

  /**
   * Determina se una valutazione soddisfa le soglie minime per essere considerata un'opportunità.
   */
  private isOpportunity(valuation: ValuationResult): boolean {
    return (
      valuation.roiPercentage >= this.config.minRoiThreshold &&
      valuation.estimatedProfit >= this.config.minProfitThreshold &&
      valuation.riskScore <= 0.6
    );
  }

  /**
   * Inserisce una nuova opportunità nel DB.
   */
  private async createOpportunity(listingId: string, valuation: ValuationResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO opportunities
       (listing_id, fair_value, quick_sale_value, estimated_profit, roi_percentage, confidence_score, risk_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW')`,
      [
        listingId,
        valuation.fairValue,
        valuation.quickSaleValue,
        valuation.estimatedProfit,
        valuation.roiPercentage,
        valuation.confidenceScore,
        valuation.riskScore,
      ]
    );
  }
}
