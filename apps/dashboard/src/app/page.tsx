'use client';

import React, { useEffect, useState } from 'react';

// --- INTERFACES ---
interface ListinoSummary { model: string; storage_gb: number; condition: string; total_sold_samples: string; avg_sold_price: string; median_sold_price: string; min_sold_price: string; max_sold_price: string; }
interface SoldItem { id: string; url: string; title: string; sold_price: number; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; has_original_box: boolean; has_receipt_or_invoice: boolean; sold_at: string; }
interface Opportunity { opportunity_id: string; fair_value: string; quick_sale_value: string; estimated_profit: string; roi_percentage: string; status: string; marketplace: string; title: string; url: string; price: string; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; images: string[]; }
interface RawListing { listing_id: string; marketplace: string; title: string; description: string; url: string; price: string; model: string; storage_gb: number | null; battery_health_pct: number | null; condition: string; images: string[]; published_at: string; created_at: string; }

const IPHONE_MODELS = [
  { label: 'Tutti i Modelli', value: '' },
  { label: 'iPhone 13', value: 'IPHONE_13' }, { label: 'iPhone 13 Pro', value: 'IPHONE_13_PRO' }, { label: 'iPhone 13 Pro Max', value: 'IPHONE_13_PRO_MAX' },
  { label: 'iPhone 14', value: 'IPHONE_14' }, { label: 'iPhone 14 Pro', value: 'IPHONE_14_PRO' }, { label: 'iPhone 14 Pro Max', value: 'IPHONE_14_PRO_MAX' },
  { label: 'iPhone 15', value: 'IPHONE_15' }, { label: 'iPhone 15 Pro', value: 'IPHONE_15_PRO' }, { label: 'iPhone 15 Pro Max', value: 'IPHONE_15_PRO_MAX' },
  { label: 'iPhone 16', value: 'IPHONE_16' }, { label: 'iPhone 16 Pro', value: 'IPHONE_16_PRO' }, { label: 'iPhone 16 Pro Max', value: 'IPHONE_16_PRO_MAX' },
];

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
  }, [activeTab, feedModel, feedStorage, feedMaxPrice, alertStatus, apiUrl]);

  const updateOpportunityStatus = async (id: string, newStatus: string) => {
    await fetch(`${apiUrl}/api/opportunities/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus })
    });
    fetchOpportunities();
  };

  // --- RENDERERS ---
  const renderFeedTab = () => (
    <div className="space-y-6">
      <div className="bg-surface p-4 rounded-xl border border-slate-700 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Modello</label>
          <select value={feedModel} onChange={(e) => setFeedModel(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-48">
            {IPHONE_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Memoria</label>
          <select value={feedStorage} onChange={(e) => setFeedStorage(e.target.value)} className="bg-background text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-32">
            <option value="">Tutti</option><option value="128">128 GB</option><option value="256">256 GB</option><option value="512">512 GB</option><option value="1024">1 TB</option>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? <p className="text-muted">Caricamento...</p> : listings.map((item) => (
          <div key={item.listing_id} className="bg-surface rounded-xl border border-slate-700 overflow-hidden hover:border-primary transition-colors flex flex-col">
            <div className="p-4 flex-grow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded uppercase">{item.marketplace}</span>
                <span className="text-xl font-bold text-success">€{parseFloat(item.price).toFixed(2)}</span>
              </div>
              <h3 className="text-slate-100 font-semibold text-lg line-clamp-2 leading-tight mb-2">
                <a href={item.url} target="_blank" className="hover:text-primary transition-colors">{item.title}</a>
              </h3>
              <div className="flex flex-wrap gap-2 text-xs text-slate-300 mt-4">
                <span className="bg-slate-800 px-2 py-1 rounded">{item.model !== 'UNKNOWN' ? item.model : 'Modello Sconosciuto'}</span>
                {item.storage_gb && <span className="bg-slate-800 px-2 py-1 rounded">{item.storage_gb}GB</span>}
                {item.battery_health_pct && <span className="bg-slate-800 px-2 py-1 rounded">🔋 {item.battery_health_pct}%</span>}
                <span className="bg-slate-800 px-2 py-1 rounded">{item.condition}</span>
              </div>
            </div>
            <div className="bg-slate-800/50 p-3 text-xs text-muted flex justify-between items-center border-t border-slate-700">
              <span>{new Date(item.published_at || item.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <a href={item.url} target="_blank" className="text-primary hover:underline font-semibold">Vedi Annuncio ↗</a>
            </div>
          </div>
        ))}
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
        {loading ? <p className="text-muted">Caricamento...</p> : opportunities.map(opp => (
          <div key={opp.opportunity_id} className="bg-surface rounded-xl border border-primary/50 shadow-[0_0_15px_rgba(56,189,248,0.1)] overflow-hidden flex flex-col relative">
            {/* Ribbon ROI */}
            <div className="absolute top-0 right-0 bg-primary text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
              ROI +{parseFloat(opp.roi_percentage).toFixed(0)}%
            </div>
            
            <div className="p-5 flex-grow mt-2">
              <h3 className="text-slate-100 font-bold text-lg leading-tight mb-4">
                <a href={opp.url} target="_blank" className="hover:text-primary transition-colors">{opp.title}</a>
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div>
                  <p className="text-xs text-muted mb-1">Prezzo Richiesto</p>
                  <p className="text-xl font-bold text-white">€{parseFloat(opp.price).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Valore Mercato</p>
                  <p className="text-xl font-bold text-slate-400 line-through">€{parseFloat(opp.fair_value).toFixed(2)}</p>
                </div>
                <div className="col-span-2 border-t border-slate-700/50 pt-3">
                  <p className="text-xs text-muted mb-1">Profitto Stimato Netto</p>
                  <p className="text-2xl font-black text-success">€{parseFloat(opp.estimated_profit).toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex bg-slate-800 border-t border-slate-700">
              <button onClick={() => updateOpportunityStatus(opp.opportunity_id, 'REVIEW')} className="flex-1 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-r border-slate-700">Da Valutare</button>
              <button onClick={() => updateOpportunityStatus(opp.opportunity_id, 'BUY')} className="flex-1 py-3 text-sm font-bold text-success hover:bg-success hover:text-slate-900 transition-colors border-r border-slate-700">COMPRA</button>
              <button onClick={() => updateOpportunityStatus(opp.opportunity_id, 'PASS')} className="flex-1 py-3 text-sm font-semibold text-danger hover:bg-danger hover:text-white transition-colors">Scarta</button>
            </div>
          </div>
        ))}
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
