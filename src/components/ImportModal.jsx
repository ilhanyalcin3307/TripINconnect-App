import React, { useState, useRef } from 'react';

function ImportModal({ onClose, onSave, showToast }) {
  const [step, setStep] = useState('upload'); // upload, preview, done
  const [parsedData, setParsedData] = useState([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const reader = new FileReader();
      
      reader.onload = (ev) => {
        try {
          const text = ev.target.result;
          
          // CSV parse et
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            showToast('⚠️ Nicht genügend Daten in der Datei');
            return;
          }

          // İlk satırı header olarak kullan
          const headerLine = lines[0];
          const headers = parseCSVLine(headerLine);
          
          // Header mapping (esneklik için farklı isimleri kabul et)
          const headerMap = {};
          headers.forEach((h, idx) => {
            const normalized = String(h).toLowerCase().trim();
            if (normalized.includes('tarih') || normalized.includes('date')) headerMap.tarih = idx;
            if (normalized.includes('fiş') || normalized.includes('fis') || normalized.includes('invoice')) headerMap.fisno = idx;
            if (normalized.includes('açıklama') || normalized.includes('aciklama') || normalized.includes('description')) headerMap.aciklama = idx;
            if (normalized.includes('tutar') || normalized.includes('amount') || normalized.includes('betrag')) headerMap.tutar = idx;
            if (normalized.includes('para') || normalized.includes('currency') || normalized.includes('währung')) headerMap.currency = idx;
            if (normalized.includes('kategori') || normalized.includes('category')) headerMap.kategori = idx;
            if (normalized.includes('otel') || normalized.includes('hotel')) headerMap.otel = idx;
            if (normalized.includes('not') || normalized.includes('note')) headerMap.not = idx;
          });

          // Verileri parse et
          const expenses = lines
            .slice(1)
            .map((line, idx) => {
              const values = parseCSVLine(line);
              if (!values[headerMap.tarih]) return null;

              return {
                id: `import-${Date.now()}-${idx}`,
                tarih: parseDateString(values[headerMap.tarih]),
                fisno: values[headerMap.fisno] ? String(values[headerMap.fisno]) : '',
                aciklama: values[headerMap.aciklama] ? String(values[headerMap.aciklama]) : '',
                tutar: values[headerMap.tutar] ? parseFloat(String(values[headerMap.tutar]).replace(',', '.')) : 0,
                currency: values[headerMap.currency] ? String(values[headerMap.currency]) : 'EUR',
                kategori: values[headerMap.kategori] ? String(values[headerMap.kategori]) : 'seyahat',
                otel: values[headerMap.otel] ? String(values[headerMap.otel]) : 'Genel',
                not: values[headerMap.not] ? String(values[headerMap.not]) : '',
                hasReceipt: false
              };
            })
            .filter(Boolean);

          if (expenses.length === 0) {
            showToast('⚠️ Keine gültigen Ausgaben gefunden');
            return;
          }

          setParsedData(expenses);
          setStep('preview');
          showToast(`✓ ${expenses.length} Ausgaben gefunden`);

        } catch (err) {
          console.error('Parse error:', err);
          showToast('⚠️ Datei konnte nicht gelesen werden: ' + err.message);
        }
      };

      reader.readAsText(file);

    } catch (err) {
      console.error('File read error:', err);
      showToast('⚠️ Datei konnte nicht hochgeladen werden');
    }
  };

  // CSV satırını parse et (virgül veya noktalı virgülle ayrılmış)
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  // Tarih string'ini parse et
  const parseDateString = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    // YYYY-MM-DD formatı
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // DD.MM.YYYY veya DD/MM/YYYY
    const match = dateStr.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Fallback
    return new Date().toISOString().split('T')[0];
  };

  const handleSaveAll = async () => {
    try {
      // Tüm harcamaları kaydet
      for (const expense of parsedData) {
        await onSave(expense);
      }
      
      setStep('done');
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Save error:', err);
      showToast('⚠️ Fehler beim Speichern');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal" style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h3>📅 Ausgaben Massenimport</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {step === 'upload' && (
            <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div className="drop-icon">📊</div>
              <div className="drop-title">CSV-Datei hochladen</div>
              <div className="drop-sub">Als CSV aus Excel speichern und hochladen</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '16px', textAlign: 'left', maxWidth: '400px' }}>
                <strong>Erwartete Spalten:</strong><br/>
                • Datum (Pflichtfeld)<br/>
                • Beleg-Nr.<br/>
                • Beschreibung<br/>
                • Betrag (Pflichtfeld)<br/>
                • Währung<br/>
                • Kategorie<br/>
                • Hotel<br/>
                • Notiz
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg2)', borderRadius: '8px' }}>
                <strong>📄 {fileName}</strong><br/>
                <span style={{ fontSize: '13px', color: 'var(--text2)' }}>
                  {parsedData.length} Ausgaben gefunden • Gesamt: {parsedData.reduce((sum, e) => sum + e.tutar, 0).toFixed(2)} EUR
                </span>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Datum</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Beleg-Nr.</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Beschreibung</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Betrag</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Währung</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Kategorie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((expense, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px' }}>{expense.tarih}</td>
                        <td style={{ padding: '8px' }}>{expense.fisno || '-'}</td>
                        <td style={{ padding: '8px' }}>{expense.aciklama}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{expense.tutar.toFixed(2)}</td>
                        <td style={{ padding: '8px' }}>{expense.currency}</td>
                        <td style={{ padding: '8px' }}>{expense.kategori}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setStep('upload')}>
                  ← Zurück
                </button>
                <button className="btn btn-accent" onClick={handleSaveAll}>
                  ✓ Alle Speichern ({parsedData.length})
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
              <h3 style={{ marginBottom: '8px' }}>Erfolgreich!</h3>
              <p style={{ color: 'var(--text2)' }}>
                {parsedData.length} Ausgaben wurden dem System hinzugefügt
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
