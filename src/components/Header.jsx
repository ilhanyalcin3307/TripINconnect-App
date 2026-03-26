import React, { useState, useEffect } from 'react';

function Header({ title, onExport, onAddExpense, onSettings, onImport, onLogout, userEmail }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rates, setRates] = useState({ TRY: null, USD: null });
  const [loading, setLoading] = useState(true);

  // Döviz kurlarını çek
  const fetchRates = async () => {
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY,USD');
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          setRates({ TRY: data.rates.TRY, USD: data.rates.USD });
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Döviz kuru hatası:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // İlk yüklemede kurları çek
    fetchRates();
    
    // 10 dakikada bir güncelle
    const ratesTimer = setInterval(fetchRates, 10 * 60 * 1000);

    return () => clearInterval(ratesTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('de-DE', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const formattedTime = currentTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <header className="header">
      <div className="page-title" dangerouslySetInnerHTML={{ __html: title }}></div>
      <div className="header-right">
        {/* Döviz Kurları */}
        {!loading && rates.TRY && rates.USD && (
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '6px 12px',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: '500',
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            letterSpacing: '0.5px',
            color: 'var(--text2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text2)' }}>EUR/TL:</span>
              <span style={{ color: 'var(--accent)' }}>{rates.TRY.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text2)' }}>USD/TL:</span>
              <span style={{ color: 'var(--green)' }}>{(rates.TRY / rates.USD).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text2)' }}>EUR/USD:</span>
              <span style={{ color: 'var(--blue)' }}>{rates.USD.toFixed(4)}</span>
            </div>
          </div>
        )}
        {loading && (
          <div style={{
            padding: '6px 12px',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: '500',
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            letterSpacing: '0.5px',
            color: 'var(--text2)'
          }}>
            Kurse werden geladen...
          </div>
        )}
        <div className="current-date">{formattedDate} • {formattedTime}</div>
        <button
          className="btn btn-outline"
          onClick={() => window.location.reload()}
          title="Seite neu laden"
          style={{ fontSize: '14px', padding: '5px 10px' }}
        >
          ↺
        </button>
        {onSettings && (
          <button className="btn btn-outline" onClick={onSettings} title="Einstellungen">
            ⚙️
          </button>
        )}
        {onLogout && (
          <button
            className="btn btn-outline"
            onClick={() => {
              if (window.confirm('Möchten Sie sich wirklich abmelden?')) {
                onLogout();
              }
            }}
            title="Abmelden"
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            Abmelden
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
