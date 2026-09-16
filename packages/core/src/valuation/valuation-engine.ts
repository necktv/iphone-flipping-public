import { NormalizedListing, ValuationResult } from '../types/domain.js';

// Prezzi base di mercato per riferimento/fallback V1 (Euro)
const BASE_FAIR_VALUES: Record<string, Record<number, number>> = {
  IPHONE_11: { 64: 200, 128: 240, 256: 280 },
  IPHONE_11_PRO: { 64: 260, 256: 310, 512: 360 },
  IPHONE_11_PRO_MAX: { 64: 310, 256: 360, 512: 410 },
  IPHONE_12_MINI: { 64: 230, 128: 270, 256: 310 },
  IPHONE_12: { 64: 270, 128: 310, 256: 360 },
  IPHONE_12_PRO: { 128: 360, 256: 410, 512: 460 },
  IPHONE_12_PRO_MAX: { 128: 430, 256: 480, 512: 540 },
  IPHONE_13_MINI: { 128: 360, 256: 410, 512: 460 },
  IPHONE_13: { 128: 410, 256: 460, 512: 520 },
  IPHONE_13_PRO: { 128: 520, 256: 580, 512: 660, 1024: 740 },
  IPHONE_13_PRO_MAX: { 128: 600, 256: 670, 512: 750, 1024: 830 },
  IPHONE_14: { 128: 500, 256: 560, 512: 640 },
  IPHONE_14_PLUS: { 128: 560, 256: 620, 512: 700 },
  IPHONE_14_PRO: { 128: 680, 256: 750, 512: 840, 1024: 920 },
  IPHONE_14_PRO_MAX: { 128: 760, 256: 830, 512: 920, 1024: 1020 },
  IPHONE_15: { 128: 640, 256: 720, 512: 820 },
  IPHONE_15_PLUS: { 128: 720, 256: 800, 512: 900 },
  IPHONE_15_PRO: { 128: 860, 256: 950, 512: 1060, 1024: 1180 },
  IPHONE_15_PRO_MAX: { 256: 1020, 512: 1140, 1024: 1260 },
};

export function calculateValuation(
  normalized: NormalizedListing,
  customBenchmarkPrice?: number
): ValuationResult {
  const modelKey = normalized.model;
  const storageKey = normalized.storageGb || 128;

  // Usa il benchmark dinamico da DB se disponibile, altrimenti ricorre alla matrice base V1
  let baseFair = customBenchmarkPrice || BASE_FAIR_VALUES[modelKey]?.[storageKey] || 350;

  // Modificatori salute batteria
  if (normalized.batteryHealthPct) {
    if (normalized.batteryHealthPct < 80) baseFair *= 0.85; // Necessita sostituzione batteria
    else if (normalized.batteryHealthPct >= 95) baseFair *= 1.05;
  }

  // Modificatori condizione
  switch (normalized.condition) {
    case 'NEW_SEALED': baseFair *= 1.20; break;
    case 'LIKE_NEW': baseFair *= 1.08; break;
    case 'EXCELLENT': baseFair *= 1.00; break;
    case 'GOOD': baseFair *= 0.92; break;
    case 'FAIR': baseFair *= 0.80; break;
    case 'FOR_PARTS_DAMAGED': baseFair *= 0.40; break;
  }

  if (normalized.hasOriginalBox) baseFair += 15;
  if (normalized.hasReceiptOrInvoice) baseFair += 15;

  const fairValue = Math.round(baseFair);
  const quickSaleValue = Math.round(fairValue * 0.88); // 12% sconto per vendita rapida entro 7gg

  const estimatedCosts = 15.0; // Stima spedizione e commissioni
  const estimatedProfit = Math.round((quickSaleValue - normalized.normalizedPrice - estimatedCosts) * 100) / 100;
  const roiPercentage = Math.round((estimatedProfit / normalized.normalizedPrice) * 10000) / 100;

  // Calcolo Risk Score (0 = sicuro, 1 = altissimo rischio)
  let riskScore = 0.1;
  if (normalized.isLocked) riskScore += 0.7;
  if (normalized.condition === 'FOR_PARTS_DAMAGED') riskScore += 0.5;
  if (!normalized.hasOriginalBox && !normalized.hasReceiptOrInvoice) riskScore += 0.15;
  if (normalized.batteryHealthPct && normalized.batteryHealthPct < 75) riskScore += 0.2;

  // Confidence Score
  const confidenceScore = Math.round(normalized.confidenceNormalization * 0.9 * 100) / 100;

  return {
    fairValue,
    quickSaleValue,
    estimatedProfit,
    roiPercentage,
    confidenceScore: Math.min(confidenceScore, 1.0),
    riskScore: Math.min(Math.round(riskScore * 100) / 100, 1.0),
    valuationModelVersion: 'V1-rule-engine-baseline',
  };
}
