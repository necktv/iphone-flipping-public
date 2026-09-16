import { IphoneModel, ItemCondition, MarketBenchmark } from '../types/domain.js';

export interface RawPricePoint {
  model: IphoneModel;
  storageGb: number;
  condition: ItemCondition;
  price: number;
}

/**
 * Calcola i dati aggregati di benchmark (media, mediana, min, max) scartando gli outlier
 */
export function calculateBenchmarkFromPricePoints(
  model: IphoneModel,
  storageGb: number,
  condition: ItemCondition,
  pricePoints: number[]
): MarketBenchmark | null {
  if (!pricePoints || pricePoints.length === 0) return null;

  // 1. Ordina i prezzi
  const sorted = [...pricePoints].sort((a, b) => a - b);

  // 2. Rimuovi gli outlier se abbiamo un numero sufficiente di campioni (metodo IQR)
  const filtered = removeOutliers(sorted);
  if (filtered.length === 0) return null;

  // 3. Calcola Statistiche
  const sum = filtered.reduce((acc, p) => acc + p, 0);
  const avgPrice = Math.round((sum / filtered.length) * 100) / 100;
  const medianPrice = Math.round(calculateMedian(filtered) * 100) / 100;
  const minPrice = filtered[0];
  const maxPrice = filtered[filtered.length - 1];

  return {
    model,
    storageGb,
    condition,
    avgPrice,
    medianPrice,
    minPrice,
    maxPrice,
    sampleCount: filtered.length,
    lastUpdatedAt: new Date(),
  };
}

function calculateMedian(sortedPrices: number[]): number {
  const mid = Math.floor(sortedPrices.length / 2);
  return sortedPrices.length % 2 !== 0
    ? sortedPrices[mid]
    : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
}

function removeOutliers(sortedPrices: number[]): number[] {
  if (sortedPrices.length < 4) return sortedPrices; // Non filtrare per campioni piccoli

  const q1 = calculateMedian(sortedPrices.slice(0, Math.floor(sortedPrices.length / 2)));
  const q3 = calculateMedian(sortedPrices.slice(Math.ceil(sortedPrices.length / 2)));
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return sortedPrices.filter((price) => price >= lowerBound && price <= upperBound);
}
