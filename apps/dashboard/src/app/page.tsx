'use client';

import React, { useEffect, useState, useCallback } from 'react';

// --- INTERFACES ---
interface Opportunity { opportunity_id: string; fair_value: string; quick_sale_value: string; estimated_profit: string; roi_percentage: string; status: string; marketplace: string; title: string; url: string; price: string; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; images: string[]; }
interface ScoredListing { listing_id: string; marketplace: string; title: string; description: string; url: string; price: string; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; images: string[]; published_at: string; created_at: string; has_original_box: boolean; has_receipt_or_invoice: boolean; is_locked: boolean; p50_price: string | null; p25_price: string | null; }
interface UserPricing { id: string; model: string; storage_gb: number; p50_price: string; p25_price: string; updated_at: string; }

// --- COSTANTI ---
const VINTED_PROTECTION_FIXED = 0.70;
const VINTED_PROTECTION_PCT = 0.05;
const ESTIMATED_SHIPPING = 4.50;
const RESELL_FEE = 0; // Subito.it è gratis, configurabile

// Costo sostituzione batteria (fai-da-te)
const BATTERY_COST_OLD = 15;  // iPhone 11, 12, 13, SE
const BATTERY_COST_NEW = 25;  // iPhone 14, 15, 16

/** Modelli "nuovi" che costano di più per la batteria */
const NEW_BATTERY_MODELS = ['IPHONE_14', 'IPHONE_14_PLUS', 'IPHONE_14_PRO', 'IPHONE_14_PRO_MAX', 'IPHONE_15', 'IPHONE_15_PLUS', 'IPHONE_15_PRO', 'IPHONE_15_PRO_MAX', 'IPHONE_16E', 'IPHONE_16', 'IPHONE_16_PLUS', 'IPHONE_16_PRO', 'IPHONE_16_PRO_MAX'];

function getBatteryCost(model: string): number {
  return NEW_BATTERY_MODELS.includes(model) ? BATTERY_COST_NEW : BATTERY_COST_OLD;
}

function vintedTotalCost(price: number): number {
  return price + VINTED_PROTECTION_FIXED + (price * VINTED_PROTECTION_PCT) + ESTIMATED_SHIPPING;
}

// --- MODELLI ---
const IPHONE_MODELS = [
  { label: 'Tutti i Modelli', value: '' },
  { label: 'iPhone SE (2ª)', value: 'IPHONE_SE_2' }, { label: 'iPhone SE (3ª)', value: 'IPHONE_SE_3' },
  { label: 'iPhone 11', value: 'IPHONE_11' }, { label: 'iPhone 11 Pro', value: 'IPHONE_11_PRO' }, { label: 'iPhone 11 Pro Max', value: 'IPHONE_11_PRO_MAX' },
  { label: 'iPhone 12 Mini', value: 'IPHONE_12_MINI' }, { label: 'iPhone 12', value: 'IPHONE_12' }, { label: 'iPhone 12 Pro', value: 'IPHONE_12_PRO' }, { label: 'iPhone 12 Pro Max', value: 'IPHONE_12_PRO_MAX' },
  { label: 'iPhone 13 Mini', value: 'IPHONE_13_MINI' }, { label: 'iPhone 13', value: 'IPHONE_13' }, { label: 'iPhone 13 Pro', value: 'IPHONE_13_PRO' }, { label: 'iPhone 13 Pro Max', value: 'IPHONE_13_PRO_MAX' },
  { label: 'iPhone 14', value: 'IPHONE_14' }, { label: 'iPhone 14 Plus', value: 'IPHONE_14_PLUS' }, { label: 'iPhone 14 Pro', value: 'IPHONE_14_PRO' }, { label: 'iPhone 14 Pro Max', value: 'IPHONE_14_PRO_MAX' },
  { label: 'iPhone 15', value: 'IPHONE_15' }, { label: 'iPhone 15 Plus', value: 'IPHONE_15_PLUS' }, { label: 'iPhone 15 Pro', value: 'IPHONE_15_PRO' }, { label: 'iPhone 15 Pro Max', value: 'IPHONE_15_PRO_MAX' },
  { label: 'iPhone 16e', value: 'IPHONE_16E' }, { label: 'iPhone 16', value: 'IPHONE_16' }, { label: 'iPhone 16 Plus', value: 'IPHONE_16_PLUS' }, { label: 'iPhone 16 Pro', value: 'IPHONE_16_PRO' }, { label: 'iPhone 16 Pro Max', value: 'IPHONE_16_PRO_MAX' },
];

// Modelli per il listino prezzi (senza "Tutti")
const PRICING_MODELS = IPHONE_MODELS.filter(m => m.value !== '');
const STORAGE_OPTIONS = [64, 128, 256, 512, 1024];

function formatModelName(model: string): string {
  const entry = IPHONE_MODELS.find(m => m.value === model);
  if (entry) return entry.label;
  if (model === 'UNKNOWN') return 'Non riconosciuto';
  return model.replace('IPHONE_', 'iPhone ').replace(/_/g, ' ');
}

function formatCondition(condition: string): { label: string; color: string } {
  switch (condition) {
    case 'NEW_SEALED': return { label: 'Nuovo Sigillato', color: 'bg-emerald-500/20 text-emerald-400' };
    case 'LIKE_NEW': return { label: 'Come Nuovo', color: 'bg-green-500/20 text-green-400' };
    case 'EXCELLENT': return { label: 'Eccellente', color: 'bg-sky-500/20 text-sky-400' };
    case 'GOOD': return { label: 'Buono', color: 'bg-slate-500/20 text-slate-300' };
    case 'FAIR': return { label: 'Discreto', color: 'bg-amber-500/20 text-amber-400' };
    case 'FOR_PARTS_DAMAGED': return { label: 'Ricambi / Rotto', color: 'bg-red-500/20 text-red-400' };
    default: return { label: condition, color: 'bg-slate-500/20 text-slate-300' };
  }
}

function batteryColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-red-400';
}

/** Calcola il Flipping Score 0-100 */
function calculateFlippingScore(item: ScoredListing): { score: number; profitP25: number; profitP50: number; totalCost: number } | null {
  if (!item.p25_price || !item.p50_price) return null;
  
  const price = parseFloat(item.price);
  const p25 = parseFloat(item.p25_price);
  const p50 = parseFloat(item.p50_price);
  const totalCost = vintedTotalCost(price);
  
  // Se batteria < 80%, aggiungi costo sostituzione ma anche boost di rivendita (+batteria nuova!)
  let batteryCost = 0;
  let batteryResaleBoost = 0;
  if (item.battery_health_pct && item.battery_health_pct < 80) {
    batteryCost = getBatteryCost(item.model);
    // Con batteria nuova al 100% il telefono vale di più: circa +30€ rispetto a uno con batteria 80%
    batteryResaleBoost = 30;
  }

  const profitP25 = (p25 + batteryResaleBoost) - totalCost - batteryCost - RESELL_FEE;
  const profitP50 = (p50 + batteryResaleBoost) - totalCost - batteryCost - RESELL_FEE;
  const roiP25 = (profitP25 / (totalCost + batteryCost)) * 100;

  // Score: 40% margine P25, 25% ROI, 15% batteria/opportunità, 20% rischio
  let score = 0;

  // Margine P25 (40 punti max)
  if (profitP25 >= 100) score += 40;
  else if (profitP25 >= 50) score += 30;
  else if (profitP25 >= 20) score += 20;
  else if (profitP25 > 0) score += 10;
  else score += 0;

  // ROI (25 punti max)
  if (roiP25 >= 30) score += 25;
  else if (roiP25 >= 20) score += 20;
  else if (roiP25 >= 10) score += 15;
  else if (roiP25 >= 5) score += 8;
  else score += 0;

  // Batteria (15 punti max)
  // TRUCCO: batteria bassa NON è una penalità per chi sa cambiarla!
  if (item.battery_health_pct) {
    if (item.battery_health_pct >= 90) score += 15;      // Batteria ottima, nessun lavoro
    else if (item.battery_health_pct >= 80) score += 10;  // Ancora ok
    else if (item.battery_health_pct >= 70) score += 12;  // OPPORTUNITÀ: la gente fugge, tu guadagni
    else score += 8;                                       // Molto bassa, ma cambi a 15€
  } else {
    score += 7; // Sconosciuto = neutro
  }

  // Rischio (20 punti max — si parte da 20 e si tolgono punti)
  let riskPoints = 20;
  if (item.is_locked) riskPoints -= 15;
  if (item.condition === 'FOR_PARTS_DAMAGED') riskPoints -= 12;
  if (price < p50 * 0.4) riskPoints -= 10; // Prezzo sospetto
  if (!item.has_original_box && !item.has_receipt_or_invoice) riskPoints -= 3;
  score += Math.max(0, riskPoints);

  return { score: Math.min(100, Math.max(0, score)), profitP25, profitP50, totalCost, batteryCost };
}

function scoreColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500 text-white';
  if (score >= 70) return 'bg-green-500 text-white';
  if (score >= 50) return 'bg-yellow-500 text-slate-900';
  if (score >= 30) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
}

function scoreBorder(score: number): string {
  if (score >= 85) return 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
  if (score >= 70) return 'border-green-500/40';
  if (score >= 50) return 'border-yellow-500/30';
  return 'border-slate-700';
}

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState<'FEED' | 'DEALS' | 'PRICING'>('FEED');
  const [loading, setLoading] = useState(false);

  // FEED STATE
  const [listings, setListings] = useState<ScoredListing[]>([]);
  const [feedModel, setFeedModel] = useState('');
  const [feedStorage, setFeedStorage] = useState('');
  const [feedMaxPrice, setFeedMaxPrice] = useState('');
  const [feedCondition, setFeedCondition] = useState('');

  // PRICING STATE
  const [pricingData, setPricingData] = useState<UserPricing[]>([]);
  const [newPriceModel, setNewPriceModel] = useState('IPHONE_13');
  const [newPriceStorage, setNewPriceStorage] = useState(128);
  const [newPriceP50, setNewPriceP50] = useState('');
  const [newPriceP25, setNewPriceP25] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const [apiUrl, setApiUrl] = useState('http://localhost:4000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost') setApiUrl(`http://${host}:4000`);
    }
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    let url = `${apiUrl}/api/listings/scored?`;
    if (feedModel) url += `model=${feedModel}&`;
    if (feedStorage) url += `storageGb=${feedStorage}&`;
    if (feedMaxPrice) url += `maxPrice=${feedMaxPrice}&`;
    if (feedCondition) url += `condition=${feedCondition}&`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setListings(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [apiUrl, feedModel, feedStorage, feedMaxPrice, feedCondition]);

  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/pricing`);
      const json = await res.json();
      if (json.success) setPricingData(json.data);
    } catch (err) { console.error(err); }
  }, [apiUrl]);

  useEffect(() => {
    if (activeTab === 'FEED' || activeTab === 'DEALS') fetchListings();
    if (activeTab === 'PRICING') fetchPricing();
  }, [activeTab, fetchListings, fetchPricing]);

  const savePrice = async () => {
    if (!newPriceP50 || !newPriceP25) return;
    setSavingPrice(true);
    try {
      await fetch(`${apiUrl}/api/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: newPriceModel,
          storage_gb: newPriceStorage,
          p50_price: parseFloat(newPriceP50),
          p25_price: parseFloat(newPriceP25),
        }),
      });
      setNewPriceP50('');
      setNewPriceP25('');
      fetchPricing();
    } catch (err) { console.error(err); } finally { setSavingPrice(false); }
  };

  const deletePrice = async (id: string) => {
    try {
      await fetch(`${apiUrl}/api/pricing/${id}`, { method: 'DELETE' });
      fetchPricing();
    } catch (err) { console.error(err); }
  };

  // --- CARD ANNUNCIO CON SCORE ---
  const renderListingCard = (item: ScoredListing, showFullStats: boolean) => {
    const cond = formatCondition(item.condition);
    const scoring = calculateFlippingScore(item);
    const price = parseFloat(item.price);

    return (
      <div key={item.listing_id} className={`bg-surface rounded-xl border overflow-hidden flex flex-col transition-all ${scoring ? scoreBorder(scoring.score) : 'border-slate-700'}`}>
        <div className="p-4 flex-grow">
          {/* Header: score + modello + prezzo */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              {scoring && (
                <span className={`text-xs font-black px-2 py-1 rounded ${scoreColor(scoring.score)}`}>
                  {scoring.score}
                </span>
              )}
              <span className="text-xs font-bold px-2 py-1 bg-sky-500/10 text-sky-400 rounded">
                {formatModelName(item.model)}
              </span>
            </div>
            <span className="text-xl font-bold text-white">€{price.toFixed(0)}</span>
          </div>

          {/* Titolo */}
          <h3 className="text-slate-100 font-semibold text-sm line-clamp-2 leading-tight mb-3">
            <a href={item.url} target="_blank" className="hover:text-primary transition-colors">{item.title}</a>
          </h3>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 text-xs mb-3">
            {item.storage_gb && <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">💾 {item.storage_gb >= 1024 ? '1 TB' : `${item.storage_gb} GB`}</span>}
            {item.battery_health_pct && <span className={`bg-slate-800 px-2 py-1 rounded ${batteryColor(item.battery_health_pct)}`}>🔋 {item.battery_health_pct}%</span>}
            <span className={`px-2 py-1 rounded ${cond.color}`}>{cond.label}</span>
            {item.has_original_box && <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">📦</span>}
            {item.has_receipt_or_invoice && <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">🧾</span>}
            {item.is_locked && <span className="bg-red-500/20 px-2 py-1 rounded text-red-400">🔒</span>}
          </div>

          {/* Stats Profitto (solo se abbiamo pricing) */}
          {scoring && showFullStats && (
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Costo reale (con tasse)</span>
                <span className="text-slate-300 font-mono">€{scoring.totalCost.toFixed(0)}</span>
              </div>
              {scoring.batteryCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">🔧 Cambio batteria</span>
                  <span className="text-amber-400 font-mono">+€{scoring.batteryCost}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Profitto rapido (P25)</span>
                <span className={`font-bold font-mono ${scoring.profitP25 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {scoring.profitP25 >= 0 ? '+' : ''}€{scoring.profitP25.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Profitto max (P50)</span>
                <span className={`font-bold font-mono ${scoring.profitP50 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {scoring.profitP50 >= 0 ? '+' : ''}€{scoring.profitP50.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-700/50 pt-2">
                <span className="text-muted">💡 Offerta consigliata</span>
                <span className="text-primary font-bold font-mono">€{Math.round(price * 0.85)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 p-3 text-xs text-muted flex justify-between items-center border-t border-slate-700">
          <span>{new Date(item.published_at || item.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <a href={item.url} target="_blank" className="text-primary hover:underline font-semibold">Vedi Annuncio ↗</a>
        </div>
      </div>
    );
  };

  // --- TAB FEED ---
  const renderFeedTab = () => (
    <div className="space-y-6">
      <div className="bg-surface p-4 rounded-xl border border-slate-700 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Modello</label>
          <select value={feedModel} onChange={(e) => setFeedModel(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-52">
            {IPHONE_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Memoria</label>
          <select value={feedStorage} onChange={(e) => setFeedStorage(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-32">
            <option value="">Tutti</option>
            <option value="64">64 GB</option><option value="128">128 GB</option><option value="256">256 GB</option><option value="512">512 GB</option><option value="1024">1 TB</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Condizione</label>
          <select value={feedCondition} onChange={(e) => setFeedCondition(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-40">
            <option value="">Tutte</option>
            <option value="NEW_SEALED">Sigillato</option><option value="LIKE_NEW">Come Nuovo</option><option value="EXCELLENT">Eccellente</option><option value="GOOD">Buono</option><option value="FAIR">Discreto</option><option value="FOR_PARTS_DAMAGED">Ricambi</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Prezzo Max (€)</label>
          <input type="number" placeholder="Es. 400" value={feedMaxPrice} onChange={(e) => setFeedMaxPrice(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-32" />
        </div>
        <button onClick={fetchListings} className="bg-primary hover:bg-sky-400 text-slate-900 font-semibold px-6 py-2 rounded-lg transition-colors ml-auto text-sm">Cerca</button>
      </div>

      {!loading && listings.length > 0 && <p className="text-sm text-muted">{listings.length} annunci trovati</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? <p className="text-muted">Caricamento...</p> : listings.map(item => renderListingCard(item, true))}
      </div>
      {!loading && listings.length === 0 && <div className="text-center py-20 text-slate-500">Nessun annuncio trovato.</div>}
    </div>
  );

  // --- TAB DEALS (Solo Score ≥ 70) ---
  const renderDealsTab = () => {
    const deals = listings
      .map(item => ({ item, scoring: calculateFlippingScore(item) }))
      .filter(d => d.scoring && d.scoring.score >= 70)
      .sort((a, b) => (b.scoring?.score || 0) - (a.scoring?.score || 0));

    return (
      <div className="space-y-6">
        <p className="text-sm text-muted">
          {deals.length} affari trovati con Score ≥ 70 {listings.length > 0 && `(su ${listings.length} annunci totali)`}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map(d => renderListingCard(d.item, true))}
        </div>
        {deals.length === 0 && (
          <div className="text-center py-20 bg-surface rounded-xl border border-slate-700">
            <p className="text-slate-400 text-lg mb-2">Nessun affare con Score ≥ 70</p>
            <p className="text-muted text-sm">Assicurati di aver inserito i tuoi prezzi nella tab "Listino Prezzi"</p>
          </div>
        )}
      </div>
    );
  };

  // --- TAB PRICING ---
  const renderPricingTab = () => (
    <div className="space-y-6">
      {/* Form inserimento */}
      <div className="bg-surface p-6 rounded-xl border border-slate-700">
        <h2 className="text-lg font-bold text-white mb-4">Aggiungi / Aggiorna Prezzo</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Modello</label>
            <select value={newPriceModel} onChange={(e) => setNewPriceModel(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-52">
              {PRICING_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Storage</label>
            <select value={newPriceStorage} onChange={(e) => setNewPriceStorage(Number(e.target.value))} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-32">
              {STORAGE_OPTIONS.map(s => <option key={s} value={s}>{s >= 1024 ? '1 TB' : `${s} GB`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">P50 (€) Vendita Normale</label>
            <input type="number" placeholder="370" value={newPriceP50} onChange={(e) => setNewPriceP50(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-36" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">P25 (€) Vendita Rapida</label>
            <input type="number" placeholder="330" value={newPriceP25} onChange={(e) => setNewPriceP25(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-36" />
          </div>
          <button onClick={savePrice} disabled={savingPrice} className="bg-primary hover:bg-sky-400 text-slate-900 font-semibold px-6 py-2 rounded-lg transition-colors text-sm disabled:opacity-50">
            {savingPrice ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </div>

      {/* Tabella prezzi esistenti */}
      <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-slate-400 uppercase text-xs tracking-wider">
              <th className="text-left p-4">Modello</th>
              <th className="text-center p-4">Storage</th>
              <th className="text-center p-4">P50 (Vendita Normale)</th>
              <th className="text-center p-4">P25 (Vendita Rapida)</th>
              <th className="text-center p-4">Spread</th>
              <th className="text-center p-4">Aggiornato</th>
              <th className="text-center p-4"></th>
            </tr>
          </thead>
          <tbody>
            {pricingData.length === 0 && (
              <tr><td colSpan={7} className="text-center p-8 text-slate-500">Nessun prezzo inserito. Aggiungi il tuo primo modello!</td></tr>
            )}
            {pricingData.map(p => (
              <tr key={p.id} className="border-t border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                <td className="p-4 text-slate-100 font-semibold">{formatModelName(p.model)}</td>
                <td className="p-4 text-center text-slate-300">{p.storage_gb >= 1024 ? '1 TB' : `${p.storage_gb} GB`}</td>
                <td className="p-4 text-center text-white font-bold">€{parseFloat(p.p50_price).toFixed(0)}</td>
                <td className="p-4 text-center text-amber-400 font-bold">€{parseFloat(p.p25_price).toFixed(0)}</td>
                <td className="p-4 text-center text-slate-400">€{(parseFloat(p.p50_price) - parseFloat(p.p25_price)).toFixed(0)}</td>
                <td className="p-4 text-center text-muted text-xs">{new Date(p.updated_at).toLocaleDateString('it-IT')}</td>
                <td className="p-4 text-center">
                  <button onClick={() => deletePrice(p.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold">Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
            <span className="bg-primary w-3 h-8 rounded-sm inline-block"></span>
            Flipping Pro Dashboard
          </h1>
          <p className="text-muted text-sm max-w-xl">Scanner automatico Vinted. Inserisci i tuoi prezzi, poi il sistema calcola in automatico Score e Profitto su ogni annuncio.</p>
        </div>
        
        <div className="flex bg-surface rounded-lg p-1 border border-slate-700">
          {[
            { id: 'FEED', label: '📋 Annunci' },
            { id: 'DEALS', label: '🔥 Affari' },
            { id: 'PRICING', label: '📊 Listino Prezzi' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-primary text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {activeTab === 'FEED' && renderFeedTab()}
        {activeTab === 'DEALS' && renderDealsTab()}
        {activeTab === 'PRICING' && renderPricingTab()}
      </main>
    </div>
  );
}
