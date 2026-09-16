import { NormalizedListing, ValuationResult } from '../types/domain.js';

/**
 * Valuation Engine V2 — Settembre 2026
 * 
 * Cambiamenti rispetto a V1:
 * - Aggiunto iPhone 16/16e/SE ai prezzi base
 * - Ridotto peso condizione (±10% invece di ±20%) — non ci fidiamo troppo
 * - Calcolo costo reale Vinted (Protezione Acquisti + Spedizione)
 * - Stima profitto netto più accurata
 */

// Prezzi base di mercato per riferimento/fallback V2 (Euro, Settembre 2026)
// Condizione di riferimento: EXCELLENT, senza scatola/scontrino
const BASE_FAIR_VALUES: Record<string, Record<number, number>> = {
  // iPhone SE
  IPHONE_SE_2: { 64: 120, 128: 150, 256: 180 },
  IPHONE_SE_3: { 64: 180, 128: 220, 256: 260 },

  // iPhone 11
  IPHONE_11: { 64: 200, 128: 240, 256: 280 },
  IPHONE_11_PRO: { 64: 260, 256: 310, 512: 360 },
  IPHONE_11_PRO_MAX: { 64: 310, 256: 360, 512: 410 },

  // iPhone 12
  IPHONE_12_MINI: { 64: 230, 128: 270, 256: 310 },
  IPHONE_12: { 64: 270, 128: 310, 256: 360 },
  IPHONE_12_PRO: { 128: 360, 256: 410, 512: 460 },
  IPHONE_12_PRO_MAX: { 128: 430, 256: 480, 512: 540 },

  // iPhone 13
  IPHONE_13_MINI: { 128: 320, 256: 370, 512: 420 },
  IPHONE_13: { 128: 370, 256: 420, 512: 480 },
  IPHONE_13_PRO: { 128: 470, 256: 530, 512: 610, 1024: 690 },
  IPHONE_13_PRO_MAX: { 128: 540, 256: 610, 512: 700, 1024: 780 },

  // iPhone 14
  IPHONE_14: { 128: 460, 256: 520, 512: 600 },
  IPHONE_14_PLUS: { 128: 520, 256: 580, 512: 660 },
  IPHONE_14_PRO: { 128: 620, 256: 700, 512: 790, 1024: 870 },
  IPHONE_14_PRO_MAX: { 128: 700, 256: 780, 512: 870, 1024: 960 },

  // iPhone 15
  IPHONE_15: { 128: 580, 256: 660, 512: 760 },
  IPHONE_15_PLUS: { 128: 660, 256: 740, 512: 840 },
  IPHONE_15_PRO: { 128: 800, 256: 890, 512: 1000, 1024: 1120 },
  IPHONE_15_PRO_MAX: { 256: 960, 512: 1080, 1024: 1200 },

  // iPhone 16
  IPHONE_16E: { 128: 480, 256: 540 },
  IPHONE_16: { 128: 600, 256: 680, 512: 780 },
  IPHONE_16_PLUS: { 128: 680, 256: 760, 512: 860 },
  IPHONE_16_PRO: { 128: 820, 256: 920, 512: 1040, 1024: 1160 },
  IPHONE_16_PRO_MAX: { 256: 980, 512: 1100, 1024: 1240 },
};

/**
 * Calcola il costo REALE di un acquisto su Vinted (prezzo + tasse + spedizione).
 * 
 * Vinted applica:
 * - Protezione Acquisti: 0.70€ fissi + 5% del prezzo dell'articolo
 * - Spedizione stimata: ~4.50€ (media Italia)
 */
function calculateVintedTotalCost(listingPrice: number): number {
  const buyerProtection = 0.70 + (listingPrice * 0.05);
  const estimatedShipping = 4.50;
  return Math.round((listingPrice + buyerProtection + estimatedShipping) * 100) / 100;
}

export function calculateValuation(
  normalized: NormalizedListing,
  customBenchmarkPrice?: number
): ValuationResult {
  const modelKey = normalized.model;
  const storageKey = normalized.storageGb || 128;

  // Usa il benchmark dinamico da DB se disponibile, altrimenti ricorre alla matrice base V2
  let baseFair = customBenchmarkPrice || BASE_FAIR_VALUES[modelKey]?.[storageKey] || 350;

  // Modificatori salute batteria (questi pesano molto, dati reali)
  if (normalized.batteryHealthPct) {
    if (normalized.batteryHealthPct < 80) {
      // Necessita sostituzione batteria (~80€ di costo)
      baseFair -= 80;
    } else if (normalized.batteryHealthPct < 85) {
      baseFair *= 0.92;
    } else if (normalized.batteryHealthPct >= 95) {
      baseFair *= 1.05;
    }
    // 85-94% = nessun modificatore, è nella norma
  }

  // Modificatori condizione (RIDOTTI — non ci fidiamo troppo dell'auto-rilevamento)
  switch (normalized.condition) {
    case 'NEW_SEALED': baseFair *= 1.10; break;   // era 1.20
    case 'LIKE_NEW': baseFair *= 1.05; break;      // era 1.08
    case 'EXCELLENT': baseFair *= 1.00; break;      // invariato
    case 'GOOD': baseFair *= 0.95; break;           // era 0.92
    case 'FAIR': baseFair *= 0.88; break;           // era 0.80
    case 'FOR_PARTS_DAMAGED': baseFair *= 0.40; break; // invariato, qui è ovvio
  }

  // Bonus scatola e scontrino
  if (normalized.hasOriginalBox) baseFair += 20;
  if (normalized.hasReceiptOrInvoice) baseFair += 20;

  const fairValue = Math.round(baseFair);
  const quickSaleValue = Math.round(fairValue * 0.88); // 12% sconto per vendita rapida entro 7gg

  // Costo reale Vinted (con tasse e spedizione)
  const totalCost = calculateVintedTotalCost(normalized.normalizedPrice);
  const estimatedProfit = Math.round((quickSaleValue - totalCost) * 100) / 100;
  const roiPercentage = Math.round((estimatedProfit / totalCost) * 10000) / 100;

  // Calcolo Risk Score (0 = sicuro, 1 = altissimo rischio)
  let riskScore = 0.1;
  if (normalized.isLocked) riskScore += 0.7;
  if (normalized.condition === 'FOR_PARTS_DAMAGED') riskScore += 0.5;
  if (!normalized.hasOriginalBox && !normalized.hasReceiptOrInvoice) riskScore += 0.1;
  if (normalized.batteryHealthPct && normalized.batteryHealthPct < 75) riskScore += 0.2;
  if (normalized.model === 'UNKNOWN') riskScore += 0.3;

  // Se il prezzo è troppo basso rispetto al fair value (possibile truffa)
  if (fairValue > 0 && normalized.normalizedPrice < fairValue * 0.4) {
    riskScore += 0.4; // Prezzo sospettosamente basso
  }

  // Confidence Score
  const confidenceScore = Math.round(normalized.confidenceNormalization * 0.9 * 100) / 100;

  return {
    fairValue,
    quickSaleValue,
    estimatedProfit,
    roiPercentage,
    confidenceScore: Math.min(confidenceScore, 1.0),
    riskScore: Math.min(Math.round(riskScore * 100) / 100, 1.0),
    valuationModelVersion: 'V2-rule-engine-2026',
  };
}
