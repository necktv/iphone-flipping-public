import { IphoneModel, ItemCondition, NormalizedListing, RawListing } from '../types/domain.js';

/**
 * Parsing euristico per estrarre Modello, Storage, Batteria e Condizioni da titolo/descrizione.
 * 
 * Versione 2.0 — Settembre 2026
 * - Supporto completo iPhone SE 2/3, 11→16e (tutti i tagli Pro/Max/Plus/Mini)
 * - Regex robuste per varianti di scrittura (senza spazi, abbreviazioni, separatori)
 * - Anti-falsi-positivi batteria (ignora "88% sconto")
 * - Filtro anti-accessori potenziato
 */
export function normalizeIphoneListing(raw: RawListing): NormalizedListing {
  const fullText = `${raw.title} ${raw.description || ''}`;
  const lowerText = fullText.toLowerCase();

  // 1. Filtro anti-accessori: se è una cover/custodia, scarta subito
  if (isAccessory(lowerText)) {
    return buildResult('UNKNOWN', null, null, 'GOOD', false, false, false, raw.price, 0.1);
  }

  // 2. Modello iPhone
  const model = parseIphoneModel(lowerText);

  // 3. Storage GB
  const storageGb = parseStorageGb(lowerText);

  // 4. Percentuale Batteria
  const batteryHealthPct = parseBatteryHealth(lowerText);

  // 5. Condizioni
  const condition = parseCondition(lowerText);

  // 6. Scatola e Scontrino
  const hasOriginalBox = hasBox(lowerText);
  const hasReceiptOrInvoice = hasReceipt(lowerText);

  // 7. Blocco iCloud / SIM / Da riparare
  const isLocked = checkLocked(lowerText);

  // 8. Calcolo confidence
  let confidence = 0.4;
  if (model !== 'UNKNOWN') confidence += 0.35;
  if (storageGb !== null) confidence += 0.15;
  if (batteryHealthPct !== null) confidence += 0.10;

  return buildResult(model, storageGb, batteryHealthPct, condition, hasOriginalBox, hasReceiptOrInvoice, isLocked, raw.price, confidence);
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTRO ANTI-ACCESSORI
// ─────────────────────────────────────────────────────────────────────────────

const ACCESSORY_KEYWORDS = [
  'cover', 'coque', 'custodia', 'case', 'custodie',
  'vetro temperato', 'screen protector', 'pellicola', 'film protettivo',
  'cavo', 'cable', 'caricatore', 'charger', 'caricabatterie', 'alimentatore', 'adattatore',
  'scatola vuota', 'empty box', 'solo scatola', 'only box',
  'supporto', 'staffa', 'stand', 'dock', 'porta',
  'cuffie', 'airpods', 'auricolari', 'earpods',
  'adesivo', 'sticker', 'skin',
  'bumper', 'flip cover', 'portafoglio', 'wallet case',
  'protezione', 'protector', 'proteggi',
  'anello', 'ring', 'popsocket', 'grip',
  'lente', 'lens', 'camera protector',
];

/** Indicatori che è un vero telefono, non un accessorio */
const REAL_PHONE_INDICATORS = [
  'gb', 'go', 'tb', 'tera',
  'batteria', 'battery',
  'display', 'schermo', 'oled', 'retina',
  'fotocamera', 'camera', 'megapixel',
  'face id', 'touch id',
  'processore', 'chip', 'a15', 'a16', 'a17', 'a18',
  'sim', 'esim', 'dual sim',
  'usato', 'come nuovo', 'sigillato', 'seminuovo', 'ricondizionato',
  'funzionante', 'perfetto', 'ottimo stato',
];

function isAccessory(text: string): boolean {
  const hasAccessoryKeyword = ACCESSORY_KEYWORDS.some(kw => text.includes(kw));
  if (!hasAccessoryKeyword) return false;

  // Se contiene anche indicatori di telefono vero, NON è un accessorio
  const hasPhoneIndicator = REAL_PHONE_INDICATORS.some(ind => text.includes(ind));
  if (hasPhoneIndicator) return false;

  // Se contiene un prezzo > 80€ è probabilmente un telefono con una cover inclusa, non solo la cover
  // (questa logica viene gestita dal chiamante tramite il prezzo)

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// RICONOSCIMENTO MODELLO
// ─────────────────────────────────────────────────────────────────────────────

/** Separatore flessibile: spazio, trattino, underscore, o niente */
const SEP = `[\\s\\-_]*`;

/**
 * Genera una regex per un modello iPhone specifico.
 * Supporta: "iphone 13 pro max", "iphone13promax", "iphone-13-pro-max", "ip 13 pm"
 */
function modelRegex(gen: string, variant?: string): RegExp {
  const iphonePrefix = `(?:iphone|i-?phone|ip)${SEP}`;

  if (!variant) {
    // Modello base (es. iPhone 13): deve NON essere seguito da pro/max/plus/mini/e
    return new RegExp(`${iphonePrefix}${gen}(?!${SEP}(?:pro|max|plus|mini|e\\b))`, 'i');
  }

  // Gestione varianti speciali
  switch (variant) {
    case 'pro_max':
      return new RegExp(`${iphonePrefix}${gen}${SEP}(?:pro${SEP}max|pm)`, 'i');
    case 'pro':
      // "pro" ma NON seguito da "max"
      return new RegExp(`${iphonePrefix}${gen}${SEP}pro(?!${SEP}max)`, 'i');
    case 'plus':
      return new RegExp(`${iphonePrefix}${gen}${SEP}(?:plus|\\+)`, 'i');
    case 'mini':
      return new RegExp(`${iphonePrefix}${gen}${SEP}mini`, 'i');
    case 'e':
      return new RegExp(`${iphonePrefix}${gen}${SEP}e\\b`, 'i');
    default:
      return new RegExp(`${iphonePrefix}${gen}${SEP}${variant}`, 'i');
  }
}

/** Ordine di priorità: sempre dal più specifico al più generico */
const MODEL_PATTERNS: [RegExp, IphoneModel][] = [
  // iPhone SE
  [/(?:iphone|i-?phone|ip)[\s\-_]*se[\s\-_]*(?:3|2022|terza|third)/i, 'IPHONE_SE_3'],
  [/(?:iphone|i-?phone|ip)[\s\-_]*se[\s\-_]*(?:2|2020|seconda|second)/i, 'IPHONE_SE_2'],
  [/(?:iphone|i-?phone|ip)[\s\-_]*se\b/i, 'IPHONE_SE_3'],

  // iPhone 16
  [modelRegex('16', 'pro_max'), 'IPHONE_16_PRO_MAX'],
  [modelRegex('16', 'pro'),     'IPHONE_16_PRO'],
  [modelRegex('16', 'plus'),    'IPHONE_16_PLUS'],
  [modelRegex('16', 'e'),       'IPHONE_16E'],
  [modelRegex('16'),            'IPHONE_16'],

  // iPhone 15
  [modelRegex('15', 'pro_max'), 'IPHONE_15_PRO_MAX'],
  [modelRegex('15', 'pro'),     'IPHONE_15_PRO'],
  [modelRegex('15', 'plus'),    'IPHONE_15_PLUS'],
  [modelRegex('15'),            'IPHONE_15'],

  // iPhone 14
  [modelRegex('14', 'pro_max'), 'IPHONE_14_PRO_MAX'],
  [modelRegex('14', 'pro'),     'IPHONE_14_PRO'],
  [modelRegex('14', 'plus'),    'IPHONE_14_PLUS'],
  [modelRegex('14'),            'IPHONE_14'],

  // iPhone 13
  [modelRegex('13', 'pro_max'), 'IPHONE_13_PRO_MAX'],
  [modelRegex('13', 'pro'),     'IPHONE_13_PRO'],
  [modelRegex('13', 'mini'),    'IPHONE_13_MINI'],
  [modelRegex('13'),            'IPHONE_13'],

  // iPhone 12
  [modelRegex('12', 'pro_max'), 'IPHONE_12_PRO_MAX'],
  [modelRegex('12', 'pro'),     'IPHONE_12_PRO'],
  [modelRegex('12', 'mini'),    'IPHONE_12_MINI'],
  [modelRegex('12'),            'IPHONE_12'],

  // iPhone 11
  [modelRegex('11', 'pro_max'), 'IPHONE_11_PRO_MAX'],
  [modelRegex('11', 'pro'),     'IPHONE_11_PRO'],
  [modelRegex('11'),            'IPHONE_11'],
];

function parseIphoneModel(text: string): IphoneModel {
  for (const [regex, model] of MODEL_PATTERNS) {
    if (regex.test(text)) return model;
  }
  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────────────────────
// RICONOSCIMENTO STORAGE
// ─────────────────────────────────────────────────────────────────────────────

function parseStorageGb(text: string): number | null {
  // Pattern 1: Numero + unità esplicita (gb, go, giga, tb, tera)
  const explicitMatch = text.match(/\b(64|128|256|512|1024)\s*(?:gb|go|giga)\b/i)
    || text.match(/\b(1)\s*(?:tb|tera)\b/i);

  if (explicitMatch) {
    const val = parseInt(explicitMatch[1], 10);
    return val === 1 ? 1024 : val;
  }

  // Pattern 2: "1 tb" / "1tb" varianti
  if (/\b1\s*tb\b/i.test(text)) return 1024;

  // Pattern 3: Numero isolato vicino a un modello iPhone (es. "iPhone 13 128")
  // Cerchiamo un numero di storage valido che appare subito dopo il nome del modello
  const modelFollowedByStorage = text.match(
    /(?:iphone|i-?phone|ip)\s*\d{2}\s*(?:pro\s*max|pro|plus|mini|e)?\s*(64|128|256|512|1024)\b/i
  );
  if (modelFollowedByStorage) {
    return parseInt(modelFollowedByStorage[1], 10);
  }

  // Pattern 4: Slash format "128/256" — prendi il primo
  const slashMatch = text.match(/\b(64|128|256|512)(?:\s*\/\s*(?:64|128|256|512|1024))?\s*(?:gb|go)?\b/i);
  if (slashMatch && /gb|go|giga/i.test(text)) {
    return parseInt(slashMatch[1], 10);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RICONOSCIMENTO BATTERIA
// ─────────────────────────────────────────────────────────────────────────────

/** Parole che, se precedono o seguono un numero + %, indicano NON è una batteria */
const BATTERY_FALSE_POSITIVE_CONTEXT = [
  'sconto', 'off', 'ridotto', 'discount', 'sale', 'promo',
  'recensioni', 'feedback', 'vendite', 'valutazione', 'rating',
  'spedizione', 'shipping', 'consegna',
];

function parseBatteryHealth(text: string): number | null {
  // Pattern 1: "batteria XX%" / "battery health XX%" / "capacità massima XX%"
  const batteryPatterns = [
    /(?:batteria|battery|bat\.?|capacit[àa]\s*(?:massima)?|salute\s*(?:batteria)?|stato\s*batteria|battery\s*health)\s*[:=\-]?\s*(\d{2,3})\s*%/i,
    /(?:batteria|battery|bat\.?|capacit[àa]\s*(?:massima)?|salute\s*(?:batteria)?|stato\s*batteria|battery\s*health)\s*[:=\-]?\s*(\d{2,3})\s*(?:percento|per\s*cento)/i,
    /(?:batteria|battery|bat\.?)\s*[:=\-]?\s*al?\s*(\d{2,3})\s*%/i,
  ];

  for (const pattern of batteryPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 60 && val <= 100) return val;
    }
  }

  // Pattern 2: "XX% batteria" / "XX% battery" (numero prima della parola)
  const reversePattern = text.match(/(\d{2,3})\s*%\s*(?:di\s*)?(?:batteria|battery|bat\.?|capacit[àa]|salute)/i);
  if (reversePattern) {
    const val = parseInt(reversePattern[1], 10);
    if (val >= 60 && val <= 100) return val;
  }

  // Pattern 3: Numero isolato con % vicino a contesto batteria (finestra di 30 caratteri)
  const percentMatches = [...text.matchAll(/(\d{2,3})\s*%/gi)];
  for (const m of percentMatches) {
    const val = parseInt(m[1], 10);
    if (val < 60 || val > 100) continue;

    const matchIndex = m.index!;
    const windowStart = Math.max(0, matchIndex - 30);
    const windowEnd = Math.min(text.length, matchIndex + m[0].length + 30);
    const window = text.substring(windowStart, windowEnd).toLowerCase();

    // Controlla che il contesto menzioni la batteria
    const hasBatteryContext = /batter|bat\.|capacit|salute|health/i.test(window);
    if (!hasBatteryContext) continue;

    // Controlla che NON sia un falso positivo
    const isFalsePositive = BATTERY_FALSE_POSITIVE_CONTEXT.some(fp => window.includes(fp));
    if (isFalsePositive) continue;

    return val;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RICONOSCIMENTO CONDIZIONE
// ─────────────────────────────────────────────────────────────────────────────

function parseCondition(text: string): ItemCondition {
  // Ordine: dal più specifico (peggiore) al più generico
  // FOR_PARTS_DAMAGED — telefono rotto/non funzionante
  if (/ricambi|rotto|guasto|crepat|da riparare|non funziona|schermo rotto|vetro rotto|display rotto|face\s*id\s*non|non si accende|for\s*parts|broken|difettos|bloccato\s*(?:su|da)\s*icloud/i.test(text)) {
    return 'FOR_PARTS_DAMAGED';
  }

  // NEW_SEALED — telefono nuovo sigillato
  if (/sigillat|sealed|mai\s*apert|nuovo\s*(?:in\s*)?scatola|bnib|brand\s*new|mai\s*usat/i.test(text)) {
    return 'NEW_SEALED';
  }

  // LIKE_NEW — pari al nuovo
  if (/come\s*nuovo|pari\s*al\s*nuovo|semi\s*?nuovo|impeccabile|perfett(?:o|e|a)|mint|flawless|nessun\s*graffio|zero\s*graffi|senza\s*segni|condizioni\s*perfett|stato\s*perfett|ricondizionat/i.test(text)) {
    return 'LIKE_NEW';
  }

  // EXCELLENT — ottime condizioni
  if (/ottim[oae]\s*(?:condizion|stato)|eccellent|excellent|near\s*mint|ottime|ottimo/i.test(text)) {
    return 'EXCELLENT';
  }

  // FAIR — usato con segni visibili
  if (/graffi|graffio|ammaccat|segni\s*(?:d['']?\s*uso|evidenti|visibili)|discreto|fair|used|usat/i.test(text)) {
    return 'FAIR';
  }

  // GOOD — condizione default: buono stato
  if (/buon[oae]\s*(?:condizion|stato)|qualche\s*segn|liev[ei]\s*segn|piccol[ei]\s*segn|good\s*condition/i.test(text)) {
    return 'GOOD';
  }

  // Default: GOOD (non ci fidiamo troppo della condizione auto-rilevata)
  return 'GOOD';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function hasBox(text: string): boolean {
  if (/senza\s*scatola|no\s*box|senza\s*confezione/i.test(text)) return false;
  return /scatola\s*(?:originale)?|box\s*(?:originale)?|confezione\s*(?:originale)?/i.test(text);
}

function hasReceipt(text: string): boolean {
  return /scontrino|fattura|ricevuta|garanzia|apple\s*care|invoice|receipt|warranty/i.test(text);
}

function checkLocked(text: string): boolean {
  return /icloud\s*(?:lock|bloccato)|bloccato\s*(?:operatore|icloud)|blacklist|rubato|stolen|locked|parti\s*di\s*ricambio|per\s*ricambi|for\s*parts/i.test(text);
}

function buildResult(
  model: IphoneModel,
  storageGb: number | null,
  batteryHealthPct: number | null,
  condition: ItemCondition,
  hasOriginalBox: boolean,
  hasReceiptOrInvoice: boolean,
  isLocked: boolean,
  price: number,
  confidence: number,
): NormalizedListing {
  return {
    model,
    storageGb,
    batteryHealthPct,
    condition,
    hasOriginalBox,
    hasReceiptOrInvoice,
    isLocked,
    normalizedPrice: price,
    confidenceNormalization: Math.min(confidence, 1.0),
  };
}
