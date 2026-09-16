import { chromium } from 'playwright';
import { calculateBenchmarkFromPricePoints } from '@iphone-flipping/core';

async function fetchSoldIphone14Listings() {
  console.log('===========================================================');
  console.log(' 🛒 SCANSIONE ESCLUSIVA DEGLI ANNUNCI EFFETTIVAMENTE VENDUTI');
  console.log(' Target: iPhone 14 128GB (Mercato Italia)');
  console.log('===========================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'it-IT',
  });
  const page = await context.newPage();

  const soldPrices: number[] = [];
  const soldItemsDetails: Array<{ title: string; price: number; url: string }> = [];

  try {
    // 1. Scansione eBay Italia - Filtro Esclusivo VENDUTI (LH_Sold=1 & LH_Complete=1)
    const ebaySoldUrl = 'https://www.ebay.it/sch/i.html?_nkw=iphone+14+128gb&LH_Sold=1&LH_Complete=1&_sop=12';
    console.log(`🔍 Interrogo annunci VENDUTI su eBay Italia...`);

    await page.goto(ebaySoldUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const ebayCards = await page.locator('.s-item').all();

    for (const card of ebayCards.slice(0, 15)) {
      try {
        const titleEl = card.locator('.s-item__title').first();
        const priceEl = card.locator('.s-item__price').first();
        const linkEl = card.locator('a.s-item__link').first();

        const title = await titleEl.innerText({ timeout: 500 }).catch(() => '');
        const priceText = await priceEl.innerText({ timeout: 500 }).catch(() => '');
        const href = await linkEl.getAttribute('href').catch(() => '');

        if (!title || !priceText || title.includes('Shop on eBay') || /cover|custodia|pellicola|vetro|ricambi/i.test(title)) {
          continue;
        }

        // Estrai il prezzo finale di vendita
        const cleanPriceStr = priceText.replace('EUR', '').replace('€', '').replace(/\./g, '').replace(',', '.').trim();
        const price = parseFloat(cleanPriceStr);

        if (!isNaN(price) && price >= 250 && price <= 750) {
          soldPrices.push(price);
          soldItemsDetails.push({ title: title.trim(), price, url: href || '' });
        }
      } catch {
        // Ignora card con selettori mancanti
      }
    }

    console.log(`\n✅ Estratti ${soldPrices.length} annunci EFFETTIVAMENTE VENDUTI di iPhone 14 128GB!`);

    if (soldPrices.length > 0) {
      const benchmark = calculateBenchmarkFromPricePoints('IPHONE_14', 128, 'GOOD', soldPrices);

      console.log('\n📊 BENCHMARK REALE BASATO SOLO SU ANNUNCI VENDUTI CON SUCCESSO:');
      console.log(` • Campioni VENDUTI analizzati (dopo filtro outlier): ${benchmark?.sampleCount}`);
      console.log(` • PREZZO MEDIO DI VENDITA EFFETTIVA:                   €${benchmark?.avgPrice}`);
      console.log(` • PREZZO MEDIANO DI VENDITA EFFETTIVA:                 €${benchmark?.medianPrice}`);
      console.log(` • Range effettivo di chiusura compravendite:           €${benchmark?.minPrice} - €${benchmark?.maxPrice}`);

      console.log('\nEsempi di annunci realmente VENDUTI recentemente:');
      for (const item of soldItemsDetails.slice(0, 5)) {
        console.log(` • [VENDUTO A €${item.price}] ${item.title.slice(0, 60)}...`);
      }
    }
  } catch (err) {
    console.error('Errore durante l\'estrazione:', err);
  } finally {
    await browser.close();
  }
}

fetchSoldIphone14Listings();
