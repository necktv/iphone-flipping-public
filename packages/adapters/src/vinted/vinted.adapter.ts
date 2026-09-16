import { Browser, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

import { RawListing, RawListingSchema } from '@iphone-flipping/core';
import { FetchQueryOptions, MarketplaceAdapter } from '../base.adapter.js';
import { VintedCatalogResponseSchema, VintedItem } from './vinted.types.js';

export class VintedAdapter implements MarketplaceAdapter {
  readonly marketplaceName = 'vinted';

  private browser: Browser | null = null;

  constructor(private readonly headless: boolean = true) {}

  async checkHealth(): Promise<boolean> {
    try {
      const launchOptions: any = { headless: this.headless };
      if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      }
      const browser = await chromium.launch(launchOptions);
      await browser.close();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Effettua lo scraping della ricerca di Vinted Italia per iPhone
   */
  async fetchLatestListings(options: FetchQueryOptions = {}): Promise<RawListing[]> {
    const query = options.searchQuery || 'iphone 13';
    const minPrice = options.minPrice || 100;
    const maxPrice = options.maxPrice || 1000;
    const maxPages = options.maxPages || 1;

    const listings: RawListing[] = [];

    const launchOptions: any = {
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }

    if (process.env.PROXY_URL) {
      launchOptions.proxy = { server: process.env.PROXY_URL };
      console.log(`[VintedAdapter] Utilizzo proxy per la connessione...`);
    }
    
    this.browser = await chromium.launch(launchOptions);

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'it-IT',
      extraHTTPHeaders: {
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const page = await context.newPage();

    try {
      for (let p = 1; p <= maxPages; p++) {
        const searchUrl = this.buildSearchUrl(query, minPrice, maxPrice, p);
        
        // Strategia 1: Intercettazione risposta Network dell'endpoint API Vinted
        let interceptedItems: VintedItem[] = [];
        
        const responseHandler = async (response: any) => {
          if (response.url().includes('/api/v2/catalog/items')) {
            try {
              const body = await response.json();
              const parsed = VintedCatalogResponseSchema.safeParse(body);
              if (parsed.success) {
                interceptedItems = parsed.data.items;
              }
            } catch {
              // Ignore non-json responses
            }
          }
        };

        page.on('response', responseHandler);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Wait specifically for at least one product item to appear, or a short timeout
        try {
          await page.waitForSelector('[data-testid^="product-item-id-"]', { state: 'attached', timeout: 10000 });
        } catch (e) {
          console.warn(`[VintedAdapter] Timeout attesa elementi, provo ad analizzare il DOM ugualmente...`);
        }
        
        // Aspettiamo un paio di secondi extra per far finire le API interne di react/vinted
        await page.waitForTimeout(2000);

        page.off('response', responseHandler);

        if (interceptedItems.length > 0) {
          for (const item of interceptedItems) {
            const raw = this.mapVintedItemToRawListing(item);
            if (raw) listings.push(raw);
          }
        } else {
          // Strategia 2 (Fallback): DOM Parsing con selettori aggiornati 2026
          const domListings = await this.parseListingsFromDOM(page);
          listings.push(...domListings);
        }
      }
    } finally {
      await context.close();
      await this.browser.close();
      this.browser = null;
    }

    return listings;
  }

  private buildSearchUrl(query: string, minPrice: number, maxPrice: number, page: number): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.vinted.it/catalog?search_text=${encodedQuery}&order=newest_first&price_from=${minPrice}&price_to=${maxPrice}&page=${page}`;
  }

  /**
   * Mappa un oggetto JSON nativo Vinted in una RawListing validata da Zod
   */
  public mapVintedItemToRawListing(item: VintedItem): RawListing | null {
    try {
      const priceNum = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      if (isNaN(priceNum) || priceNum <= 0) return null;

      const fullUrl = item.url.startsWith('http') ? item.url : `https://www.vinted.it${item.url}`;

      const rawObj = {
        marketplace: this.marketplaceName,
        externalId: String(item.id),
        url: fullUrl,
        title: item.title,
        description: item.description || '',
        price: priceNum,
        currency: item.currency || 'EUR',
        sellerName: item.user?.login,
        sellerRating: item.user?.feedback_reputation,
        images: item.photos.map((p) => p.full_size_url || p.url),
        publishedAt: item.created_at_ts ? new Date(Number(item.created_at_ts) * 1000) : new Date(),
        rawMetadata: {
          vintedStatus: item.status,
          userId: item.user?.id,
        },
      };

      const parsed = RawListingSchema.safeParse(rawObj);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /**
   * DOM Parsing aggiornato per Vinted 2026.
   * Usa data-testid="product-item-id-XXXXX" per trovare le card prodotto.
   */
  private async parseListingsFromDOM(page: Page): Promise<RawListing[]> {
    const items = await page.evaluate(() => {
      const results: { externalId: string; url: string; title: string; description: string; price: number; imageUrl: string }[] = [];
      const cards = document.querySelectorAll('[data-testid^="product-item-id-"]');

      for (const card of cards) {
        const testId = card.getAttribute('data-testid') || '';
        // Prendi solo i container principali (non i sotto-elementi come --image)
        const idMatch = testId.match(/^product-item-id-(\d+)$/);
        if (!idMatch) continue;

        const externalId = idMatch[1];

        // Link all'annuncio
        const linkEl = card.querySelector('a[href*="/items/"]') as HTMLAnchorElement;
        const href = linkEl?.getAttribute('href') || '';
        const titleAttr = linkEl?.getAttribute('title') || '';

        // Prezzo dal testo della card
        const cardText = card.textContent || '';
        const priceMatches = cardText.match(/(\d+[.,]\d{2})\s*€/g);
        let price = 0;
        if (priceMatches && priceMatches.length > 0) {
          price = parseFloat(priceMatches[0].replace('€', '').replace(',', '.').trim());
        }

        // Fallback: prezzo dall'alt dell'immagine
        if (price === 0) {
          const imgEl = card.querySelector('img');
          const alt = imgEl?.getAttribute('alt') || '';
          const altMatch = alt.match(/(\d+[.,]\d{2})\s*€/);
          if (altMatch) {
            price = parseFloat(altMatch[1].replace(',', '.'));
          }
        }

        if (!href || price <= 0) continue;

        const fullUrl = href.startsWith('http') ? href : `https://www.vinted.it${href}`;

        // Titolo pulito: prima parte dell'attributo title (prima della virgola con i metadati)
        const cleanTitle = titleAttr.split(', Brand:')[0].trim() || titleAttr.split(',')[0].trim() || cardText.trim().split('\n')[0];

        // Immagine principale
        const imgEl = card.querySelector('img');
        const imageUrl = imgEl?.getAttribute('src') || '';

        results.push({
          externalId,
          url: fullUrl,
          title: cleanTitle,
          description: titleAttr, // Contiene info extra: Brand, Modello, Condizioni, Prezzo
          price,
          imageUrl,
        });
      }

      return results;
    });

    const listings: RawListing[] = [];

    for (const item of items) {
      const rawObj = {
        marketplace: this.marketplaceName,
        externalId: item.externalId,
        url: item.url,
        title: item.title,
        description: item.description,
        price: item.price,
        currency: 'EUR',
        images: item.imageUrl ? [item.imageUrl] : [],
        publishedAt: new Date(),
        rawMetadata: { scrapedVia: 'DOM_2026' },
      };

      const parsed = RawListingSchema.safeParse(rawObj);
      if (parsed.success) {
        listings.push(parsed.data);
      }
    }

    return listings;
  }
}
