import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  calculateValuation,
  generateListingDedupHash,
  normalizeIphoneListing,
  OpportunityStatusEnum,
  RawListing,
} from '@iphone-flipping/core';
import { MockMarketplaceAdapter, VintedAdapter, VintedBenchmarkAdapter, VintedSoldScraper } from '@iphone-flipping/adapters';
import { createDbPool } from '@iphone-flipping/database';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4000;
const pool = createDbPool();

// Health Check
app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 1. Ingestion Endpoint (Esegue l'adapter, normalizza, deduplica e salva opportunità)
app.post('/api/ingest', async (req, res) => {
  try {
    const { marketplace = 'mock', searchQuery = 'iphone 13' } = req.body;

    const adapter = marketplace === 'vinted' 
      ? new VintedAdapter(true)
      : new MockMarketplaceAdapter();

    const rawListings: RawListing[] = await adapter.fetchLatestListings({ searchQuery, maxPages: 1 });
    
    let processedCount = 0;
    let createdOpportunitiesCount = 0;

    for (const raw of rawListings) {
      processedCount++;
      const normalized = normalizeIphoneListing(raw);
      const dedupHash = generateListingDedupHash(raw, normalized);

      // Inserisci annuncio se non esiste
      const listingRes = await pool.query(
        `INSERT INTO listings 
         (marketplace, external_id, url, title, description, price, currency, seller_name, seller_rating, images, raw_metadata, model, storage_gb, battery_health_pct, condition, has_original_box, has_receipt_or_invoice, is_locked, dedup_hash, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         ON CONFLICT (marketplace, external_id) DO NOTHING
         RETURNING id`,
        [
          raw.marketplace,
          raw.externalId,
          raw.url,
          raw.title,
          raw.description || '',
          raw.price,
          raw.currency,
          raw.sellerName || null,
          raw.sellerRating || null,
          JSON.stringify(raw.images),
          JSON.stringify(raw.rawMetadata),
          normalized.model,
          normalized.storageGb,
          normalized.batteryHealthPct,
          normalized.condition,
          normalized.hasOriginalBox,
          normalized.hasReceiptOrInvoice,
          normalized.isLocked,
          dedupHash,
          raw.publishedAt || new Date(),
        ]
      );

      const listingId = listingRes.rows[0]?.id;
      if (!listingId) continue; // Duplicato saltato

      // Cerca eventuale benchmark fresco dal DB (Scraper A)
      let customBenchmarkPrice: number | undefined = undefined;
      if (normalized.model !== 'UNKNOWN' && normalized.storageGb) {
        const benchRes = await pool.query(
          `SELECT median_price FROM market_benchmarks WHERE model = $1 AND storage_gb = $2 LIMIT 1`,
          [normalized.model, normalized.storageGb]
        );
        if (benchRes.rows[0]?.median_price) {
          customBenchmarkPrice = parseFloat(benchRes.rows[0].median_price);
        }
      }

      // Calcola valutazione finanziaria usando il benchmark se presente
      const valuation = calculateValuation(normalized, customBenchmarkPrice);

      // Salva opportunità se ROI > 10% e Rischio < 0.6
      if (valuation.roiPercentage >= 10 && valuation.riskScore <= 0.6) {
        await pool.query(
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
        createdOpportunitiesCount++;
      }
    }

    res.json({
      success: true,
      processedListings: processedCount,
      createdOpportunities: createdOpportunitiesCount,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Lista Opportunità per Dashboard
app.get('/api/opportunities', async (req, res) => {
  try {
    const status = req.query.status as string;
    let query = `
      SELECT 
        o.id as opportunity_id,
        o.fair_value,
        o.quick_sale_value,
        o.estimated_profit,
        o.roi_percentage,
        o.confidence_score,
        o.risk_score,
        o.status,
        l.id as listing_id,
        l.marketplace,
        l.title,
        l.url,
        l.price,
        l.model,
        l.storage_gb,
        l.battery_health_pct,
        l.condition,
        l.images
      FROM opportunities o
      JOIN listings l ON o.listing_id = l.id
    `;
    
    const params: any[] = [];
    if (status) {
      query += ` WHERE o.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY o.roi_percentage DESC, o.estimated_profit DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Aggiorna Stato Opportunità (BUY / PASS / REVIEW)
app.patch('/api/opportunities/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const body = z.object({
      status: OpportunityStatusEnum,
      notes: z.string().optional(),
    }).parse(req.body);

    const result = await pool.query(
      `UPDATE opportunities 
       SET status = $1, user_notes = $2, status_updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [body.status, body.notes || null, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Opportunity not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
    return;
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Feedback Loop: Registra Operazione Reale (Deal Tracker)
app.post('/api/deals', async (req, res) => {
  try {
    const Schema = z.object({
      opportunityId: z.string().uuid(),
      actualPurchasePrice: z.number().positive(),
      actualResellPrice: z.number().optional(),
      refurbishCost: z.number().default(0),
      shippingAndFees: z.number().default(0),
      isSuccessful: z.boolean().default(true),
      notes: z.string().optional(),
    });

    const body = Schema.parse(req.body);
    const actualNetProfit = body.actualResellPrice
      ? body.actualResellPrice - body.actualPurchasePrice - body.refurbishCost - body.shippingAndFees
      : null;

    const result = await pool.query(
      `INSERT INTO deal_outcomes 
       (opportunity_id, actual_purchase_price, actual_resell_price, refurbish_cost, shipping_and_fees, actual_net_profit, is_successful, notes, purchased_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        body.opportunityId,
        body.actualPurchasePrice,
        body.actualResellPrice || null,
        body.refurbishCost,
        body.shippingAndFees,
        actualNetProfit,
        body.isSuccessful,
        body.notes || null,
      ]
    );

    // Aggiorna lo stato dell'opportunità in PURCHASED
    await pool.query(
      `UPDATE opportunities SET status = 'PURCHASED' WHERE id = $1`,
      [body.opportunityId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5. Scraper A: Esegue la scansione a bassa frequenza per i benchmark di mercato
app.post('/api/benchmarks/run', async (req, res) => {
  try {
    const { models = ['IPHONE_13', 'IPHONE_13_PRO', 'IPHONE_14', 'IPHONE_14_PRO'] } = req.body;
    const benchmarkAdapter = new VintedBenchmarkAdapter(true);

    const benchmarks = await benchmarkAdapter.computeMarketBenchmarks(models);

    for (const bm of benchmarks) {
      await pool.query(
        `INSERT INTO market_benchmarks 
         (model, storage_gb, condition, avg_price, median_price, min_price, max_price, sample_count, last_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT (model, storage_gb, condition) 
         DO UPDATE SET 
           avg_price = EXCLUDED.avg_price,
           median_price = EXCLUDED.median_price,
           min_price = EXCLUDED.min_price,
           max_price = EXCLUDED.max_price,
           sample_count = EXCLUDED.sample_count,
           last_updated_at = CURRENT_TIMESTAMP`,
        [bm.model, bm.storageGb, bm.condition, bm.avgPrice, bm.medianPrice, bm.minPrice, bm.maxPrice, bm.sampleCount]
      );
    }

    res.json({ success: true, updatedBenchmarksCount: benchmarks.length, data: benchmarks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Legge i benchmark di mercato salvati nel DB
app.get('/api/benchmarks', async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM market_benchmarks ORDER BY model, storage_gb`);
    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Scansione e Catalogazione Annunci Venduti su Vinted Italia (iPhone 13 - 16)
app.post('/api/listino/scan', async (_req, res) => {
  try {
    const scraper = new VintedSoldScraper(true);
    const soldRecords = await scraper.scrapeSoldListingsForModels([
      'iphone 13',
      'iphone 14',
      'iphone 15',
      'iphone 16',
    ]);

    let insertedCount = 0;

    for (const item of soldRecords) {
      const result = await pool.query(
        `INSERT INTO vinted_sold_catalog 
         (vinted_item_id, url, title, description, sold_price, currency, model, storage_gb, battery_health_pct, condition, has_original_box, has_receipt_or_invoice, images, seller_name, sold_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (vinted_item_id) DO NOTHING
         RETURNING id`,
        [
          item.vintedItemId,
          item.url,
          item.title,
          item.description,
          item.soldPrice,
          item.currency,
          item.model,
          item.storageGb,
          item.batteryHealthPct,
          item.condition,
          item.hasOriginalBox,
          item.hasReceiptOrInvoice,
          JSON.stringify(item.images),
          item.sellerName || null,
          item.soldAt || new Date(),
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        insertedCount++;
      }
    }

    res.json({
      success: true,
      scrapedTotal: soldRecords.length,
      newlyCatalogedCount: insertedCount,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Consultazione Listino Prezzi Reali di Vendita raggruppati con filtri
app.get('/api/listino', async (req, res) => {
  try {
    const { model, storageGb } = req.query;

    let query = `
      SELECT 
        model,
        storage_gb,
        condition,
        COUNT(*) as total_sold_samples,
        ROUND(AVG(sold_price), 2) as avg_sold_price,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::numeric, 2) as median_sold_price,
        MIN(sold_price) as min_sold_price,
        MAX(sold_price) as max_sold_price
      FROM vinted_sold_catalog
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (model) {
      params.push(model);
      whereClauses.push(`model = $${params.length}`);
    }

    if (storageGb) {
      params.push(parseInt(storageGb as string, 10));
      whereClauses.push(`storage_gb = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` GROUP BY model, storage_gb, condition ORDER BY model, storage_gb, condition`;

    const summaryResult = await pool.query(query, params);

    // Recupera la lista dettagliata dei singoli annunci venduti
    let detailQuery = `SELECT * FROM vinted_sold_catalog`;
    if (whereClauses.length > 0) {
      detailQuery += ` WHERE ` + whereClauses.join(' AND ');
    }
    detailQuery += ` ORDER BY sold_at DESC LIMIT 200`;

    const itemsResult = await pool.query(detailQuery, params);

    res.json({
      success: true,
      summaryCount: summaryResult.rowCount,
      summary: summaryResult.rows,
      itemsCount: itemsResult.rowCount,
      items: itemsResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Esportazione Listino in formato CSV (da aprire in Excel / Google Sheets)
app.get('/api/listino/export', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT vinted_item_id, model, storage_gb, battery_health_pct, condition, sold_price, has_original_box, has_receipt_or_invoice, title, url, sold_at 
       FROM vinted_sold_catalog ORDER BY model, storage_gb, sold_at DESC`
    );

    let csv = 'ID,Modello,Storage_GB,Batteria_Pct,Condizione,Prezzo_Venduto_EUR,Scatola,Scontrino,Titolo,URL,Data_Vendita\n';

    for (const row of result.rows) {
      const cleanTitle = `"${(row.title || '').replace(/"/g, '""')}"`;
      csv += `${row.vinted_item_id},${row.model},${row.storage_gb || ''},${row.battery_health_pct || ''},${row.condition},${row.sold_price},${row.has_original_box},${row.has_receipt_or_invoice},${cleanTitle},${row.url},${row.sold_at}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="listino_vinted_iphone.csv"');
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`[API Server] Running on port ${port}`);
});
