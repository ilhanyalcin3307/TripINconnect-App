import React, { useState } from 'react';

const fmtEur = (val) => val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const COLUMNS = [
  { key: 'kasseTyp',     label: 'Zahlungsart',  width: '100px' },
  { key: 'provPct',      label: 'Prov %',       width: '90px'  },
  { key: 'zahlung',      label: 'Prov. Zahlung', width: '120px' },
  { key: 'berechnung',   label: 'Berechnung',   width: '120px' },
  { key: 'gesamtumsatz', label: 'Gesamtumsatz', width: '130px' },
];

const DEFAULT_ENTRY = {
  gruppe: '', provPct: 10, zusatzprovision: '', zusatzPct: '', berechnung: 'Rückreisedatum', tage: '30',
  anzahlungPct: '30', rbiBerechnung: '', restzahlung: '', dkiModel: 'Nacher', rbiModel: 'Nacher',
  kasseTyp: 'DKI'
};

function BudgetView({ categories, setCategories, agenturData = {}, setAgenturData, reservations = [] }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [editForm, setEditForm] = useState({ ...DEFAULT_ENTRY });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', name: '', gruppe: '', ...DEFAULT_ENTRY });
  const [showSelectEditModal, setShowSelectEditModal] = useState(false);
  const [selectEditCode, setSelectEditCode] = useState('');
  const [selectEditGruppe, setSelectEditGruppe] = useState('');
  const [selectedAgencies, setSelectedAgencies] = useState([]);
  const [secondForm, setSecondForm] = useState({ ...DEFAULT_ENTRY });
  const [secondSelected, setSecondSelected] = useState([]);
  const [thirdForm, setThirdForm] = useState({ ...DEFAULT_ENTRY });
  const [ansicht] = useState('agentur'); // sabit: sadece Alle Agenturen
  const [filterGruppe, setFilterGruppe] = useState('all');
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
    const merged = { ...DEFAULT_ENTRY, ...(agenturData[code] || {}) };
    if (!merged.rbiBerechnung) merged.rbiBerechnung = 'Buchungsdatum';
    if (!merged.restzahlung)   merged.restzahlung   = '30';
    if (!merged.berechnung)    merged.berechnung     = 'Rückreisedatum';
    if (!merged.tage)          merged.tage           = '30';
    setEditForm(merged);
    setIsEditModalOpen(true);
  };

  const saveEdit = () => {
    if (editForm.berechnung && !editForm.tage) {
      alert('Bitte Tage (1–30) auswählen.');
      return;
    }
    const { gruppe, provPct, zusatzprovision, zusatzPct, berechnung, tage,
            kasseTyp, dkiModel, rbiModel, rbiBerechnung, restzahlung, anzahlungPct } = editForm;
    const oldGruppe = (agenturData[editingCode]?.gruppe || '').trim();
    const newGruppe = (gruppe || '').trim();

    setAgenturData(prev => {
      const next = { ...prev };
      // Aktuelle Agentur speichern
      next[editingCode] = { gruppe: newGruppe, provPct, zusatzprovision, zusatzPct, berechnung, tage,
                           kasseTyp, dkiModel, rbiModel, rbiBerechnung, restzahlung, anzahlungPct };
      // Wenn Gruppe umbenannt wurde → alle anderen Acentas der alten Gruppe ebenfalls aktualisieren
      if (oldGruppe && newGruppe && oldGruppe !== newGruppe) {
        Object.keys(next).forEach(code => {
          if (code !== editingCode && (next[code]?.gruppe || '').trim() === oldGruppe) {
            next[code] = { ...next[code], gruppe: newGruppe };
          }
        });
      }
      return next;
    });
    setIsEditModalOpen(false);
  };

  const saveAdd = () => {
    const code = addForm.code.trim().toUpperCase();
    const name = addForm.name.trim();
    if (!code) { alert('Bitte einen Agentur-Code eingeben.'); return; }
    if (categories.some(c => c.startsWith(code + '|') || c === code)) {
      alert('Dieser Code existiert bereits.'); return;
    }
    setCategories(prev => [...prev, name ? `${code}|${name}` : code].sort((a, b) => {
      const codeA = a.includes('|') ? a.split('|')[0] : a;
      const codeB = b.includes('|') ? b.split('|')[0] : b;
      return codeA.localeCompare(codeB);
    }));
    const { provPct, zusatzprovision, zusatzPct, berechnung, tage,
            kasseTyp, dkiModel, rbiModel, rbiBerechnung, restzahlung, anzahlungPct } = addForm;
    setAgenturData(prev => ({ ...prev, [code]: { gruppe: addForm.gruppe || '', provPct, zusatzprovision, zusatzPct, berechnung, tage,
                                                 kasseTyp, dkiModel, rbiModel, rbiBerechnung, restzahlung, anzahlungPct } }));
    setAddForm({ code: '', name: '', gruppe: '', ...DEFAULT_ENTRY });
    setShowAddModal(false);
  };

  const deleteAgentur = (code) => {
    setCategories(prev => prev.filter(c => {
      const [c2] = c.includes('|') ? c.split('|') : [c];
      return c2 !== code;
    }));
    setAgenturData(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const renderAgenturRow = (category, code, name, entry) => (
    <tr key={category}>
      <td style={{
        padding: '8px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        position: 'sticky',
        left: 0,
        zIndex: 2
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>
          {(entry.gruppe || '').trim() || '—'}
        </span>
      </td>
      <td style={{
        padding: '8px',
        border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontWeight: '700', fontSize: '11px', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{code}</span>
          <span style={{ fontSize: '10px', color: 'var(--text2)' }}>{name}</span>
        </div>
      </td>
      {COLUMNS.map(col => {
        if (col.key === 'kasseTyp') {
          const typ = entry.kasseTyp || 'DKI';
          const isDKI = typ === 'DKI';
          return (
            <td key="kasseTyp" style={{
              padding: '8px', border: '1px solid var(--border)', textAlign: 'center'
            }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '700',
                fontFamily: "'JetBrains Mono', monospace",
                background: isDKI ? 'rgba(0,184,122,0.15)' : 'rgba(0,184,255,0.15)',
                color: isDKI ? 'var(--accent)' : 'var(--accent2)',
                border: `1px solid ${isDKI ? 'rgba(0,184,122,0.3)' : 'rgba(0,184,255,0.3)'}`
              }}>
                {typ}
              </span>
            </td>
          );
        }
        if (col.key === 'zahlung') {
          const total = getZahlung(code);
          return (
            <td key="zahlung" style={{
              padding: '8px', border: '1px solid var(--border)', textAlign: 'right',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '11px',
              color: total > 0 ? '#10b981' : 'var(--text2)'
            }}>
              {total > 0 ? fmtEur(total) : '—'}
            </td>
          );
        }
        if (col.key === 'gesamtumsatz') {
          const total = getGesamtumsatz(code);
          return (
            <td key="gesamtumsatz" style={{
              padding: '8px', border: '1px solid var(--border)', textAlign: 'right',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', fontSize: '11px',
              color: total > 0 ? 'var(--text)' : 'var(--text2)'
            }}>
              {total > 0 ? fmtEur(total) : '—'}
            </td>
          );
        }
        const val = entry[col.key];
        const display = val !== '' && val !== null && val !== undefined ? val : '—';
        const isNumCol = col.key === 'provPct' || col.key === 'zusatzPct';
        if (col.key === 'berechnung') {
          const typ = entry.kasseTyp || 'DKI';
          let text = '—';
          if (typ === 'DKI') {
            const parts = [
              `${entry.tage || '30'} Tage`,
              entry.dkiModel || 'Nacher',
              entry.berechnung || 'Rückreisedatum',
            ];
            text = parts.join(' · ');
          } else {
            const parts = [
              `${entry.restzahlung || '30'} Tage`,
              entry.rbiModel || 'Nacher',
              entry.rbiBerechnung || 'Buchungsdatum',
            ];
            text = parts.join(' · ');
          }
          return (
            <td key={col.key} style={{
              padding: '8px', border: '1px solid var(--border)', textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: '400',
              color: text !== '—' ? 'var(--text)' : 'var(--text2)', fontSize: '11px'
            }}>{text}</td>
          );
        }
        return (
          <td key={col.key} style={{
            padding: '8px', border: '1px solid var(--border)', textAlign: 'center',
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

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Agentur Planung</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setEditForm({ ...DEFAULT_ENTRY }); setShowSelectEditModal(true); }}
            style={{ fontSize: '11px', padding: '5px 12px' }}
          >
            ✏️ Agentur bearbeiten
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ fontSize: '11px', padding: '5px 12px' }}
          >
            + Agentur hinzufügen
          </button>
        </div>
      </div>

      {/* Filterleiste */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        padding: '10px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: '500' }}>🔍 Filter:</span>

        {/* Gruppen-Filter Dropdown */}
        {(() => {
          const gruppen = [...new Set(
            categories.map(c => {
              const [code] = c.includes('|') ? c.split('|') : [c];
              return (agenturData[code]?.gruppe || '').trim();
            }).filter(Boolean)
          )].sort();
          if (gruppen.length === 0) return null;
          return (
            <>
              <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: '500' }}>Gruppe:</span>
              <select
                value={filterGruppe}
                onChange={e => setFilterGruppe(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="all">Alle Gruppen</option>
                {gruppen.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {filterGruppe !== 'all' && (
                <button
                  onClick={() => setFilterGruppe('all')}
                  style={{
                    padding: '4px 10px', borderRadius: '6px',
                    border: '1px solid rgba(255,77,77,0.3)',
                    background: 'rgba(255,77,77,0.1)',
                    color: 'var(--red)', fontSize: '10px', fontWeight: '500', cursor: 'pointer'
                  }}
                >✕ Zurücksetzen</button>
              )}
            </>
          );
        })()}
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
                minWidth: '140px',
                textAlign: 'left'
              }}>
                Agentur Gruppe
              </th>
              <th style={{
                padding: '10px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontWeight: '700',
                color: 'var(--text)',
                textAlign: 'left',
                minWidth: '180px'
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
            {(() => {
              /* ---- Alle Agenturen (flache Liste, optional nach Gruppe filtern) ---- */
              return categories
                .filter(cat => {
                  if (filterGruppe === 'all') return true;
                  const [code] = cat.includes('|') ? cat.split('|') : [cat];
                  return (agenturData[code]?.gruppe || '').trim() === filterGruppe;
                })
                .map(category => {
                  const [code, name] = category.includes('|') ? category.split('|') : [category, category];
                  const entry = agenturData[code] || DEFAULT_ENTRY;
                  return renderAgenturRow(category, code, name, entry);
                });
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

      {/* Add Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => setShowAddModal(false)}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '28px',
            width: '420px',
            maxWidth: '95%'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px', color: 'var(--text)' }}>
              Neue Agentur hinzufügen
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>

              {/* Code & Name */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                  Agentur Code *
                </label>
                <input
                  type="text"
                  placeholder="z.B. AX"
                  value={addForm.code}
                  onChange={e => {
                    const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
                    setAddForm(prev => ({ ...prev, code: val }));
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setShowAddModal(false); }}
                  maxLength={4}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                  Agentur Name
                </label>
                <input
                  type="text"
                  placeholder="z.B. ANEX Tour"
                  value={addForm.name}
                  onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setShowAddModal(false); }}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Gruppe — volle Breite */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                  Agentur Gruppe
                </label>
                <input
                  type="text"
                  placeholder="z.B. ANEX Gruppe"
                  value={addForm.gruppe}
                  onChange={e => setAddForm(prev => ({ ...prev, gruppe: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setShowAddModal(false); }}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Gleiche Felder wie Edit Modal */}
              {COLUMNS.filter(col => !['zahlung', 'gesamtumsatz'].includes(col.key)).map(col => (
                <div key={col.key}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                    {col.label}
                  </label>
                  <input
                    type="text"
                    value={addForm[col.key] ?? ''}
                    onChange={e => setAddForm(prev => ({ ...prev, [col.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setShowAddModal(false); }}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              {/* Berechnung */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                  Berechnung
                </label>
                <select
                  value={addForm.berechnung || 'Buchungsdatum'}
                  onChange={e => setAddForm(prev => ({ ...prev, berechnung: e.target.value, tage: e.target.value ? (prev.tage || '1') : '' }))}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
                  }}
                >
                  <option value="Buchungsdatum">Buchungsdatum</option>
                  <option value="Abreisedatum">Abreisedatum</option>
                  <option value="Rückreisedatum">Rückreisedatum</option>
                </select>
              </div>

              {/* Tage */}
              {addForm.berechnung && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' }}>
                    Tage
                  </label>
                  <select
                    value={addForm.tage || '1'}
                    onChange={e => setAddForm(prev => ({ ...prev, tage: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
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
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '8px 18px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={saveAdd}
                style={{
                  padding: '8px 18px', borderRadius: '6px',
                  border: 'none', background: '#3b82f6',
                  color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '700'
                }}
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agentur bearbeiten Modal */}
      {showSelectEditModal && (() => {
        const alleGruppen = [...new Set(
          categories.map(c => {
            const [code] = c.includes('|') ? c.split('|') : [c];
            return (agenturData[code]?.gruppe || '').trim();
          }).filter(Boolean)
        )].sort();

        const selectedGruppe = (editForm.gruppe || '').trim();
        const gruppenAg = selectedGruppe
          ? categories.filter(c => {
              const [code] = c.includes('|') ? c.split('|') : [c];
              return (agenturData[code]?.gruppe || '').trim() === selectedGruppe;
            })
          : [];

        const inputStyle = {
          width: '100%', padding: '8px 10px', borderRadius: '6px',
          border: '1px solid var(--border)', background: 'var(--bg)',
          color: 'var(--text)', fontSize: '12px', outline: 'none', boxSizing: 'border-box'
        };
        const selectStyle = { ...inputStyle, cursor: 'pointer' };
        const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text2)', marginBottom: '4px' };

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
          }}>
            <div style={{
              background: 'var(--surface)', borderRadius: '14px',
              padding: '28px', width: '1000px', maxWidth: '96vw',
              border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              maxHeight: '90vh', overflowY: 'auto'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '22px' }}>
                ✏️ Agentur bearbeiten
              </h3>

              {selectedGruppe && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px',
                  marginBottom: '16px', fontSize: '11px', color: 'var(--text2)'
                }}>
                  🏷 <strong style={{ color: 'var(--accent)' }}>{selectedGruppe}</strong>
                  <span style={{ marginLeft: '10px' }}>{gruppenAg.length} Agentur{gruppenAg.length !== 1 ? 'en' : ''} · Änderungen gelten für alle</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {/* Gruppe */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Gruppe</label>
                  <select
                    value={editForm.gruppe ?? ''}
                    onChange={e => {
                      const g = e.target.value;
                      // Grubun ilk acentasının değerlerini forma yükle
                      if (g) {
                        const groupCats = categories.filter(c => {
                          const [code] = c.includes('|') ? c.split('|') : [c];
                          return (agenturData[code]?.gruppe || '').trim() === g;
                        });
                        const firstCat = groupCats[0];
                        if (firstCat) {
                          const [code] = firstCat.includes('|') ? firstCat.split('|') : [firstCat];
                          setEditForm({ ...DEFAULT_ENTRY, ...(agenturData[code] || {}), gruppe: g });
                        } else {
                          setEditForm(prev => ({ ...prev, gruppe: g }));
                        }
                        setSelectedAgencies(groupCats.map(c => c.includes('|') ? c.split('|')[0] : c));
                        setSecondSelected([]);
                      } else {
                        setEditForm(prev => ({ ...prev, gruppe: g }));
                        setSelectedAgencies([]);
                        setSecondSelected([]);
                      }
                    }}
                    style={selectStyle}
                  >
                    <option value="">— Bitte Gruppe wählen —</option>
                    {alleGruppen.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Acenta Listesi */}
                {selectedGruppe && gruppenAg.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {gruppenAg.map(cat => {
                        const [code, name] = cat.includes('|') ? cat.split('|') : [cat, cat];
                        const checked = selectedAgencies.includes(code);
                        return (
                          <label key={code} style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                            border: `1px solid ${checked ? '#3b82f6' : 'var(--border)'}`,
                            background: checked ? 'rgba(59,130,246,0.1)' : 'var(--bg)',
                            fontSize: '11px', color: checked ? 'var(--accent)' : 'var(--text2)',
                            fontWeight: checked ? '600' : '400', userSelect: 'none'
                          }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedAgencies(prev => {
                                  if (prev.includes(code)) {
                                    setSecondSelected(s => [...s, code]);
                                    return prev.filter(c => c !== code);
                                  } else {
                                    setSecondSelected(s => s.filter(c => c !== code));
                                    return [...prev, code];
                                  }
                                });
                              }}
                              style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: '700' }}>{code}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Kasse Typ Seçimi */}
                <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                  <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>Zahlungsart</label>
                  <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                    {['DKI', 'RBI'].map(typ => {
                      const active = (editForm.kasseTyp || 'DKI') === typ;
                      return (
                        <button key={typ} onClick={() => setEditForm(prev => ({ ...prev, kasseTyp: typ }))}
                          style={{ padding: '8px 24px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                            background: active ? 'var(--accent)' : 'var(--bg)',
                            color: active ? '#fff' : 'var(--text2)', transition: 'all 0.15s',
                            borderRight: typ === 'DKI' ? '1px solid var(--border)' : 'none' }}>
                          {typ === 'DKI' ? '🏦 DKI – Direkt in Kasse' : '🧾 RBI – Reisebüro in Kasse'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DKI Form */}
                {(editForm.kasseTyp || 'DKI') === 'DKI' && (
                <div style={{ gridColumn: '1 / -1', border: '1px solid var(--accent)', borderRadius: '8px', padding: '16px 14px 12px', marginTop: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    {/* Prov % */}
                    <div>
                      <label style={labelStyle}>DKI Prov %</label>
                      <div style={{ position: 'relative' }}>
                        <input type="number" min="0" max="100" step="0.1"
                          value={editForm.provPct ?? ''}
                          onChange={e => setEditForm(prev => ({ ...prev, provPct: e.target.value }))}
                          placeholder="0" style={{ ...inputStyle, paddingRight: '28px' }} />
                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text2)', pointerEvents: 'none' }}>%</span>
                      </div>
                    </div>
                    {/* Berechnung */}
                    <div>
                      <label style={labelStyle}>DKI Berechnung</label>
                      <select value={editForm.berechnung ?? ''}
                        onChange={e => setEditForm(prev => ({ ...prev, berechnung: e.target.value, tage: e.target.value ? (prev.tage || '1') : '' }))}
                        style={selectStyle}>
                        <option value="Buchungsdatum">Buchungsdatum</option>
                        <option value="Abreisedatum">Abreisedatum</option>
                        <option value="Rückreisedatum">Rückreisedatum</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>DKI Tage</label>
                      <select value={editForm.tage || '1'}
                        onChange={e => setEditForm(prev => ({ ...prev, tage: e.target.value }))}
                        style={selectStyle}>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} Tage</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>DKI Model</label>
                      <select value={editForm.dkiModel || 'Nacher'}
                        onChange={e => setEditForm(prev => ({ ...prev, dkiModel: e.target.value }))}
                        style={selectStyle}>
                        <option value="Vorher">Vorher</option>
                        <option value="Nacher">Nacher</option>
                      </select>
                    </div>
                  </div>
                </div>
                )}

                {/* RBI Form */}
                {(editForm.kasseTyp || 'DKI') === 'RBI' && (
                <div style={{ gridColumn: '1 / -1', border: '1px solid var(--accent)', borderRadius: '8px', padding: '16px 14px 12px', marginTop: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>RBI Anzahlung %</label>
                      <div style={{ position: 'relative' }}>
                        <input type="number" min="0" max="100" step="1"
                          value={editForm.anzahlungPct ?? ''}
                          onChange={e => setEditForm(prev => ({ ...prev, anzahlungPct: e.target.value }))}
                          placeholder="0" style={{ ...inputStyle, paddingRight: '28px' }} />
                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text2)', pointerEvents: 'none' }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>RBI Berechnung</label>
                      <select value={editForm.rbiBerechnung ?? ''}
                        onChange={e => setEditForm(prev => ({ ...prev, rbiBerechnung: e.target.value }))}
                        style={selectStyle}>
                        <option value="Buchungsdatum">Buchungsdatum</option>
                        <option value="Abreisedatum">Abreisedatum</option>
                        <option value="Rückreisedatum">Rückreisedatum</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>RBI Restzahlung</label>
                      <select value={editForm.restzahlung || '30'}
                        onChange={e => setEditForm(prev => ({ ...prev, restzahlung: e.target.value }))}
                        style={selectStyle}>
                        {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} Tage</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>RBI Model</label>
                      <select value={editForm.rbiModel || 'Nacher'}
                        onChange={e => setEditForm(prev => ({ ...prev, rbiModel: e.target.value }))}
                        style={selectStyle}>
                        <option value="Vorher">Vorher</option>
                        <option value="Nacher">Nacher</option>
                      </select>
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* İkinci Form: seçimden çıkarılan acentalar */}
              {(() => {
                const allCodes = gruppenAg.map(c => c.includes('|') ? c.split('|')[0] : c);
                const deselected = allCodes.filter(code => !selectedAgencies.includes(code));
                if (!selectedGruppe || deselected.length === 0) return null;
                const thirdCodes = deselected.filter(code => !secondSelected.includes(code));
                return (
                  <div style={{ marginTop: '20px', border: '1px solid #f59e0b', borderRadius: '10px', padding: '18px 14px 14px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '-10px', left: '12px', background: 'var(--surface)', padding: '0 8px', fontSize: '11px', fontWeight: '700', color: '#f59e0b', letterSpacing: '0.5px' }}>
                      ✦ Abweichende Einstellungen
                    </span>
                    {/* Checkbox listesi */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {deselected.map(code => {
                        const checked2 = secondSelected.includes(code);
                        return (
                          <label key={code} style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                            border: `1px solid ${checked2 ? '#f59e0b' : 'var(--border)'}`,
                            background: checked2 ? 'rgba(245,158,11,0.12)' : 'var(--bg)',
                            fontSize: '11px', fontWeight: checked2 ? '600' : '400',
                            color: checked2 ? '#f59e0b' : 'var(--text2)', userSelect: 'none'
                          }}>
                            <input
                              type="checkbox"
                              checked={checked2}
                              onChange={() => setSecondSelected(prev =>
                                prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
                              )}
                              style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: '700' }}>{code}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* 2. Kasse Toggle */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Zahlungsart</label>
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                          {['DKI', 'RBI'].map(typ => {
                            const active = (secondForm.kasseTyp || 'DKI') === typ;
                            return (
                              <button key={typ} onClick={() => setSecondForm(prev => ({ ...prev, kasseTyp: typ }))}
                                style={{ padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                                  background: active ? 'var(--accent)' : 'var(--bg)',
                                  color: active ? '#fff' : 'var(--text2)', transition: 'all 0.15s',
                                  borderRight: typ === 'DKI' ? '1px solid var(--border)' : 'none' }}>
                                {typ === 'DKI' ? '🏦 DKI' : '🧾 RBI'}
                              </button>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text2)' }}>
                          {(secondForm.kasseTyp||'DKI') === 'DKI' ? 'Direkt in Kasse' : 'Reisebüro in Kasse'}
                        </span>
                      </div>

                      {/* 2. DKI Fields */}
                      {(secondForm.kasseTyp || 'DKI') === 'DKI' && (
                      <div style={{ border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', gridColumn: '2' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>DKI Prov %</label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" min="0" max="100" step="0.1"
                                value={secondForm.provPct ?? ''}
                                onChange={e => setSecondForm(prev => ({ ...prev, provPct: e.target.value }))}
                                placeholder="0" style={{ ...inputStyle, paddingRight: '28px' }} />
                              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text2)', pointerEvents: 'none' }}>%</span>
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>DKI Berechnung</label>
                            <select value={secondForm.berechnung ?? ''}
                              onChange={e => setSecondForm(prev => ({ ...prev, berechnung: e.target.value, tage: e.target.value ? (prev.tage || '1') : '' }))}
                              style={selectStyle}>
                              <option value="Buchungsdatum">Buchungsdatum</option>
                              <option value="Abreisedatum">Abreisedatum</option>
                              <option value="Rückreisedatum">Rückreisedatum</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>DKI Tage</label>
                            <select value={secondForm.tage || '1'}
                              onChange={e => setSecondForm(prev => ({ ...prev, tage: e.target.value }))}
                              style={selectStyle}>
                              {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n} Tage</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>DKI Model</label>
                            <select value={secondForm.dkiModel || 'Nacher'}
                              onChange={e => setSecondForm(prev => ({ ...prev, dkiModel: e.target.value }))}
                              style={selectStyle}>
                              <option value="Vorher">Vorher</option>
                              <option value="Nacher">Nacher</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* 2. RBI Fields */}
                      {(secondForm.kasseTyp || 'DKI') === 'RBI' && (
                      <div style={{ border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', gridColumn: '2' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>RBI Anzahlung %</label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" min="0" max="100" step="1"
                                value={secondForm.anzahlungPct ?? ''}
                                onChange={e => setSecondForm(prev => ({ ...prev, anzahlungPct: e.target.value }))}
                                placeholder="0" style={{ ...inputStyle, paddingRight: '28px' }} />
                              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text2)', pointerEvents: 'none' }}>%</span>
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>RBI Berechnung</label>
                            <select value={secondForm.rbiBerechnung ?? ''}
                              onChange={e => setSecondForm(prev => ({ ...prev, rbiBerechnung: e.target.value }))}
                              style={selectStyle}>
                              <option value="Buchungsdatum">Buchungsdatum</option>
                              <option value="Abreisedatum">Abreisedatum</option>
                              <option value="Rückreisedatum">Rückreisedatum</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>RBI Restzahlung</label>
                            <select value={secondForm.restzahlung || '30'}
                              onChange={e => setSecondForm(prev => ({ ...prev, restzahlung: e.target.value }))}
                              style={selectStyle}>
                              {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n} Tage</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>RBI Model</label>
                            <select value={secondForm.rbiModel || 'Nacher'}
                              onChange={e => setSecondForm(prev => ({ ...prev, rbiModel: e.target.value }))}
                              style={selectStyle}>
                              <option value="Vorher">Vorher</option>
                              <option value="Nacher">Nacher</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>

                    {/* Üçüncü Blok: ikinci listeden de çıkarılanlar */}
                    {thirdCodes.length > 0 && (
                      <div style={{ marginTop: '16px', border: '1px solid #ef4444', borderRadius: '8px', padding: '16px 12px 12px', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: '-9px', left: '10px', background: 'var(--surface)', padding: '0 6px', fontSize: '10px', fontWeight: '700', color: '#ef4444' }}>
                          ✦ Weitere Ausnahmen
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                          {thirdCodes.map(code => (
                            <span key={code} style={{ padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{code}</span>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {/* 3. Kasse Toggle */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Zahlungsart</label>
                            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                              {['DKI', 'RBI'].map(typ => {
                                const active = (thirdForm.kasseTyp || 'DKI') === typ;
                                return (
                                  <button key={typ} onClick={() => setThirdForm(prev => ({ ...prev, kasseTyp: typ }))}
                                    style={{ padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                                      background: active ? 'var(--accent)' : 'var(--bg)',
                                      color: active ? '#fff' : 'var(--text2)', transition: 'all 0.15s',
                                      borderRight: typ === 'DKI' ? '1px solid var(--border)' : 'none' }}>
                                    {typ === 'DKI' ? '🏦 DKI' : '🧾 RBI'}
                                  </button>
                                );
                              })}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text2)' }}>
                              {(thirdForm.kasseTyp||'DKI') === 'DKI' ? 'Direkt in Kasse' : 'Reisebüro in Kasse'}
                            </span>
                          </div>

                          {/* 3. DKI Fields */}
                          {(thirdForm.kasseTyp || 'DKI') === 'DKI' && (
                          <div style={{ border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <label style={labelStyle}>DKI Prov %</label>
                                <div style={{ position: 'relative' }}>
                                  <input type="number" min="0" max="100" step="0.1"
                                    value={thirdForm.provPct ?? ''}
                                    onChange={e => setThirdForm(prev => ({ ...prev, provPct: e.target.value }))}
                                    placeholder="0" style={{ ...inputStyle, paddingRight: '28px' }} />
                                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text2)', pointerEvents: 'none' }}>%</span>
                                </div>
                              </div>
                              <div>
                                <label style={labelStyle}>DKI Berechnung</label>
                                <select value={thirdForm.berechnung ?? ''}
                                  onChange={e => setThirdForm(prev => ({ ...prev, berechnung: e.target.value, tage: e.target.value ? (prev.tage || '1') : '' }))}
                                  style={selectStyle}>
                                  <option value="Buchungsdatum">Buchungsdatum</option>
                                  <option value="Abreisedatum">Abreisedatum</option>
                                  <option value="Rückreisedatum">Rückreisedatum</option>
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>DKI Tage</label>
                                <select value={thirdForm.tage || '1'}
                                  onChange={e => setThirdForm(prev => ({ ...prev, tage: e.target.value }))}
                                  style={selectStyle}>
                                  {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={n}>{n} Tage</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>DKI Model</label>
                                <select value={thirdForm.dkiModel || 'Nacher'}
                                  onChange={e => setThirdForm(prev => ({ ...prev, dkiModel: e.target.value }))}
                                  style={selectStyle}>
                                  <option value="Vorher">Vorher</option>
                                  <option value="Nacher">Nacher</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          )}

                          {/* 3. RBI Fields */}
                          {(thirdForm.kasseTyp || 'DKI') === 'RBI' && (
                          <div style={{ border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <label style={labelStyle}>RBI Anzahlung %</label>
                                <div style={{ position: 'relative' }}>
                                  <input type="number" min="0" max="100" step="1"
                                    value={thirdForm.anzahlungPct ?? ''}
                                    onChange={e => setThirdForm(prev => ({ ...prev, anzahlungPct: e.target.value }))}
                                    placeholder="0" style={{ ...inputStyle, paddingRight: '28px' }} />
                                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text2)', pointerEvents: 'none' }}>%</span>
                                </div>
                              </div>
                              <div>
                                <label style={labelStyle}>RBI Berechnung</label>
                                <select value={thirdForm.rbiBerechnung ?? ''}
                                  onChange={e => setThirdForm(prev => ({ ...prev, rbiBerechnung: e.target.value }))}
                                  style={selectStyle}>
                                  <option value="Buchungsdatum">Buchungsdatum</option>
                                  <option value="Abreisedatum">Abreisedatum</option>
                                  <option value="Rückreisedatum">Rückreisedatum</option>
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>RBI Restzahlung</label>
                                <select value={thirdForm.restzahlung || '30'}
                                  onChange={e => setThirdForm(prev => ({ ...prev, restzahlung: e.target.value }))}
                                  style={selectStyle}>
                                  {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={n}>{n} Tage</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>RBI Model</label>
                                <select value={thirdForm.rbiModel || 'Nacher'}
                                  onChange={e => setThirdForm(prev => ({ ...prev, rbiModel: e.target.value }))}
                                  style={selectStyle}>
                                  <option value="Vorher">Vorher</option>
                                  <option value="Nacher">Nacher</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => { setShowSelectEditModal(false); setEditForm({ ...DEFAULT_ENTRY }); setSecondForm({ ...DEFAULT_ENTRY }); setThirdForm({ ...DEFAULT_ENTRY }); setSelectedAgencies([]); setSecondSelected([]); }}
                  style={{
                    padding: '8px 16px', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text2)', fontSize: '12px', cursor: 'pointer'
                  }}
                >Abbrechen</button>
                <button
                  disabled={!selectedGruppe}
                  onClick={() => {
                    if (!selectedGruppe) return;
                    setAgenturData(prev => {
                      const next = { ...prev };
                      const allCodes = gruppenAg.map(c => c.includes('|') ? c.split('|')[0] : c);
                      const deselected = allCodes.filter(code => !selectedAgencies.includes(code));
                      // Seçili acentalara ana form
                      gruppenAg.filter(cat => {
                        const [code] = cat.includes('|') ? cat.split('|') : [cat];
                        return selectedAgencies.includes(code);
                      }).forEach(cat => {
                        const [code] = cat.includes('|') ? cat.split('|') : [cat];
                        next[code] = {
                          ...next[code],
                          provPct: editForm.provPct,
                          zusatzprovision: editForm.zusatzprovision,
                          zusatzPct: editForm.zusatzPct,
                          berechnung: editForm.berechnung,
                          tage: editForm.tage,
                          anzahlungPct: editForm.anzahlungPct,
                          rbiBerechnung: editForm.rbiBerechnung,
                          restzahlung: editForm.restzahlung,
                          dkiModel: editForm.dkiModel,
                          rbiModel: editForm.rbiModel,
                          kasseTyp: editForm.kasseTyp || 'DKI',
                          gruppe: selectedGruppe,
                        };
                      });
                      // Seçimden çıkarılan acentalara ikinci form (secondSelected içindekiler)
                      deselected.filter(code => secondSelected.includes(code)).forEach(code => {
                        next[code] = {
                          ...next[code],
                          provPct: secondForm.provPct,
                          zusatzprovision: secondForm.zusatzprovision,
                          zusatzPct: secondForm.zusatzPct,
                          berechnung: secondForm.berechnung,
                          tage: secondForm.tage,
                          anzahlungPct: secondForm.anzahlungPct,
                          rbiBerechnung: secondForm.rbiBerechnung,
                          restzahlung: secondForm.restzahlung,
                          dkiModel: secondForm.dkiModel,
                          rbiModel: secondForm.rbiModel,
                          kasseTyp: secondForm.kasseTyp || 'DKI',
                          gruppe: selectedGruppe,
                        };
                      });
                      // Üçüncü form: ikinci listeden de çıkarılanlar
                      const thirdCodes = deselected.filter(code => !secondSelected.includes(code));
                      thirdCodes.forEach(code => {
                        next[code] = {
                          ...next[code],
                          provPct: thirdForm.provPct,
                          zusatzprovision: thirdForm.zusatzprovision,
                          zusatzPct: thirdForm.zusatzPct,
                          berechnung: thirdForm.berechnung,
                          tage: thirdForm.tage,
                          anzahlungPct: thirdForm.anzahlungPct,
                          rbiBerechnung: thirdForm.rbiBerechnung,
                          restzahlung: thirdForm.restzahlung,
                          dkiModel: thirdForm.dkiModel,
                          rbiModel: thirdForm.rbiModel,
                          kasseTyp: thirdForm.kasseTyp || 'DKI',
                          gruppe: selectedGruppe,
                        };
                      });
                      return next;
                    });
                    setShowSelectEditModal(false);
                    setEditForm({ ...DEFAULT_ENTRY });
                    setSecondForm({ ...DEFAULT_ENTRY });
                    setThirdForm({ ...DEFAULT_ENTRY });
                    setSelectedAgencies([]);
                    setSecondSelected([]);
                  }}
                  style={{
                    padding: '8px 18px', borderRadius: '6px',
                    border: 'none',
                    background: selectedGruppe ? '#3b82f6' : 'var(--border)',
                    color: 'white', fontSize: '12px', fontWeight: '700',
                    cursor: selectedGruppe ? 'pointer' : 'not-allowed'
                  }}
                >💾 Speichern</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default BudgetView;
