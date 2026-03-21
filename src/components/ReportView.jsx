import React, { useState, useMemo, useEffect } from 'react';
import { calcProvisionDates, getPaymentDateColor } from '../lib/provisionUtils';

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
  const [zpFilterType, setZpFilterType] = useState(null); // 'anz' | 'rest' | 'prov' | null
  const [zpSelectedCodes, setZpSelectedCodes] = useState([]); // seçili acenta kodları
  const [zpPage, setZpPage] = useState(0);

  // Filtre değiştiğinde sayfayı sıfırla
  useEffect(() => { setZpPage(0); }, [zpSelectedMonth, zpFilterType, zpSelectedCodes, zahlungsplanYear]);

  const fmt2 = (date) => date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;

  const zahlungsplan = useMemo(() => {
    const entries = [];
    reservations.forEach(r => {
      if (!r.gebuchteVA) return;
      const code = r.gebuchteVA.trim().toUpperCase();
      const ag = agenturData[code] ||
        Object.entries(agenturData).find(([k]) => k.toUpperCase() === code)?.[1];
      const result = calcProvisionDates(r, ag || {});
      if (!result || result.payments.length === 0) return;
      const preis = parseFloat(r.reisepreis) || 0;
      const provStr = String(r.provisionRate || '').replace('%', '').trim();
      const provRate = parseFloat(provStr) || 0;
      const amount = result.payments.reduce((s, p) => s + p.amount, 0);
      if (amount <= 0) return;
      const catEntry = categories.find(c => c.split('|')[0].toUpperCase() === code);
      const agName = catEntry ? (catEntry.split('|')[1] || code) : code;
      const p0 = result.payments[0];
      const p1 = result.payments[1] || null;
      entries.push({
        code, agName, provRate, preis, amount,
        vgNr: r.vgNr || '', kundenName: r.name || '',
        kasseTyp: result.kasseTyp,
        dueDate: p0.date,
        anzDatum: p0.date, anzBetrag: p0.amount,
        restDatum: p1 ? p1.date : null, restBetrag: p1 ? p1.amount : null,
      });
    });
    return entries.sort((a, b) => a.dueDate - b.dueDate);
  }, [reservations, agenturData, categories]);

  const yearEntries = useMemo(
    () => zahlungsplan.filter(e => e.dueDate.getFullYear() === zahlungsplanYear),
    [zahlungsplan, zahlungsplanYear]
  );

  // Ay/tip filtresi sonrası, code filtresi öncesi — chip listesi için
  const zpBaseEntries = useMemo(() => {
    if (zpSelectedMonth === null) return yearEntries;
    if (zpFilterType === 'anz')
      return yearEntries.filter(e => e.anzDatum.getMonth() === zpSelectedMonth);
    if (zpFilterType === 'rest')
      return yearEntries.filter(e => e.restDatum && e.restDatum.getMonth() === zpSelectedMonth);
    if (zpFilterType === 'prov')
      return yearEntries.filter(e => (e.restDatum || e.anzDatum).getMonth() === zpSelectedMonth);
    return yearEntries.filter(e => e.dueDate.getMonth() === zpSelectedMonth);
  }, [yearEntries, zpSelectedMonth, zpFilterType]);

  const zpAvailableCodes = useMemo(
    () => [...new Set(zpBaseEntries.map(e => e.code))].sort(),
    [zpBaseEntries]
  );

  const zpEntries = useMemo(() => {
    if (zpSelectedCodes.length > 0)
      return zpBaseEntries.filter(e => zpSelectedCodes.includes(e.code));
    return zpBaseEntries;
  }, [yearEntries, zpSelectedMonth, zpFilterType, zpSelectedCodes]);

  const ZP_PAGE_SIZE = 100;
  const zpTotalPages = Math.ceil(zpEntries.length / ZP_PAGE_SIZE);
  const zpPagedEntries = zpEntries.slice(zpPage * ZP_PAGE_SIZE, (zpPage + 1) * ZP_PAGE_SIZE);

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
              <span style={{ fontSize: '11px', color: 'var(--text2)', display: 'flex', gap: '12px' }}>
                <span>Anz.: <strong style={{ color: 'var(--accent)' }}>{yearEntries.reduce((s, e) => s + (e.anzBetrag || 0), 0).toFixed(2)} €</strong></span>
                <span>Rest: <strong style={{ color: '#f59e0b' }}>{yearEntries.reduce((s, e) => s + (e.restBetrag || 0), 0).toFixed(2)} €</strong></span>
                <span>Prov.: <strong style={{ color: '#818cf8' }}>{yearEntries.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)} €</strong></span>
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={() => { setZahlungsplanYear(y => y - 1); setZpSelectedMonth(null); setZpFilterType(null); setZpSelectedCodes([]); }}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px' }}>←</button>
              <span style={{ fontWeight: '700', fontSize: '14px', minWidth: '48px', textAlign: 'center' }}>{zahlungsplanYear}</span>
              <button onClick={() => { setZahlungsplanYear(y => y + 1); setZpSelectedMonth(null); setZpFilterType(null); setZpSelectedCodes([]); }}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px' }}>→</button>
            </div>
          </div>
        </div>

        {/* 3-satırlı ızgara */}
        {(() => {
          const ROWS = [
            { key: 'anz',  label: 'Anzahlung',   color: 'var(--accent)',  bg: 'rgba(0,184,122,0.10)',  selBorder: 'var(--accent)',
              getTotal: (idx) => yearEntries.filter(e => e.anzDatum.getMonth() === idx).reduce((s,e) => s+(e.anzBetrag||0),0) },
            { key: 'rest', label: 'Restzahlung', color: '#f59e0b',         bg: 'rgba(245,158,11,0.10)', selBorder: '#f59e0b',
              getTotal: (idx) => yearEntries.filter(e => e.restDatum && e.restDatum.getMonth() === idx).reduce((s,e) => s+(e.restBetrag||0),0) },
            { key: 'prov', label: 'Provision',   color: '#818cf8',         bg: 'rgba(99,102,241,0.10)', selBorder: '#818cf8',
              getTotal: (idx) => yearEntries.filter(e => (e.restDatum||e.anzDatum).getMonth() === idx).reduce((s,e) => s+(e.amount||0),0) },
          ];
          return (
            <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '72px', padding: '0' }} />
                    {MONTHS_DE.map(m => (
                      <th key={m} style={{ padding: '4px 2px', fontSize: '9px', fontWeight: '700', color: 'var(--text2)', textAlign: 'center', letterSpacing: '0.04em' }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(row => (
                    <tr key={row.key}>
                      <td style={{ padding: '2px 6px 2px 0', fontSize: '9px', fontWeight: '700', color: row.color, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {row.label}
                      </td>
                      {MONTHS_DE.map((m, idx) => {
                        const total = row.getTotal(idx);
                        const isActive = zpSelectedMonth === idx && zpFilterType === row.key;
                        const hasData = total > 0;
                        return (
                          <td key={m}
                            onClick={() => {
                              if (isActive) { setZpSelectedMonth(null); setZpFilterType(null); }
                              else if (hasData) { setZpSelectedMonth(idx); setZpFilterType(row.key); }
                            }}
                            style={{
                              padding: '5px 4px',
                              textAlign: 'center',
                              borderRadius: '6px',
                              cursor: hasData ? 'pointer' : 'default',
                              background: isActive ? row.bg : hasData ? 'rgba(0,0,0,0.03)' : 'transparent',
                              border: isActive ? `2px solid ${row.selBorder}` : '1px solid var(--border)',
                              transition: 'all 0.15s',
                              minWidth: '52px'
                            }}
                          >
                            <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: hasData ? '700' : '400', color: hasData ? row.color : 'var(--text2)', whiteSpace: 'nowrap' }}>
                              {hasData ? total.toFixed(0) + ' €' : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {zpEntries.length > 0 || yearEntries.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            {/* Başlık + code filtresi */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              {zpSelectedMonth !== null && (
                <>
                  <span style={{ fontWeight: '700', fontSize: '11px', color: zpFilterType === 'anz' ? 'var(--accent)' : zpFilterType === 'rest' ? '#f59e0b' : '#818cf8' }}>
                    {zpFilterType === 'anz' ? 'Anzahlung' : zpFilterType === 'rest' ? 'Restzahlung' : 'Provision'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>— {MONTHS_DE[zpSelectedMonth]} {zahlungsplanYear}: {zpEntries.length} Eintr{zpEntries.length !== 1 ? 'äge' : 'ag'}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text2)', marginLeft: '4px' }}>{zpTotalPages > 1 ? `(Seite ${zpPage + 1}/${zpTotalPages})` : ''}</span>
                  <button onClick={() => { setZpSelectedMonth(null); setZpFilterType(null); setZpSelectedCodes([]); }}
                    style={{ fontSize: '10px', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Alle anzeigen</button>
                  <span style={{ color: 'var(--border)' }}>|</span>
                </>
              )}
              {/* Code chip'leri — sadece mevcut filtredeki kodlar */}
              {zpAvailableCodes.map(code => {
                const active = zpSelectedCodes.includes(code);
                return (
                  <button key={code} onClick={() => setZpSelectedCodes(prev =>
                    prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
                  )} style={{
                    padding: '2px 9px', borderRadius: '4px', fontSize: '10px',
                    fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer', letterSpacing: '0.04em',
                    background: active ? 'rgba(0,184,122,0.20)' : 'var(--bg)',
                    color: active ? 'var(--accent)' : 'var(--text2)',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'all 0.15s'
                  }}>{code}</button>
                );
              })}
              {zpSelectedCodes.length > 0 && (
                <button onClick={() => setZpSelectedCodes([])}
                  style={{ fontSize: '10px', background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>× Filter löschen</button>
              )}
            </div>
            <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {['Code', 'Agentur', 'VG-Nr.', 'Kunde', 'Preis', 'Prov %', 'Prov €', 'Anz. Datum', 'Anz. Betrag', 'Rest Datum', 'Rest Betrag'].map((h, i) => (
                    <th key={h} style={{
                      padding: '6px 8px',
                      background: i % 2 === 0 ? 'var(--bg)' : 'rgba(0,184,122,0.06)',
                      border: '1px solid var(--border)',
                      borderBottom: '2px solid var(--accent)',
                      fontWeight: '700', fontSize: '9px', letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text2)', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zpPagedEntries.map((e, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '10px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', background: 'rgba(0,184,122,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,184,122,0.28)', letterSpacing: '0.04em' }}>{e.code}</span>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap' }}>{e.agName}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--text2)' }}>{e.vgNr || '—'}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap' }}>{e.kundenName || '—'}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>{parseFloat(e.preis).toFixed(2)} €</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>{e.provRate}%</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', color: '#10b981', whiteSpace: 'nowrap' }}>{e.amount.toFixed(2)} €</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', color: getPaymentDateColor(e.anzDatum), fontWeight: '600' }}>{fmt2(e.anzDatum)}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', whiteSpace: 'nowrap', color: getPaymentDateColor(e.anzDatum), fontWeight: '700' }}>{e.anzBetrag != null ? e.anzBetrag.toFixed(2) + ' €' : '—'}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', color: e.restDatum ? getPaymentDateColor(e.restDatum) : 'var(--text2)', fontWeight: e.restDatum ? '600' : '400' }}>{e.restDatum ? fmt2(e.restDatum) : '—'}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', whiteSpace: 'nowrap', color: e.restDatum ? getPaymentDateColor(e.restDatum) : 'var(--text2)', fontWeight: e.restDatum ? '700' : '400' }}>{e.restBetrag != null ? e.restBetrag.toFixed(2) + ' €' : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={10} style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'rgba(16,185,129,0.06)', fontWeight: '700', textAlign: 'right', color: 'var(--text2)' }}>Gesamt ({zpEntries.length} Eintr{zpEntries.length !== 1 ? 'äge' : 'ag'}):</td>
                  <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'rgba(16,185,129,0.06)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', color: '#10b981', whiteSpace: 'nowrap' }}>{zpEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
            {/* Pagination */}
            {zpTotalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  {zpPage * ZP_PAGE_SIZE + 1}–{Math.min((zpPage + 1) * ZP_PAGE_SIZE, zpEntries.length)} / {zpEntries.length}
                </span>
                <button
                  disabled={zpPage === 0}
                  onClick={() => setZpPage(p => p - 1)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', cursor: zpPage === 0 ? 'default' : 'pointer', color: zpPage === 0 ? 'var(--text2)' : 'var(--text)', fontSize: '13px', opacity: zpPage === 0 ? 0.4 : 1 }}
                >←</button>
                <span style={{ fontWeight: '700', fontSize: '12px', minWidth: '60px', textAlign: 'center', color: 'var(--text)' }}>
                  Seite {zpPage + 1} / {zpTotalPages}
                </span>
                <button
                  disabled={zpPage >= zpTotalPages - 1}
                  onClick={() => setZpPage(p => p + 1)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', cursor: zpPage >= zpTotalPages - 1 ? 'default' : 'pointer', color: zpPage >= zpTotalPages - 1 ? 'var(--text2)' : 'var(--text)', fontSize: '13px', opacity: zpPage >= zpTotalPages - 1 ? 0.4 : 1 }}
                >→</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)', fontSize: '12px' }}>
            {reservations.length === 0 ? 'Keine Reservierungen vorhanden.' : `Für ${zahlungsplanYear} keine Zahlungen geplant.`}
          </div>
        )}
      </div>

    </div>
  );
}

export default ReportView;
