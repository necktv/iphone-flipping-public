import { z } from 'zod';

// Tipi per la risposta dell'endpoint API interno Vinted (/api/v2/catalog/items)
export const VintedPhotoSchema = z.object({
  id: z.number(),
  url: z.string(),
  full_size_url: z.string().optional(),
});

export const VintedUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  feedback_reputation: z.number().optional(),
});

export const VintedItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.union([z.string(), z.number()]),
  currency: z.string().default('EUR'),
  url: z.string(),
  description: z.string().optional(),
  photos: z.array(VintedPhotoSchema).default([]),
  user: VintedUserSchema.optional(),
  status: z.string().optional(),
  created_at_ts: z.union([z.string(), z.number()]).optional(),
});

export const VintedCatalogResponseSchema = z.object({
  items: z.array(VintedItemSchema).default([]),
  pagination: z.object({
    current_page: z.number().optional(),
    total_pages: z.number().optional(),
  }).optional(),
});

export type VintedItem = z.infer<typeof VintedItemSchema>;
export type VintedCatalogResponse = z.infer<typeof VintedCatalogResponseSchema>;
