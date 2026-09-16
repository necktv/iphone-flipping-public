/**
 * Test: usa l'adapter VintedAdapter aggiornato — mostra primi 3 risultati
 */
import { VintedAdapter } from '@iphone-flipping/adapters';
import { normalizeIphoneListing } from '@iphone-flipping/core';

async function main() {
  console.log('🔍 Test VintedAdapter aggiornato: "iphone 13" — 1 pagina\n');

  const adapter = new VintedAdapter(true);
  const rawListings = await adapter.fetchLatestListings({
    searchQuery: 'iphone 13',
    minPrice: 80,
    maxPrice: 1200,
    maxPages: 1,
  });

  console.log(`📋 Trovati ${rawListings.length} annunci totali\n`);
  console.log('='.repeat(90));
  console.log('PRIMI 3 RISULTATI:');
  console.log('='.repeat(90));

  const limit = Math.min(3, rawListings.length);
  for (let i = 0; i < limit; i++) {
    const raw = rawListings[i];
    const norm = normalizeIphoneListing(raw);

    console.log(`\n#${i + 1}`);
    console.log(`  Titolo:     ${raw.title}`);
    console.log(`  Prezzo:     €${raw.price}`);
    console.log(`  Modello:    ${norm.model}`);
    console.log(`  Storage:    ${norm.storageGb ? norm.storageGb + ' GB' : '❌ non trovato'}`);
    console.log(`  Batteria:   ${norm.batteryHealthPct ? norm.batteryHealthPct + '%' : '❌ non trovata'}`);
    console.log(`  Condizione: ${norm.condition}`);
    console.log(`  Scatola:    ${norm.hasOriginalBox ? '✅ Sì' : '❌ No'}`);
    console.log(`  Bloccato:   ${norm.isLocked ? '⚠️ SÌ' : '✅ No'}`);
    console.log(`  URL:        ${raw.url}`);
    console.log(`  Venditore:  ${raw.sellerName || 'N/A'}`);
    console.log(`  Immagini:   ${raw.images.length}`);
    console.log('-'.repeat(90));
  }

  console.log(`\n✅ Test completato: ${rawListings.length} annunci totali, mostrati primi ${limit}`);
}

main().catch(err => {
  console.error('❌ Errore:', err);
  process.exit(1);
});
