import { describe, expect, it } from 'vitest';
import { calculateBenchmarkFromPricePoints } from '../src/benchmarks/benchmark-calculator.js';

describe('Benchmark Calculator', () => {
  it('calcola correttamente media e mediana rimuovendo gli outlier', () => {
    // Lista prezzi con un outlier evidente (10€ o 2000€)
    const rawPrices = [450, 480, 500, 510, 490, 520, 10, 2000];

    const benchmark = calculateBenchmarkFromPricePoints(
      'IPHONE_13_PRO',
      128,
      'EXCELLENT',
      rawPrices
    );

    expect(benchmark).not.toBeNull();
    expect(benchmark?.sampleCount).toBe(6); // 10€ e 2000€ rimossi come outlier
    expect(benchmark?.medianPrice).toBe(495);
    expect(benchmark?.avgPrice).toBe(491.67);
  });
});
