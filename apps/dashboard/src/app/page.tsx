'use client';

import React, { useEffect, useState } from 'react';

// --- INTERFACES ---
interface ListinoSummary { model: string; storage_gb: number; condition: string; total_sold_samples: string; avg_sold_price: string; median_sold_price: string; min_sold_price: string; max_sold_price: string; }
interface SoldItem { id: string; url: string; title: string; sold_price: number; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; has_original_box: boolean; has_receipt_or_invoice: boolean; sold_at: string; }
interface Opportunity { opportunity_id: string; fair_value: string; quick_sale_value: string; estimated_profit: string; roi_percentage: string; status: string; marketplace: string; title: string; url: string; price: string; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; images: string[]; }
interface RawListing { listing_id: string; marketplace: string; title: string; description: string; url: string; price: string; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; images: string[]; published_at: string; created_at: string; has_original_box: boolean; has_receipt_or_invoice: boolean; is_locked: boolean; }

// --- MODELLI ---
const IPHONE_MODELS = [
  { label: 'Tutti i Modelli', value: '' },
  // iPhone SE
  { label: 'iPhone SE (2ª gen)', value: 'IPHONE_SE_2' },
  { label: 'iPhone SE (3ª gen)', value: 'IPHONE_SE_3' },
  // iPhone 11
  { label: 'iPhone 11', value: 'IPHONE_11' },
  { label: 'iPhone 11 Pro', value: 'IPHONE_11_PRO' },
  { label: 'iPhone 11 Pro Max', value: 'IPHONE_11_PRO_MAX' },
  // iPhone 12
  { label: 'iPhone 12 Mini', value: 'IPHONE_12_MINI' },
  { label: 'iPhone 12', value: 'IPHONE_12' },
  { label: 'iPhone 12 Pro', value: 'IPHONE_12_PRO' },
  { label: 'iPhone 12 Pro Max', value: 'IPHONE_12_PRO_MAX' },
  // iPhone 13
  { label: 'iPhone 13 Mini', value: 'IPHONE_13_MINI' },
  { label: 'iPhone 13', value: 'IPHONE_13' },
  { label: 'iPhone 13 Pro', value: 'IPHONE_13_PRO' },
  { label: 'iPhone 13 Pro Max', value: 'IPHONE_13_PRO_MAX' },
  // iPhone 14
  { label: 'iPhone 14', value: 'IPHONE_14' },
  { label: 'iPhone 14 Plus', value: 'IPHONE_14_PLUS' },
  { label: 'iPhone 14 Pro', value: 'IPHONE_14_PRO' },
  { label: 'iPhone 14 Pro Max', value: 'IPHONE_14_PRO_MAX' },
  // iPhone 15
  { label: 'iPhone 15', value: 'IPHONE_15' },
  { label: 'iPhone 15 Plus', value: 'IPHONE_15_PLUS' },
  { label: 'iPhone 15 Pro', value: 'IPHONE_15_PRO' },
  { label: 'iPhone 15 Pro Max', value: 'IPHONE_15_PRO_MAX' },
  // iPhone 16
  { label: 'iPhone 16e', value: 'IPHONE_16E' },
  { label: 'iPhone 16', value: 'IPHONE_16' },
  { label: 'iPhone 16 Plus', value: 'IPHONE_16_PLUS' },
  { label: 'iPhone 16 Pro', value: 'IPHONE_16_PRO' },
  { label: 'iPhone 16 Pro Max', value: 'IPHONE_16_PRO_MAX' },
];

/** Converte "IPHONE_13_PRO_MAX" → "iPhone 13 Pro Max" */
function formatModelName(model: string): string {
  const entry = IPHONE_MODELS.find(m => m.value === model);
  if (entry) return entry.label;
  if (model === 'UNKNOWN') return 'Non riconosciuto';
  return model.replace('IPHONE_', 'iPhone ').replace(/_/g, ' ');
}

/** Converte "LIKE_NEW" → "Come Nuovo", ecc. */
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

/** Colore batteria in base alla percentuale */
function batteryColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-red-400';
}

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState<'FEED' | 'ALERTS' | 'MARKET'>('FEED');
  const [loading, setLoading] = useState(false);

  // MARKET STATE
  const [summary, setSummary] = useState<ListinoSummary[]>([]);
  const [soldItems, setSoldItems] = useState<SoldItem[]>([]);

  // ALERTS STATE
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [alertStatus, setAlertStatus] = useState('NEW');

  // LIVE FEED STATE
  const [listings, setListings] = useState<RawListing[]>([]);
  const [feedModel, setFeedModel] = useState('');
  const [feedStorage, setFeedStorage] = useState('');
  const [feedMaxPrice, setFeedMaxPrice] = useState('');
  const [feedCondition, setFeedCondition] = useState('');

  const [apiUrl, setApiUrl] = useState('http://localhost:4000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost') {
        setApiUrl(`http://${host}:4000`);
      }
    }
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    let url = `${apiUrl}/api/listings?`;
    if (feedModel) url += `model=${feedModel}&`;
    if (feedStorage) url += `storageGb=${feedStorage}&`;
    if (feedMaxPrice) url += `maxPrice=${feedMaxPrice}&`;
    if (feedCondition) url += `condition=${feedCondition}&`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setListings(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/opportunities?status=${alertStatus}`);
      const json = await res.json();
      if (json.success) setOpportunities(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchMarket = async () => {
    setLoading(true);
    let url = `${apiUrl}/api/listino?`;
    if (feedModel) url += `model=${feedModel}&`;
    if (feedStorage) url += `storageGb=${feedStorage}&`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) { setSummary(json.summary); setSoldItems(json.items); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'FEED') fetchListings();
    if (activeTab === 'ALERTS') fetchOpportunities();
    if (activeTab === 'MARKET') fetchMarket();
  }, [activeTab, feedModel, feedStorage, feedMaxPrice, feedCondition, alertStatus, apiUrl]);

  const updateOpportunityStatus = async (id: string, newStatus: string) => {
    await fetch(`${apiUrl}/api/opportunities/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus })
    });
    fetchOpportunities();
  };

  // --- RENDERERS ---
  const renderFeedTab = () => (
    <div className="space-y-6">
      {/* FILTRI */}
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
            <option value="64">64 GB</option>
            <option value="128">128 GB</option>
            <option value="256">256 GB</option>
            <option value="512">512 GB</option>
            <option value="1024">1 TB</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Condizione</label>
          <select value={feedCondition} onChange={(e) => setFeedCondition(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-40">
            <option value="">Tutte</option>
            <option value="NEW_SEALED">Nuovo Sigillato</option>
            <option value="LIKE_NEW">Come Nuovo</option>
            <option value="EXCELLENT">Eccellente</option>
            <option value="GOOD">Buono</option>
            <option value="FAIR">Discreto</option>
            <option value="FOR_PARTS_DAMAGED">Ricambi / Rotto</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Prezzo Max (€)</label>
          <input type="number" placeholder="Es. 400" value={feedMaxPrice} onChange={(e) => setFeedMaxPrice(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-32" />
        </div>
        <button onClick={fetchListings} className="bg-primary hover:bg-sky-400 text-slate-900 font-semibold px-6 py-2 rounded-lg transition-colors ml-auto text-sm">
          Cerca
        </button>
      </div>

      {/* CONTATORE */}
      {!loading && listings.length > 0 && (
        <p className="text-sm text-muted">{listings.length} annunci trovati</p>
      )}

      {/* GRIGLIA ANNUNCI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? <p className="text-muted">Caricamento...</p> : listings.map((item) => {
          const cond = formatCondition(item.condition);
          return (
            <div key={item.listing_id} className="bg-surface rounded-xl border border-slate-700 overflow-hidden hover:border-primary transition-colors flex flex-col">
              <div className="p-4 flex-grow">
                {/* Header: modello + prezzo */}
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2 py-1 bg-sky-500/10 text-sky-400 rounded">
                    {formatModelName(item.model)}
                  </span>
                  <span className="text-xl font-bold text-success">€{parseFloat(item.price).toFixed(0)}</span>
                </div>

                {/* Titolo */}
                <h3 className="text-slate-100 font-semibold text-sm line-clamp-2 leading-tight mb-3">
                  <a href={item.url} target="_blank" className="hover:text-primary transition-colors">{item.title}</a>
                </h3>

                {/* Tags: storage, batteria, condizione */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {item.storage_gb && (
                    <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">
                      💾 {item.storage_gb >= 1024 ? '1 TB' : `${item.storage_gb} GB`}
                    </span>
                  )}
                  {item.battery_health_pct && (
                    <span className={`bg-slate-800 px-2 py-1 rounded ${batteryColor(item.battery_health_pct)}`}>
                      🔋 {item.battery_health_pct}%
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded ${cond.color}`}>{cond.label}</span>
                  {item.has_original_box && <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">📦 Scatola</span>}
                  {item.has_receipt_or_invoice && <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">🧾 Garanzia</span>}
                  {item.is_locked && <span className="bg-red-500/20 px-2 py-1 rounded text-red-400">🔒 Bloccato</span>}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-800/50 p-3 text-xs text-muted flex justify-between items-center border-t border-slate-700">
                <span>{new Date(item.published_at || item.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <a href={item.url} target="_blank" className="text-primary hover:underline font-semibold">Vedi Annuncio ↗</a>
              </div>
            </div>
          );
        })}
      </div>
      {!loading && listings.length === 0 && <div className="text-center py-20 text-slate-500">Nessun annuncio trovato per questi filtri.</div>}
    </div>
  );

  const renderAlertsTab = () => (
    <div className="space-y-6">
      <div className="flex gap-4">
        {['NEW', 'REVIEW', 'BUY', 'PASS'].map(s => (
          <button key={s} onClick={() => setAlertStatus(s)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${alertStatus === s ? 'bg-primary text-slate-900' : 'bg-surface text-slate-400 hover:bg-slate-700'}`}>
            {s}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-muted">Caricamento...</p> : opportunities.map(opp => {
          const cond = formatCondition(opp.condition);
          return (
            <div key={opp.opportunity_id} className="bg-surface rounded-xl border border-primary/50 shadow-[0_0_15px_rgba(56,189,248,0.1)] overflow-hidden flex flex-col relative">
              {/* Ribbon ROI */}
              <div className="absolute top-0 right-0 bg-primary text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                ROI +{parseFloat(opp.roi_percentage).toFixed(0)}%
              </div>
              
              <div className="p-5 flex-grow mt-2">
                {/* Modello */}
                <span className="text-xs font-bold px-2 py-1 bg-sky-500/10 text-sky-400 rounded">
                  {formatModelName(opp.model)}
                </span>

                <h3 className="text-slate-100 font-bold text-lg leading-tight mb-4 mt-2">
                  <a href={opp.url} target="_blank" className="hover:text-primary transition-colors">{opp.title}</a>
                </h3>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 text-xs mb-4">
                  {opp.storage_gb && <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">💾 {opp.storage_gb >= 1024 ? '1 TB' : `${opp.storage_gb} GB`}</span>}
                  {opp.battery_health_pct && <span className={`bg-slate-800 px-2 py-1 rounded ${batteryColor(opp.battery_health_pct)}`}>🔋 {opp.battery_health_pct}%</span>}
                  <span className={`px-2 py-1 rounded ${cond.color}`}>{cond.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <div>
                    <p className="text-xs text-muted mb-1">Prezzo Richiesto</p>
                    <p className="text-xl font-bold text-white">€{parseFloat(opp.price).toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Valore Mercato</p>
                    <p className="text-xl font-bold text-slate-400 line-through">€{parseFloat(opp.fair_value).toFixed(0)}</p>
                  </div>
                  <div className="col-span-2 border-t border-slate-700/50 pt-3">
                    <p className="text-xs text-muted mb-1">Profitto Stimato Netto</p>
                    <p className="text-2xl font-black text-success">€{parseFloat(opp.estimated_profit).toFixed(0)}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex bg-slate-800 border-t border-slate-700">
                <button onClick={() => updateOpportunityStatus(opp.opportunity_id, 'REVIEW')} className="flex-1 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-r border-slate-700">Da Valutare</button>
                <button onClick={() => updateOpportunityStatus(opp.opportunity_id, 'BUY')} className="flex-1 py-3 text-sm font-bold text-success hover:bg-success hover:text-slate-900 transition-colors border-r border-slate-700">COMPRA</button>
                <button onClick={() => updateOpportunityStatus(opp.opportunity_id, 'PASS')} className="flex-1 py-3 text-sm font-semibold text-danger hover:bg-danger hover:text-white transition-colors">Scarta</button>
              </div>
            </div>
          );
        })}
      </div>
      {!loading && opportunities.length === 0 && <div className="text-center py-20 text-slate-500">Nessuna opportunità in questo stato.</div>}
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
          <p className="text-muted text-sm max-w-xl">Scanner automatico Vinted per iPhone. Filtra gli annunci in tempo reale o monitora le occasioni d'oro segnalate dal sistema.</p>
        </div>
        
        <div className="flex bg-surface rounded-lg p-1 border border-slate-700">
          {[
            { id: 'FEED', label: 'Tutti gli Annunci' },
            { id: 'ALERTS', label: '🔥 Affari (Alerts)' },
            { id: 'MARKET', label: 'Storico Mercato' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-primary text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {activeTab === 'FEED' && renderFeedTab()}
        {activeTab === 'ALERTS' && renderAlertsTab()}
        {activeTab === 'MARKET' && (
          <div className="text-center py-20 bg-surface rounded-xl border border-slate-700">
            <h2 className="text-xl text-slate-300 font-semibold mb-2">Sezione Storico Mercato</h2>
            <p className="text-muted">Il listino dei telefoni venduti è attivo, ma per ora ci concentriamo sul Live Feed e gli Alerts.</p>
          </div>
        )}
      </main>
    </div>
  );
}
