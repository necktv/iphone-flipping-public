/**
 * Notifier — Invio notifiche Telegram per opportunità di flipping.
 * 
 * Usa direttamente l'API HTTP di Telegram (nessuna libreria esterna necessaria).
 */

import { ScannerConfig } from './config.js';

export type OpportunityType = 'NEW_LISTING' | 'PRICE_DROP';

export interface OpportunityAlert {
  type: OpportunityType;
  title: string;
  model: string;
  storageGb: number | null;
  condition: string;
  currentPrice: number;
  fairValue: number;
  quickSaleValue: number;
  estimatedProfit: number;
  roiPercentage: number;
  riskScore: number;
  url: string;
  /** Solo per PRICE_DROP */
  oldPrice?: number;
  priceChangePct?: number;
}

export class TelegramNotifier {
  private readonly apiBase: string;
  private readonly chatId: string;
  private readonly enabled: boolean;

  constructor(config: ScannerConfig) {
    this.apiBase = `https://api.telegram.org/bot${config.telegramBotToken}`;
    this.chatId = config.telegramChatId;
    this.enabled = config.telegramEnabled;
  }

  /**
   * Invia una notifica di opportunità trovata.
   */
  async sendOpportunityAlert(alert: OpportunityAlert): Promise<void> {
    if (!this.enabled) {
      console.log(`[Notifier] Telegram disabilitato — alert non inviato per: ${alert.title}`);
      return;
    }

    const message = this.formatMessage(alert);

    try {
      const response = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Notifier] Errore Telegram API (${response.status}): ${errorBody}`);
      } else {
        console.log(`[Notifier] ✅ Alert Telegram inviato: ${alert.model} @ €${alert.currentPrice}`);
      }
    } catch (error) {
      console.error(`[Notifier] Errore invio Telegram:`, error);
    }
  }

  /**
   * Invia un riepilogo del ciclo di scansione.
   */
  async sendCycleSummary(stats: {
    totalProcessed: number;
    newListings: number;
    priceDrops: number;
    opportunitiesCreated: number;
    durationSeconds: number;
  }): Promise<void> {
    if (!this.enabled || stats.opportunitiesCreated === 0) return;

    const message = [
      `📊 <b>Riepilogo Scansione</b>`,
      ``,
      `📋 Annunci processati: ${stats.totalProcessed}`,
      `🆕 Nuovi: ${stats.newListings}`,
      `📉 Price drops: ${stats.priceDrops}`,
      `🔥 Opportunità create: <b>${stats.opportunitiesCreated}</b>`,
      `⏱ Durata: ${stats.durationSeconds}s`,
      `⏰ ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`,
    ].join('\n');

    try {
      await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });
    } catch (error) {
      console.error(`[Notifier] Errore invio riepilogo:`, error);
    }
  }

  private formatMessage(alert: OpportunityAlert): string {
    const typeEmoji = alert.type === 'NEW_LISTING' ? '🆕' : '📉';
    const typeLabel = alert.type === 'NEW_LISTING' ? 'NUOVO ANNUNCIO' : 'PRICE DROP';

    const storageStr = alert.storageGb ? `${alert.storageGb}GB` : '';
    const modelClean = alert.model.replace(/_/g, ' ');

    const lines: string[] = [
      `🔥 <b>AFFARE TROVATO!</b>`,
      ``,
      `${typeEmoji} Tipo: <b>${typeLabel}</b>`,
      `📱 ${modelClean} ${storageStr} (${alert.condition})`,
      `💰 Prezzo: <b>€${alert.currentPrice}</b> (Fair Value: €${alert.fairValue})`,
      `📊 ROI: <b>+${alert.roiPercentage.toFixed(1)}%</b>  |  Profitto: ~€${alert.estimatedProfit.toFixed(0)}`,
    ];

    if (alert.type === 'PRICE_DROP' && alert.oldPrice != null && alert.priceChangePct != null) {
      lines.push(`📉 Ribasso: ${alert.priceChangePct.toFixed(1)}% (da €${alert.oldPrice})`);
    }

    const riskLabel = alert.riskScore <= 0.2 ? '🟢 Basso' : alert.riskScore <= 0.4 ? '🟡 Medio' : '🟠 Alto';
    lines.push(`⚠️ Rischio: ${riskLabel} (${alert.riskScore})`);

    lines.push(``);
    lines.push(`🔗 <a href="${alert.url}">Vedi annuncio su Vinted</a>`);
    lines.push(``);
    lines.push(`⏰ ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`);

    return lines.join('\n');
  }
}
