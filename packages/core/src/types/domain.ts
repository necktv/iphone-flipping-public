import { z } from 'zod';

// Enum per Modelli iPhone
export const IphoneModelEnum = z.enum([
  'IPHONE_SE_2', 'IPHONE_SE_3',
  'IPHONE_11', 'IPHONE_11_PRO', 'IPHONE_11_PRO_MAX',
  'IPHONE_12_MINI', 'IPHONE_12', 'IPHONE_12_PRO', 'IPHONE_12_PRO_MAX',
  'IPHONE_13_MINI', 'IPHONE_13', 'IPHONE_13_PRO', 'IPHONE_13_PRO_MAX',
  'IPHONE_14', 'IPHONE_14_PLUS', 'IPHONE_14_PRO', 'IPHONE_14_PRO_MAX',
  'IPHONE_15', 'IPHONE_15_PLUS', 'IPHONE_15_PRO', 'IPHONE_15_PRO_MAX',
  'IPHONE_16E', 'IPHONE_16', 'IPHONE_16_PLUS', 'IPHONE_16_PRO', 'IPHONE_16_PRO_MAX',
  'UNKNOWN'
]);
export type IphoneModel = z.infer<typeof IphoneModelEnum>;

// Enum per Condizioni Oggetto
export const ItemConditionEnum = z.enum([
  'NEW_SEALED',
  'LIKE_NEW',
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'FOR_PARTS_DAMAGED'
]);
export type ItemCondition = z.infer<typeof ItemConditionEnum>;

// Enum per Stato Opportunità
export const OpportunityStatusEnum = z.enum([
  'NEW',
  'REVIEW',
  'BUY',
  'PASS',
  'PURCHASED',
  'REJECTED',
  'EXPIRED'
]);
export type OpportunityStatus = z.infer<typeof OpportunityStatusEnum>;

// 1. Raw Listing (estratto dall'adapter)
export const RawListingSchema = z.object({
  marketplace: z.string(),
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('EUR'),
  location: z.string().optional(),
  sellerName: z.string().optional(),
  sellerRating: z.number().optional(),
  images: z.array(z.string()).default([]),
  publishedAt: z.date().optional(),
  rawMetadata: z.record(z.unknown()).default({}),
});
export type RawListing = z.infer<typeof RawListingSchema>;

// 2. Normalized Listing (dati parsati e strutturati)
export const NormalizedListingSchema = z.object({
  model: IphoneModelEnum,
  storageGb: z.number().int().positive().nullable(),
  batteryHealthPct: z.number().min(0).max(100).nullable(),
  condition: ItemConditionEnum,
  hasOriginalBox: z.boolean().default(false),
  hasReceiptOrInvoice: z.boolean().default(false),
  isLocked: z.boolean().default(false),
  normalizedPrice: z.number().positive(),
  confidenceNormalization: z.number().min(0).max(1),
});
export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;

// 3. Valuation Result (stima finanziaria e punteggi)
export const ValuationResultSchema = z.object({
  fairValue: z.number().positive(),
  quickSaleValue: z.number().positive(),
  estimatedProfit: z.number(),
  roiPercentage: z.number(),
  confidenceScore: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(1),
  valuationModelVersion: z.string(),
});
export type ValuationResult = z.infer<typeof ValuationResultSchema>;

// 4. Market Benchmark (Dati di riferimento dallo Scraper A)
export const MarketBenchmarkSchema = z.object({
  model: IphoneModelEnum,
  storageGb: z.number().int().positive(),
  condition: ItemConditionEnum.default('EXCELLENT'),
  avgPrice: z.number().positive(),
  medianPrice: z.number().positive(),
  minPrice: z.number().positive(),
  maxPrice: z.number().positive(),
  sampleCount: z.number().int().nonnegative(),
  lastUpdatedAt: z.date().optional(),
});
export type MarketBenchmark = z.infer<typeof MarketBenchmarkSchema>;

// 4. Opportunity completa
export const OpportunitySchema = z.object({
  id: z.string().uuid().optional(),
  rawListing: RawListingSchema,
  normalized: NormalizedListingSchema,
  valuation: ValuationResultSchema,
  status: OpportunityStatusEnum.default('NEW'),
  userNotes: z.string().optional(),
  evaluatedAt: z.date().default(() => new Date()),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;
