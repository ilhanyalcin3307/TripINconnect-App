import React, { useState, useMemo } from 'react';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const CAT_COLORS = {
  seyahat: '#0098ff',
  yemek: '#ff6b35',
  konaklama: '#a855f7',
  pazarlama: '#00e5a0',
  diğer: '#ffd60a'
};

const CAT_EMOJI = {
  seyahat: '✈',
  yemek: '🍽',
  konaklama: '🏨',
  pazarlama: '📢',
  diğer: '📦'
};

function ReportView({ expenses, onExport, reservations = [], agenturData = {}, categories = [] }) {
  const [zahlungsplanYear, setZahlungsplanYear] = useState(new Date().getFullYear());
  const [zpSelectedMonth, setZpSelectedMonth] = useState(null);

  const DEFAULT_AGENTUR = { berechnung: 'Abreisedatum', tage: '30', provPct: 10 };

  const zahlungsplan = useMemo(() => {
    const entries = [];
    reservations.forEach(r => {
      if (!r.gebuchteVA) return;
      const code = r.gebuchteVA.trim().toUpperCase();
      const ag = { ...DEFAULT_AGENTUR, ...(agenturData[code] || {}) };
      let baseDate = null;
      if (ag.berechnung === 'Buchungsdatum') {
        if (r.buchung) baseDate = new Date(r.buchung);
      } else {
        const ref = r.ruckreise || r.abreise;
        if (ref) baseDate = new Date(ref);
      }
      if (!baseDate || isNaN(baseDate.getTime())) return;
      const n = parseInt(ag.tage) || 30;
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + n);
      const preis = parseFloat(r.reisepreis) || 0;
      const provStr = String(r.provisionRate || '').replace('%', '').trim();
      const provRate = parseFloat(provStr) || 0;
      const amount = preis * provRate / 100;
      if (amount <= 0) return;
      const catEntry = categories.find(c => c.split('|')[0].toUpperCase() === code);
      const agName = catEntry ? (catEntry.split('|')[1] || code) : code;
      entries.push({ code, agName, dueDate, amount, provRate, preis, vgNr: r.vgNr || '', kundenName: r.name || '' });
    });
    return entries.sort((a, b) => a.dueDate - b.dueDate);
  }, [reservations, agenturData, categories]);

  const yearEntries = useMemo(
    () => zahlungsplan.filter(e => e.dueDate.getFullYear() === zahlungsplanYear),
    [zahlungsplan, zahlungsplanYear]
  );

  const zpEntries = useMemo(
    () => zpSelectedMonth !== null
      ? yearEntries.filter(e => e.dueDate.getMonth() === zpSelectedMonth)
      : yearEntries,
    [yearEntries, zpSelectedMonth]
  );

  if (expenses.length === 0 && reservations.length === 0) {
    return (
      <div>
        <div className="section-title" style={{ marginBottom: '20px' }}>Berichte</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' }}>
          <div className="empty-state" style={{ fontSize: '14px', fontWeight: '500' }}>Keine Daten vorhanden.</div>
        </div>
      </div>
    );
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.tutar), 0);
  
  const catTotals = {};
  expenses.forEach(e => {
    if (!catTotals[e.kategori]) catTotals[e.kategori] = 0;
    catTotals[e.kategori] += parseFloat(e.tutar);
  });

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const reportDate = new Date().toLocaleDateString('tr-TR', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div>
      <div className="section-title" style={{ marginBottom: '20px' }}>Berichte</div>

      {/* ===== ZAHLUNGSPLAN ===== */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)' }}>📅 Zahlungsplan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {yearEntries.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                Gesamt {zahlungsplanYear}:{' '}
                <strong style={{ color: '#10b981' }}>{yearEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)} €</strong>
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={() => { setZahlungsplanYear(y => y - 1); setZpSelectedMonth(null); }}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px' }}>←</button>
              <span style={{ fontWeight: '700', fontSize: '14px', minWidth: '48px', textAlign: 'center' }}>{zahlungsplanYear}</span>
              <button onClick={() => { setZahlungsplanYear(y => y + 1); setZpSelectedMonth(null); }}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px' }}>→</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px', marginBottom: '12px' }}>
          {MONTHS_DE.map((m, idx) => {
            const monthTotal = yearEntries.filter(e => e.dueDate.getMonth() === idx).reduce((s, e) => s + e.amount, 0);
            const isSelected = zpSelectedMonth === idx;
            const hasData = monthTotal > 0;
            return (
              <div key={m} onClick={() => hasData && setZpSelectedMonth(isSelected ? null : idx)}
                style={{
                  borderRadius: '8px', padding: '8px 4px', textAlign: 'center',
                  cursor: hasData ? 'pointer' : 'default',
                  background: isSelected ? 'rgba(59,130,246,0.2)' : hasData ? 'rgba(16,185,129,0.08)' : 'var(--bg)',
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text2)', marginBottom: '3px' }}>{m}</div>
                <div style={{ fontSize: '10px', fontWeight: hasData ? '700' : '400', fontFamily: "'JetBrains Mono', monospace", color: hasData ? '#10b981' : 'var(--text2)' }}>
                  {hasData ? monthTotal.toFixed(0) + ' €' : '—'}
                </div>
              </div>
            );
          })}
        </div>

        {zpEntries.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            {zpSelectedMonth !== null && (
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{MONTHS_DE[zpSelectedMonth]} {zahlungsplanYear} — {zpEntries.length} Zahlung{zpEntries.length !== 1 ? 'en' : ''}</span>
                <button onClick={() => setZpSelectedMonth(null)}
                  style={{ fontSize: '10px', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Alle anzeigen</button>
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {['Fällig am', 'Code', 'Agentur', 'VG-Nr.', 'Kunde', 'Reisepreis', 'Prov %', 'Prov €'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', fontWeight: '600', fontSize: '11px', color: 'var(--text2)', textAlign: ['Reisepreis', 'Prov €'].includes(h) ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zpEntries.map((e, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', fontWeight: '600', color: 'var(--accent)' }}>{e.dueDate.toLocaleDateString('de-DE')}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', color: 'var(--accent)', fontSize: '10px' }}>{e.code}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', color: 'var(--text)' }}>{e.agName}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--text2)' }}>{e.vgNr || '—'}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', color: 'var(--text)' }}>{e.kundenName || '—'}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{parseFloat(e.preis).toFixed(2)} €</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>{e.provRate}%</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', color: '#10b981' }}>{e.amount.toFixed(2)} €</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7} style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'rgba(16,185,129,0.06)', fontWeight: '700', textAlign: 'right', color: 'var(--text2)' }}>Gesamt:</td>
                  <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'rgba(16,185,129,0.06)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', color: '#10b981' }}>{zpEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)', fontSize: '12px' }}>
            {reservations.length === 0 ? 'Keine Reservierungen vorhanden.' : `Für ${zahlungsplanYear} keine Zahlungen geplant.`}
          </div>
        )}
      </div>
      {/* Harcama Raporu */}
      {expenses.length > 0 && (
      <div style={{ 
        background: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: '12px', 
        padding: '24px' 
      }}>
        <div className="report-header">
          <div className="report-title-area">
            <h2>Harcama Raporu</h2>
            <div className="report-date">{reportDate}</div>
          </div>
          <div className="report-total">€{total.toFixed(2)}</div>
        </div>

        <div className="report-categories">
          {sortedCats.map(([cat, amt]) => (
            <div key={cat} className="report-cat-card">
              <div className="report-cat-name">
                {CAT_EMOJI[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </div>
              <div 
                className="report-cat-amt" 
                style={{ color: CAT_COLORS[cat] }}
              >
                €{amt.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div className="report-footer">
          <div className="report-footer-text">
            Insgesamt {expenses.length} Belege
          </div>
          <button className="btn btn-accent btn-sm" onClick={onExport}>
            ↓ Excel Herunterladen
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

export default ReportView;
