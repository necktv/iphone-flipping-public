import { IphoneModel, ItemCondition, NormalizedListing, RawListing } from '../types/domain.js';

/**
 * Parsing euristico per estrarre Modello, Storage, Batteria e Condizioni da titolo/descrizione
 */
export function normalizeIphoneListing(raw: RawListing): NormalizedListing {
  const fullText = `${raw.title} ${raw.description || ''}`.toLowerCase();

  // 1. Modello iPhone
  const model = parseIphoneModel(fullText);

  // 2. Storage GB
  const storageGb = parseStorageGb(fullText);

  // 3. Percentuale Batteria (es. 88%, batteria 88, battery 88%)
  const batteryHealthPct = parseBatteryHealth(fullText);

  // 4. Condizioni
  const condition = parseCondition(fullText);

  // 5. Scatola e Scontrino
  const hasOriginalBox = /scatola|box|confezione/i.test(fullText) && !/senza scatola|no box/i.test(fullText);
  const hasReceiptOrInvoice = /scontrino|fattura|ricevuta|garanzia/i.test(fullText);

  // 6. Blocco iCloud / SIM / Da riparare
  const isLocked = /icloud|bloccato|locked|parti|ricambi/i.test(fullText);

  // Calcolo della confidence sulla normalizzazione
  let confidence = 0.5;
  if (model !== 'UNKNOWN') confidence += 0.3;
  if (storageGb !== null) confidence += 0.1;
  if (batteryHealthPct !== null) confidence += 0.1;

  return {
    model,
    storageGb,
    batteryHealthPct,
    condition,
    hasOriginalBox,
    hasReceiptOrInvoice,
    isLocked,
    normalizedPrice: raw.price,
    confidenceNormalization: Math.min(confidence, 1.0),
  };
}

function parseIphoneModel(text: string): IphoneModel {
  // Ignora accessori, cover, custodie e pellicole
  if (/cover|coque|custodia|case|vetro|film|pellicola|cavo|cable|caricatore|charger|scatola vuota/i.test(text)) {
    return 'UNKNOWN';
  }
  if (/iphone\s*16\s*pro\s*max/i.test(text)) return 'IPHONE_16_PRO_MAX';
  if (/iphone\s*16\s*pro/i.test(text)) return 'IPHONE_16_PRO';
  if (/iphone\s*16\s*plus/i.test(text)) return 'IPHONE_16_PLUS';
  if (/iphone\s*16/i.test(text)) return 'IPHONE_16';

  if (/iphone\s*15\s*pro\s*max/i.test(text)) return 'IPHONE_15_PRO_MAX';
  if (/iphone\s*15\s*pro/i.test(text)) return 'IPHONE_15_PRO';
  if (/iphone\s*15\s*plus/i.test(text)) return 'IPHONE_15_PLUS';
  if (/iphone\s*15/i.test(text)) return 'IPHONE_15';

  if (/iphone\s*14\s*pro\s*max/i.test(text)) return 'IPHONE_14_PRO_MAX';
  if (/iphone\s*14\s*pro/i.test(text)) return 'IPHONE_14_PRO';
  if (/iphone\s*14\s*plus/i.test(text)) return 'IPHONE_14_PLUS';
  if (/iphone\s*14/i.test(text)) return 'IPHONE_14';

  if (/iphone\s*13\s*pro\s*max/i.test(text)) return 'IPHONE_13_PRO_MAX';
  if (/iphone\s*13\s*pro/i.test(text)) return 'IPHONE_13_PRO';
  if (/iphone\s*13\s*mini/i.test(text)) return 'IPHONE_13_MINI';
  if (/iphone\s*13/i.test(text)) return 'IPHONE_13';

  if (/iphone\s*12\s*pro\s*max/i.test(text)) return 'IPHONE_12_PRO_MAX';
  if (/iphone\s*12\s*pro/i.test(text)) return 'IPHONE_12_PRO';
  if (/iphone\s*12\s*mini/i.test(text)) return 'IPHONE_12_MINI';
  if (/iphone\s*12/i.test(text)) return 'IPHONE_12';

  if (/iphone\s*11\s*pro\s*max/i.test(text)) return 'IPHONE_11_PRO_MAX';
  if (/iphone\s*11\s*pro/i.test(text)) return 'IPHONE_11_PRO';
  if (/iphone\s*11/i.test(text)) return 'IPHONE_11';

  return 'UNKNOWN';
}

function parseStorageGb(text: string): number | null {
  const match = text.match(/\b(64|128|256|512|1024|1\s*tb)\s*(gb|giga|tb)?\b/i);
  if (!match) return null;
  const val = match[1].toLowerCase().replace(/\s*/g, '');
  if (val === '1tb') return 1024;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

function parseBatteryHealth(text: string): number | null {
  const match = text.match(/(?:batteria|battery|bat|stato|salute)\s*[:=]?\s*(\d{2,3})\s*%?/i) ||
                text.match(/(\d{2,3})\s*%\s*(?:batteria|battery|bat|stato|salute)?/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 50 && val <= 100) return val;
  }
  return null;
}

function parseCondition(text: string): ItemCondition {
  if (/sigillato|nuovo|sealed|mai aperto/i.test(text)) return 'NEW_SEALED';
  if (/come nuovo|impeccabile|perfetto|mint/i.test(text)) return 'LIKE_NEW';
  if (/ottime condizioni|ottimo|eccellente/i.test(text)) return 'EXCELLENT';
  if (/buone condizioni|buono|qualche segno/i.test(text)) return 'GOOD';
  if (/usato|graffi|segni d'uso|discreto/i.test(text)) return 'FAIR';
  if (/ricambi|rotto|guasto|parte|crepato|da riparare/i.test(text)) return 'FOR_PARTS_DAMAGED';
  return 'GOOD';
}
