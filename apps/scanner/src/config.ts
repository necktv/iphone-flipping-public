/**
 * Configurazione centralizzata dello Scanner.
 * Tutti i valori sono configurabili via variabili d'ambiente con default sensati.
 */

export interface ScannerConfig {
  /** Intervallo tra un ciclo completo e l'altro, in minuti */
  scanIntervalMinutes: number;

  /** Pausa tra la scansione di un modello e il successivo (ms) — anti-ban */
  delayBetweenModelsMs: number;

  /** ROI minimo (%) per considerare un annuncio come opportunità */
  minRoiThreshold: number;

  /** Profitto minimo (€) per considerare un annuncio come opportunità */
  minProfitThreshold: number;

  /** Ribasso minimo (%) per triggerare una ri-valutazione su price-drop */
  minPriceDropPctThreshold: number;

  /** Prezzo massimo di ricerca su Vinted */
  maxSearchPrice: number;

  /** Prezzo minimo di ricerca su Vinted */
  minSearchPrice: number;

  /** Numero massimo di pagine da scansionare per ogni query */
  maxPagesPerQuery: number;

  /** Query di ricerca da eseguire su Vinted (una per ogni modello/famiglia) */
  searchQueries: string[];

  /** Telegram Bot Token */
  telegramBotToken: string;

  /** Telegram Chat ID dove inviare le notifiche */
  telegramChatId: string;

  /** Abilita/disabilita le notifiche Telegram */
  telegramEnabled: boolean;
}

export function loadConfig(): ScannerConfig {
  return {
    scanIntervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '10', 10),
    delayBetweenModelsMs: parseInt(process.env.SCAN_DELAY_BETWEEN_MODELS_MS || '20000', 10),
    minRoiThreshold: parseFloat(process.env.MIN_ROI_THRESHOLD || '15'),
    minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '50'),
    minPriceDropPctThreshold: parseFloat(process.env.MIN_PRICE_DROP_PCT_THRESHOLD || '5'),
    maxSearchPrice: parseInt(process.env.SCAN_MAX_PRICE || '1200', 10),
    minSearchPrice: parseInt(process.env.SCAN_MIN_PRICE || '80', 10),
    maxPagesPerQuery: parseInt(process.env.SCAN_MAX_PAGES || '2', 10),
    searchQueries: (process.env.SCAN_QUERIES || 'iphone 13,iphone 13 pro,iphone 14,iphone 14 pro,iphone 15,iphone 15 pro,iphone 16,iphone 16 pro,iphone 16e').split(',').map(s => s.trim()),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    telegramEnabled: process.env.TELEGRAM_ENABLED !== 'false' && !!process.env.TELEGRAM_BOT_TOKEN,
  };
}
