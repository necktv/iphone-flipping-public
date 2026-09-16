/**
 * Scanner — Main entry point.
 *
 * Worker autonomo che scandisce Vinted a intervalli regolari,
 * rileva annunci sottocosto e price-drop, e notifica via Telegram.
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import { VintedAdapter } from '@iphone-flipping/adapters';
import { createDbPool } from '@iphone-flipping/database';
import { loadConfig } from './config.js';
import { TelegramNotifier } from './notifier.js';
import { Evaluator, ScanCycleStats } from './evaluator.js';

dotenv.config();

const config = loadConfig();
const pool = createDbPool();
const notifier = new TelegramNotifier(config);
const evaluator = new Evaluator(pool, config, notifier);

let isRunning = false;

/**
 * Esegue un ciclo completo di scansione su tutte le query configurate.
 */
async function runScanCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Scanner] ⏳ Ciclo precedente ancora in corso, skip...');
    return;
  }

  isRunning = true;
  const cycleStart = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Scanner] 🔍 Inizio ciclo scansione — ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`);
  console.log(`[Scanner] Query: ${config.searchQueries.join(', ')}`);
  console.log(`${'='.repeat(60)}`);

  const totalStats: ScanCycleStats = {
    totalProcessed: 0,
    newListings: 0,
    priceDrops: 0,
    priceDropsSkipped: 0,
    opportunitiesCreated: 0,
    errors: 0,
  };

  for (let i = 0; i < config.searchQueries.length; i++) {
    const query = config.searchQueries[i];

    try {
      console.log(`\n[Scanner] 📱 Scansione: "${query}" (${i + 1}/${config.searchQueries.length})`);

      const adapter = new VintedAdapter(true); // headless = true in produzione

      const rawListings = await adapter.fetchLatestListings({
        searchQuery: query,
        minPrice: config.minSearchPrice,
        maxPrice: config.maxSearchPrice,
        maxPages: config.maxPagesPerQuery,
      });

      console.log(`[Scanner] 📋 Trovati ${rawListings.length} annunci per "${query}"`);

      if (rawListings.length > 0) {
        const batchStats = await evaluator.processBatch(rawListings);

        // Accumula le statistiche
        totalStats.totalProcessed += batchStats.totalProcessed;
        totalStats.newListings += batchStats.newListings;
        totalStats.priceDrops += batchStats.priceDrops;
        totalStats.priceDropsSkipped += batchStats.priceDropsSkipped;
        totalStats.opportunitiesCreated += batchStats.opportunitiesCreated;
        totalStats.errors += batchStats.errors;

        console.log(`[Scanner] ✅ "${query}" — Nuovi: ${batchStats.newListings}, Price Drops: ${batchStats.priceDrops}, Opportunità: ${batchStats.opportunitiesCreated}`);
      }

      // Anti-ban: pausa tra un modello e l'altro (non dopo l'ultimo)
      if (i < config.searchQueries.length - 1) {
        const delay = config.delayBetweenModelsMs + Math.floor(Math.random() * 10000);
        console.log(`[Scanner] ⏸️  Pausa anti-ban: ${(delay / 1000).toFixed(0)}s...`);
        await sleep(delay);
      }
    } catch (error) {
      totalStats.errors++;
      console.error(`[Scanner] ❌ Errore scansione "${query}":`, error);
    }
  }

  const durationSeconds = Math.round((Date.now() - cycleStart) / 1000);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Scanner] 📊 Riepilogo ciclo:`);
  console.log(`  Annunci processati: ${totalStats.totalProcessed}`);
  console.log(`  Nuovi annunci:      ${totalStats.newListings}`);
  console.log(`  Price drops:        ${totalStats.priceDrops} (${totalStats.priceDropsSkipped} sotto soglia)`);
  console.log(`  Opportunità create: ${totalStats.opportunitiesCreated}`);
  console.log(`  Errori:             ${totalStats.errors}`);
  console.log(`  Durata:             ${durationSeconds}s`);
  console.log(`${'─'.repeat(60)}\n`);

  // Invia riepilogo su Telegram (solo se ci sono opportunità)
  await notifier.sendCycleSummary({
    totalProcessed: totalStats.totalProcessed,
    newListings: totalStats.newListings,
    priceDrops: totalStats.priceDrops,
    opportunitiesCreated: totalStats.opportunitiesCreated,
    durationSeconds,
  });

  isRunning = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── AVVIO ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   📱 iPhone Flipping Scanner — v1.0                 ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`[Scanner] Configurazione:`);
  console.log(`  Intervallo:         ogni ${config.scanIntervalMinutes} minuti`);
  console.log(`  Query:              ${config.searchQueries.join(', ')}`);
  console.log(`  Soglia ROI:         ${config.minRoiThreshold}%`);
  console.log(`  Soglia Profitto:    €${config.minProfitThreshold}`);
  console.log(`  Soglia Price Drop:  ${config.minPriceDropPctThreshold}%`);
  console.log(`  Pausa anti-ban:     ~${config.delayBetweenModelsMs / 1000}s tra query`);
  console.log(`  Telegram:           ${config.telegramEnabled ? '✅ Attivo' : '❌ Disattivato'}`);
  console.log(`  Max pagine/query:   ${config.maxPagesPerQuery}`);
  console.log(`  Range prezzo:       €${config.minSearchPrice} - €${config.maxSearchPrice}`);
  console.log('');

  // Verifica connessione DB
  try {
    await pool.query('SELECT 1');
    console.log('[Scanner] ✅ Connessione DB OK');
  } catch (error) {
    console.error('[Scanner] ❌ Impossibile connettersi al DB:', error);
    process.exit(1);
  }

  // Esegui subito il primo ciclo all'avvio
  console.log('[Scanner] 🚀 Esecuzione primo ciclo...\n');
  await runScanCycle();

  // Schedula i cicli successivi con node-cron
  const cronExpr = `*/${config.scanIntervalMinutes} * * * *`;
  console.log(`[Scanner] ⏰ Prossimo ciclo schedulato con cron: "${cronExpr}"\n`);

  cron.schedule(cronExpr, () => {
    runScanCycle().catch(err => {
      console.error('[Scanner] ❌ Errore fatale nel ciclo:', err);
    });
  });
}

// Gestione graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[Scanner] 🛑 SIGTERM ricevuto — chiusura in corso...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[Scanner] 🛑 SIGINT ricevuto — chiusura in corso...');
  await pool.end();
  process.exit(0);
});

main().catch(err => {
  console.error('[Scanner] ❌ Errore fatale:', err);
  process.exit(1);
});
