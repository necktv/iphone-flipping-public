import { createHash } from 'crypto';
import { NormalizedListing, RawListing } from '../types/domain.js';

/**
 * Genera un hash unico per la deduplicazione dell'annuncio
 */
export function generateListingDedupHash(raw: RawListing, normalized?: NormalizedListing): string {
  // Hash primario: marketplace + externalId
  const primaryKey = `${raw.marketplace}:${raw.externalId}`.toLowerCase();
  
  // Impronta digitale secondaria basata sui dati normalizzati se disponibili
  const fingerprint = normalized
    ? `${normalized.model}:${normalized.storageGb || 0}:${normalized.normalizedPrice}:${raw.sellerName || ''}`.toLowerCase()
    : `${raw.title}:${raw.price}`.toLowerCase();

  return createHash('sha256')
    .update(`${primaryKey}|${fingerprint}`)
    .digest('hex');
}
