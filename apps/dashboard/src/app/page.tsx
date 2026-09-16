'use client';

import React, { useEffect, useState } from 'react';

// --- INTERFACES ---
interface ListinoSummary {
  model: string;
  storage_gb: number;
  condition: string;
  total_sold_samples: string;
  avg_sold_price: string;
  median_sold_price: string;
  min_sold_price: string;
  max_sold_price: string;
}

interface SoldItem {
  id: string;
  vinted_item_id: string;
  url: string;
  title: string;
  sold_price: number;
  model: string;
  storage_gb: number | null;
  battery_health_pct: number | null;
  condition: string;
  has_original_box: boolean;
  has_receipt_or_invoice: boolean;
  sold_at: string;
}

interface Opportunity {
  opportunity_id: string;
  fair_value: string;
  quick_sale_value: string;
  estimated_profit: string;
  roi_percentage: string;
  confidence_score: string;
  risk_score: string;
  status: string;
  listing_id: string;
  marketplace: string;
  title: string;
  url: string;
  price: string;
  model: string;
  storage_gb: number | null;
  battery_health_pct: number | null;
  condition: string;
  images: string[];
}

const IPHONE_MODELS = [
  { label: 'Tutti i Modelli', value: '' },
  { label: 'iPhone 13', value: 'IPHONE_13' },
  { label: 'iPhone 13 Mini', value: 'IPHONE_13_MINI' },
  { label: 'iPhone 13 Pro', value: 'IPHONE_13_PRO' },
  { label: 'iPhone 13 Pro Max', value: 'IPHONE_13_PRO_MAX' },
  { label: 'iPhone 14', value: 'IPHONE_14' },
  { label: 'iPhone 14 Plus', value: 'IPHONE_14_PLUS' },
  { label: 'iPhone 14 Pro', value: 'IPHONE_14_PRO' },
  { label: 'iPhone 14 Pro Max', value: 'IPHONE_14_PRO_MAX' },
  { label: 'iPhone 15', value: 'IPHONE_15' },
  { label: 'iPhone 15 Plus', value: 'IPHONE_15_PLUS' },
  { label: 'iPhone 15 Pro', value: 'IPHONE_15_PRO' },
  { label: 'iPhone 15 Pro Max', value: 'IPHONE_15_PRO_MAX' },
  { label: 'iPhone 16', value: 'IPHONE_16' },
  { label: 'iPhone 16 Plus', value: 'IPHONE_16_PLUS' },
  { label: 'iPhone 16 Pro', value: 'IPHONE_16_PRO' },
  { label: 'iPhone 16 Pro Max', value: 'IPHONE_16_PRO_MAX' },
];

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'MARKET'>('ALERTS');

  // MARKET STATE
  const [summary, setSummary] = useState<ListinoSummary[]>([]);
  const [items, setItems] = useState<SoldItem[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');

  // ALERTS STATE
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertStatus, setAlertStatus] = useState('NEW');

  // --- API CALLS ---
  const fetchListino = async () => {
    try {
      setLoadingMarket(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/listino?`;
      if (selectedModel) url += `model=${selectedModel}&`;
      if (selectedStorage) url += `storageGb=${selectedStorage}&`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setSummary(json.summary);
        setItems(json.items);
      }
    } catch (err) {
      console.error('Errore caricamento listino:', err);
    } finally {
      setLoadingMarket(false);
    }
  };

  const fetchOpportunities = async () => {
    try {
      setLoadingAlerts(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const url = `${apiUrl}/api/opportunities?status=${alertStatus}`;
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setOpportunities(json.data);
      }
    } catch (err) {
      console.error('Errore caricamento opportunities:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const updateOpportunityStatus = async (id: string, newStatus: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/api/opportunities/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchOpportunities();
    } catch (err) {
      console.error('Errore aggiornamento status:', err);
    }
  };

  const triggerScan = async () => {
    try {
      setScanning(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/api/listino/scan`, { method: 'POST' });
      await fetchListino();
    } catch (err) {
      console.error('Errore scansione venduti:', err);
    } finally {
      setScanning(false);
    }
  };

  const downloadCsv = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    window.open(`${apiUrl}/api/listino/export`, '_blank');
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (activeTab === 'MARKET') fetchListino();
  }, [activeTab, selectedModel, selectedStorage]);

  useEffect(() => {
    if (activeTab === 'ALERTS') fetchOpportunities();
  }, [activeTab, alertStatus]);

  // --- RENDERERS ---
  const renderAlertsTab = () => (
    <div>
      <section style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <label style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Filtra Stato:</label>
        <select
          value={alertStatus}
          onChange={(e) => setAlertStatus(e.target.value)}
          style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px' }}
        >
          <option value="NEW">Nuovi (NEW)</option>
          <option value="REVIEW">In Revisione (REVIEW)</option>
          <option value="BUY">Da Comprare (BUY)</option>
          <option value="PASS">Scartati (PASS)</option>
          <option value="PURCHASED">Acquistati (PURCHASED)</option>
        </select>
        <button className="btn" onClick={fetchOpportunities} style={{ marginLeft: 'auto' }}>🔄 Aggiorna</button>
      </section>

      {loadingAlerts ? (
        <p>Caricamento alert in corso...</p>
      ) : opportunities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: 'var(--bg-card)', borderRadius: '12px' }}>
          <h3>Nessun alert per lo stato "{alertStatus}"</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Lo Scanner Automatico aggiungerà qui le nuove opportunità non appena ne troverà.
          </p>
        </div>
      ) : (
        <div className="grid">
          {opportunities.map(opp => (
            <div className="card" key={opp.opportunity_id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                    <a href={opp.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                      {opp.title}
                    </a>
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {opp.model} • {opp.storage_gb ? `${opp.storage_gb}GB` : 'N/A'} • {opp.condition}
                  </div>
                </div>
                <div style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                  {opp.marketplace.toUpperCase()}
                </div>
              </div>

              <div className="metrics" style={{ marginTop: '16px' }}>
                <div className="metric-item">
                  <span className="metric-label">Prezzo Attuale</span>
                  <span className="metric-value" style={{ color: '#fff' }}>€{parseFloat(opp.price).toFixed(2)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Fair Value</span>
                  <span className="metric-value">€{parseFloat(opp.fair_value).toFixed(2)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Profitto Stimato</span>
                  <span className="metric-value val-green">€{parseFloat(opp.estimated_profit).toFixed(2)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">ROI</span>
                  <span className="metric-value val-cyan">+{parseFloat(opp.roi_percentage).toFixed(1)}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
                <button className="btn" style={{ flex: 1, padding: '6px', fontSize: '12px', background: '#3b82f6', color: '#fff' }} onClick={() => updateOpportunityStatus(opp.opportunity_id, 'REVIEW')}>
                  🔎 Review
                </button>
                <button className="btn" style={{ flex: 1, padding: '6px', fontSize: '12px', background: '#10b981', color: '#fff' }} onClick={() => updateOpportunityStatus(opp.opportunity_id, 'BUY')}>
                  🛒 Buy
                </button>
                <button className="btn" style={{ flex: 1, padding: '6px', fontSize: '12px', background: '#ef4444', color: '#fff' }} onClick={() => updateOpportunityStatus(opp.opportunity_id, 'PASS')}>
                  ❌ Pass
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMarketTab = () => (
    <div>
      <section style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Modello iPhone:</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px' }}>
            {IPHONE_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Taglio di Memoria:</label>
          <select value={selectedStorage} onChange={(e) => setSelectedStorage(e.target.value)} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px' }}>
            <option value="">Tutti i Tagli</option>
            <option value="128">128 GB</option>
            <option value="256">256 GB</option>
            <option value="512">512 GB</option>
            <option value="1024">1 TB</option>
          </select>
        </div>
      </section>

      {summary.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Riepilogo Prezzi di Vendita</h2>
          <div className="grid">
            {summary.map((sum, i) => (
              <div className="card" key={i}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 700 }}>{sum.model} - {sum.storage_gb}GB</span>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Condizione: {sum.condition}</p>
                  <div className="metrics" style={{ marginTop: '12px' }}>
                    <div className="metric-item"><span className="metric-label">Mediano</span><span className="metric-value val-green">€{sum.median_sold_price}</span></div>
                    <div className="metric-item"><span className="metric-label">Medio</span><span className="metric-value val-cyan">€{sum.avg_sold_price}</span></div>
                    <div className="metric-item"><span className="metric-label">Campioni</span><span className="metric-value val-amber">{sum.total_sold_samples}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Catalogo Dettagliato Annunci Venduti</h2>
        {loadingMarket ? <p>Caricamento listino in corso...</p> : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: 'var(--bg-card)', borderRadius: '12px' }}>
            <h3>Nessun annuncio catalogato</h3>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Modello</th>
                  <th style={{ padding: '12px 16px' }}>Prezzo</th>
                  <th style={{ padding: '12px 16px' }}>Condizione</th>
                  <th style={{ padding: '12px 16px' }}>Link</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--accent-cyan)' }}>{item.model} {item.storage_gb ? `(${item.storage_gb}GB)` : ''}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent-green)' }}>€{item.sold_price}</td>
                    <td style={{ padding: '12px 16px' }}>{item.condition}</td>
                    <td style={{ padding: '12px 16px' }}><a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>Vedi su Vinted</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <main>
      <header className="header" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="title">iPhone Flipping Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Monitoraggio affari e storico mercato in tempo reale.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" style={{ background: '#10b981', color: '#fff' }} onClick={downloadCsv}>Esporta CSV</button>
            <button className="btn" onClick={triggerScan} disabled={scanning}>{scanning ? 'Catalogazione in corso...' : 'Aggiorna Storico Vinted'}</button>
          </div>
        </div>
        
        {/* TAB NAVIGATION */}
        <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
          <button 
            style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === 'ALERTS' ? '2px solid var(--accent-cyan)' : '2px solid transparent', color: activeTab === 'ALERTS' ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            onClick={() => setActiveTab('ALERTS')}
          >
            🚨 Scanner Alerts
          </button>
          <button 
            style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === 'MARKET' ? '2px solid var(--accent-cyan)' : '2px solid transparent', color: activeTab === 'MARKET' ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            onClick={() => setActiveTab('MARKET')}
          >
            📊 Listino Venduti
          </button>
        </div>
      </header>

      <div style={{ marginTop: '24px' }}>
        {activeTab === 'ALERTS' ? renderAlertsTab() : renderMarketTab()}
      </div>
    </main>
  );
}
