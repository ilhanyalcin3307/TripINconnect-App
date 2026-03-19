import React, { useState } from 'react';

const COLUMNS = [
  { key: 'provPct',         label: 'Prov %',         width: '90px'  },
  { key: 'zahlung',         label: 'Zahlung',         width: '120px' },
  { key: 'zusatzprovision', label: 'Zusatzprovision', width: '140px' },
  { key: 'zusatzPct',       label: 'Zusatz %',        width: '90px'  },
  { key: 'berechnung',      label: 'Berechnung',      width: '120px' },
  { key: 'gesamtumsatz',    label: 'Gesamtumsatz',    width: '130px' },
];

const DEFAULT_ENTRY = {
  provPct: 10, zusatzprovision: '', zusatzPct: '', berechnung: 'Abreisedatum', tage: '30'
};

function BudgetView({ categories, setCategories, agenturData = {}, setAgenturData, reservations = [] }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [editForm, setEditForm] = useState({ ...DEFAULT_ENTRY });
  // Belirli agentur kodu için rezervasyonlardan Prov € toplamını hesapla
  const getZahlung = (code) => {
    return reservations.reduce((sum, r) => {
      const va = (r.gebuchteVA || '').trim().toUpperCase();
      if (va !== code.toUpperCase()) return sum;
      const preis = parseFloat(r.reisepreis) || 0;
      const provStr = String(r.provisionRate || '').replace('%', '').trim();
      const provRate = parseFloat(provStr) || 0;
      return sum + (preis * provRate / 100);
    }, 0);
  };

  // Belirli agentur kodu için rezervasyonlardan toplam Reisepreis (Gesamtumsatz) hesapla
  const getGesamtumsatz = (code) => {
    return reservations.reduce((sum, r) => {
      const va = (r.gebuchteVA || '').trim().toUpperCase();
      if (va !== code.toUpperCase()) return sum;
      return sum + (parseFloat(r.reisepreis) || 0);
    }, 0);
  };

  // Edit butonuna basılınca: ilgili koden mevcut değerleri modal'a yükle
  const openEditModal = (code) => {
    setEditingCode(code);
    setEditForm({ ...DEFAULT_ENTRY, ...(agenturData[code] || {}) });
    setIsEditModalOpen(true);
  };

  const saveEdit = () => {
    if (editForm.berechnung && !editForm.tage) {
      alert('Bitte Tage (1–30) auswählen.');
      return;
    }
    const { provPct, zusatzprovision, zusatzPct, berechnung, tage } = editForm;
    setAgenturData(prev => ({ ...prev, [editingCode]: { provPct, zusatzprovision, zusatzPct, berechnung, tage } }));
    setIsEditModalOpen(false);
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Agentur Planung</div>
      </div>

      {/* Agentur tablosu */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{
                padding: '10px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontWeight: '700',
                color: 'var(--text)',
                position: 'sticky',
                left: 0,
                zIndex: 3,
                minWidth: '180px',
                textAlign: 'left'
              }}>
                Agentur
              </th>
              {COLUMNS.map(col => (
                <th key={col.key} style={{
                  padding: '10px 8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  fontWeight: '700',
                  color: 'var(--text2)',
                  textAlign: 'center',
                  minWidth: col.width
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(category => {
              const [code, name] = category.includes('|') ? category.split('|') : [category, category];
              const entry = agenturData[code] || DEFAULT_ENTRY;

              return (
                <tr key={category}>
                  <td style={{
                    padding: '8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontWeight: '700', fontSize: '11px', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{code}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text2)' }}>{name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openEditModal(code)}
                          title="Bearbeiten"
                          style={{
                            background: 'transparent', border: 'none', color: '#3b82f6',
                            cursor: 'pointer', padding: '2px 5px', borderRadius: '4px',
                            fontSize: '12px', opacity: 0.7
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                        >✏️</button>
                      </div>
                    </div>
                  </td>
                  {COLUMNS.map(col => {
                    // Zahlung: rezervasyonlardan Prov € toplamı
                    if (col.key === 'zahlung') {
                      const total = getZahlung(code);
                      return (
                        <td key="zahlung" style={{
                          padding: '8px',
                          border: '1px solid var(--border)',
                          textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: '700',
                          fontSize: '11px',
                          color: total > 0 ? '#10b981' : 'var(--text2)'
                        }}>
                          {total > 0 ? total.toFixed(2) + ' €' : '—'}
                        </td>
                      );
                    }
                    // Gesamtumsatz: rezervasyonlardan toplam Reisepreis
                    if (col.key === 'gesamtumsatz') {
                      const total = getGesamtumsatz(code);
                      return (
                        <td key="gesamtumsatz" style={{
                          padding: '8px',
                          border: '1px solid var(--border)',
                          textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: '700',
                          fontSize: '11px',
                          color: total > 0 ? 'var(--text)' : 'var(--text2)'
                        }}>
                          {total > 0 ? total.toFixed(2) + ' €' : '—'}
                        </td>
                      );
                    }
                    const val = entry[col.key];
                    const display = val !== '' && val !== null && val !== undefined ? val : '—';
                    const isNumCol = col.key === 'provPct' || col.key === 'zusatzPct';
                    // Berechnung: "Buchungsdatum 14 Tage" formatında göster
                    if (col.key === 'berechnung') {
                      const tage = entry.tage;
                      const text = val ? (tage ? `${val} · ${tage} Tage` : val) : '—';
                      return (
                        <td key={col.key} style={{
                          padding: '8px',
                          border: '1px solid var(--border)',
                          textAlign: 'center',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: '400',
                          color: val ? 'var(--text)' : 'var(--text2)',
                          fontSize: '11px'
                        }}>
                          {text}
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} style={{
                        padding: '8px',
                        border: '1px solid var(--border)',
                        textAlign: 'center',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: isNumCol ? '700' : '400',
                        color: isNumCol && val ? '#10b981' : 'var(--text)',
                        fontSize: '11px'
                      }}>
                        {isNumCol && val ? `${val}%` : display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* GESAMT satırı */}
            {(() => {
              const totalZahlung = categories.reduce((s, cat) => {
                const [c] = cat.includes('|') ? cat.split('|') : [cat];
                return s + getZahlung(c);
              }, 0);
              const totalUmsatz = categories.reduce((s, cat) => {
                const [c] = cat.includes('|') ? cat.split('|') : [cat];
                return s + getGesamtumsatz(c);
              }, 0);
              return (
                <tr>
                  <td style={{
                    padding: '10px 8px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '2px solid var(--accent)',
                    fontWeight: '700',
                    fontSize: '11px',
                    color: 'var(--accent)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2
                  }}>
                    GESAMT ({categories.length} Agenturen)
                  </td>
                  {COLUMNS.map(col => {
                    let content = '—';
                    let color = 'var(--text2)';
                    if (col.key === 'zahlung' && totalZahlung > 0) {
                      content = totalZahlung.toFixed(2) + ' €';
                      color = '#10b981';
                    } else if (col.key === 'gesamtumsatz' && totalUmsatz > 0) {
                      content = totalUmsatz.toFixed(2) + ' €';
                      color = 'var(--text)';
                    }
                    return (
                      <td key={col.key} style={{
                        padding: '8px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '2px solid var(--accent)',
                        textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: '700',
                        fontSize: '11px',
                        color
                      }}>{content}</td>
                    );
                  })}
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '10px 14px',
        background: 'rgba(59, 130, 246, 0.05)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '8px',
        fontSize: '11px',
        color: 'var(--text2)'
      }}>
        💡 <strong>Hinweis:</strong> Prov % wird automatisch auf Reservierungen übertragen, wenn der Veranstalter-Code übereinstimmt. Standard: 10%.
      </div>

      {/* Edit Modal — alle 6 Felder bearbeiten */}
      {isEditModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '28px',
            width: '420px',
            maxWidth: '95%'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', color: 'var(--text)' }}>
              Agentur bearbeiten
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '20px' }}>
              {editingCode} — {categories.find(c => c.startsWith(editingCode + '|'))?.split('|')[1] || editingCode}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              {COLUMNS.filter(col => !['zahlung', 'gesamtumsatz'].includes(col.key)).map(col => (
                <div key={col.key}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                    {col.label}
                  </label>
                  <input
                    type="text"
                    value={editForm[col.key] ?? ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [col.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setIsEditModalOpen(false); }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              {/* Berechnung — Buchungsdatum / Abreisedatum */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                  Berechnung
                </label>
                <select
                  value={editForm.berechnung ?? ''}
                  onChange={e => setEditForm(prev => ({ ...prev, berechnung: e.target.value, tage: e.target.value ? (prev.tage || '1') : '' }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">— bitte wählen —</option>
                  <option value="Buchungsdatum">Buchungsdatum</option>
                  <option value="Abreisedatum">Abreisedatum</option>
                </select>
              </div>

              {/* Tage — 1-30, nur wenn Berechnung gesetzt */}
              {editForm.berechnung && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                    Tage
                  </label>
                  <select
                    value={editForm.tage || '1'}
                    onChange={e => setEditForm(prev => ({ ...prev, tage: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  padding: '8px 18px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={saveEdit}
                style={{
                  padding: '8px 18px', borderRadius: '6px',
                  border: 'none', background: '#3b82f6',
                  color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '700'
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetView;
