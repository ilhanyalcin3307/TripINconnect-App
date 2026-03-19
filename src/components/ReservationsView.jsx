import React, { useState, useMemo, useEffect } from 'react';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Tesseract from 'tesseract.js';

const STATUS_OPTIONS = [
  { value: 'onaylandi', label: 'Bestätigt', color: '#10b981' },
  { value: 'beklemede', label: 'Ausstehend', color: '#f59e0b' },
  { value: 'iptal', label: 'Storniert', color: '#ef4444' }
];

const MONTHS = [
  { value: 'all', label: 'Alle Monate' },
  { value: '01', label: 'Januar' },
  { value: '02', label: 'Februar' },
  { value: '03', label: 'März' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Dezember' }
];

const COLUMN_DEFINITIONS = [
  { key: 'vgNr', label: 'Vorg.-Nr.', width: '6%' },
  { key: 'name', label: 'Name', width: '10%' },
  { key: 'abreise', label: 'Abreise', width: '7%' },
  { key: 'ruckreise', label: 'Rückreise', width: '7%' },
  { key: 'ziel', label: 'Ziel', width: '8%' },
  { key: 'gebuchteVA', label: 'Veranst.', width: '8%' },
  { key: 'buchung', label: 'Buchung', width: '7%' },
  { key: 'reisepreis', label: 'Preis', width: '7%' },
  { key: 'provisionRate', label: 'Prov %', width: '6%' },
  { key: 'netto', label: 'Netto', width: '6%' },
  { key: 'provisionAmount', label: 'Prov €', width: '6%' },
  { key: 'kdOffen', label: 'Offen', width: '6%' },
  { key: 'restAnVA', label: 'Rest Ver.', width: '8%' },
  { key: 'reisebeschreibung', label: 'Reisebeschr.', width: '12%' }
];

function ReservationsView({ reservations = [], onDelete, onEdit, onAddReservation, exchangeRates, agenturData = {}, categories = [] }) {
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanningImage, setScanningImage] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [rawOcrText, setRawOcrText] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [rawExcelData, setRawExcelData] = useState([]); // Tüm Excel satırları
  const [headerRowIndex, setHeaderRowIndex] = useState(0); // Header satırı indeksi
  const [columnMapping, setColumnMapping] = useState({});

  // Veranstalter kodına göre Agentur'dan provPct bul
  const lookupProvPct = (vaValue) => {
    if (!vaValue || !agenturData) return null;
    const val = vaValue.trim().toUpperCase();
    // Doğrudan kod eşleşmesi
    if (agenturData[val] !== undefined) return agenturData[val].provPct;
    // Küçük/büyük harf duyarsız arama
    const found = Object.entries(agenturData).find(([code]) => code.toUpperCase() === val);
    return found ? found[1].provPct : null;
  };

  // OCR/Excel'den gelen Veranstalter metnini bilinen kategori koduna çevirir
  const matchToAgenturCode = (text) => {
    if (!text || !categories.length) return '';
    const t = text.trim().toUpperCase();
    // 1. Exact code match
    const exactCode = categories.find(cat => cat.split('|')[0].toUpperCase() === t);
    if (exactCode) return exactCode.split('|')[0];
    // 2. Code appears in extracted text (e.g. "DERTOUR GmbH" contains "DERTOUR")
    const codeInText = categories.find(cat => t.includes(cat.split('|')[0].toUpperCase()));
    if (codeInText) return codeInText.split('|')[0];
    // 3. Full name appears in extracted text
    const nameInText = categories.find(cat => {
      const name = (cat.split('|')[1] || '').toUpperCase();
      return name.length >= 3 && t.includes(name);
    });
    if (nameInText) return nameInText.split('|')[0];
    // 4. Extracted text appears in a known name (OCR may truncate)
    if (t.length >= 4) {
      const textInName = categories.find(cat => {
        const name = (cat.split('|')[1] || '').toUpperCase();
        return name.includes(t);
      });
      if (textInName) return textInName.split('|')[0];
    }
    return ''; // Eşleşme yok – kullanıcı dropdown'dan seçmeli
  };

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
  // Toplu silme için seçili ID'ler
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Sütun görünürlük state - başlangıçta hepsi seçili
  const [visibleColumns, setVisibleColumns] = useState(() => 
    COLUMN_DEFINITIONS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
  );
  
  // Form state
  const [formData, setFormData] = useState({
    vgNr: '',
    kundenNr: '',
    name: '',
    abreise: new Date().toISOString().split('T')[0],
    ruckreise: '',
    ziel: '',
    gebuchteVA: '',
    buchung: new Date().toISOString().split('T')[0],
    reisepreis: '',
    currency: 'EUR',
    provisionRate: '',
    kdOffen: '',
    netto: '',
    restAnVA: '',
    reisebeschreibung: '',
    status: 'beklemede'
  });

  // Mevcut yılları bul
  const availableYears = useMemo(() => {
    const years = [...new Set(reservations.map(r => r.abreise?.substring(0, 4) || new Date().getFullYear().toString()))];
    return years.sort().reverse();
  }, [reservations]);

  // Sayfa değiştiğinde seçimleri temizle
  React.useEffect(() => {
    setSelectedIds([]);
  }, [currentPage, selectedYear, selectedMonth]);

  // Filtreleme mantığı
  const filtered = useMemo(() => {
    let result = reservations;

    // Yıl filtresi
    if (selectedYear !== 'all') {
      result = result.filter(r => r.abreise?.startsWith(selectedYear));
    }

    // Ay filtresi
    if (selectedMonth !== 'all') {
      result = result.filter(r => r.abreise?.substring(5, 7) === selectedMonth);
    }

    // En yeni kayıt en üstte olacak şekilde sırala (id'ye göre descending)
    result = result.sort((a, b) => (b.id || 0) - (a.id || 0));

    return result;
  }, [reservations, selectedYear, selectedMonth]);

  // KPI Hesaplamaları
  const kpiData = useMemo(() => {
    if (filtered.length === 0) {
      return {
        totalReservations: 0,
        totalAmount: 0,
        totalProvision: 0,
        totalNetto: 0,
        totalOffen: 0,
        totalRestVer: 0
      };
    }

    const totalReservations = filtered.length;
    const totalAmount = filtered.reduce((sum, r) => sum + (parseFloat(r.reisepreis) || 0), 0);
    const totalProvision = filtered.reduce((sum, r) => {
      const preis = parseFloat(r.reisepreis) || 0;
      const provStr = String(r.provisionRate || '').replace('%', '').trim();
      const provRate = parseFloat(provStr) || 0;
      const provisionAmount = preis * (provRate / 100);
      return sum + provisionAmount;
    }, 0);
    const totalNetto = filtered.reduce((sum, r) => sum + (parseFloat(r.netto) || 0), 0);
    const totalOffen = filtered.reduce((sum, r) => sum + (parseFloat(r.kdOffen) || 0), 0);
    const totalRestVer = filtered.reduce((sum, r) => sum + (parseFloat(r.restAnVA) || 0), 0);

    return {
      totalReservations,
      totalAmount,
      totalProvision,
      totalNetto,
      totalOffen,
      totalRestVer
    };
  }, [filtered]);

  // Pagination - Sadece mevcut sayfanın verilerini göster
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage, itemsPerPage]);

  // Toplam sayfa sayısı
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Filtre değiştiğinde sayfayı 1'e reset et
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonth, itemsPerPage]);

  // Excel Export fonksiyonu
  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      alert('Keine Reservierungen zum Exportieren gefunden!');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rezervasyonlar');

    // Başlıklar
    worksheet.columns = [
      { header: 'Vorg.-Nr.', key: 'vgNr', width: 12 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Abreise', key: 'abreise', width: 12 },
      { header: 'Rückreise', key: 'ruckreise', width: 12 },
      { header: 'Ziel', key: 'ziel', width: 15 },
      { header: 'Veranst.', key: 'gebuchteVA', width: 15 },
      { header: 'Buchung', key: 'buchung', width: 12 },
      { header: 'Preis', key: 'reisepreis', width: 12 },
      { header: 'Währung', key: 'currency', width: 10 },
      { header: 'Prov %', key: 'provisionRate', width: 10 },
      { header: 'Netto', key: 'netto', width: 10 },
      { header: 'Prov €', key: 'provisionAmount', width: 10 },
      { header: 'Offen', key: 'kdOffen', width: 10 },
      { header: 'Rest Ver.', key: 'restAnVA', width: 12 },
      { header: 'Reisebeschr.', key: 'reisebeschreibung', width: 30 }
    ];

    // Başlık stili
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Verileri ekle
    filtered.forEach(reservation => {
      worksheet.addRow({
        vgNr: reservation.vgNr,
        name: reservation.name,
        abreise: reservation.abreise,
        ruckreise: reservation.ruckreise,
        ziel: reservation.ziel,
        gebuchteVA: reservation.gebuchteVA,
        buchung: reservation.buchung,
        reisepreis: reservation.reisepreis,
        currency: reservation.currency,
        provisionRate: reservation.provisionRate || '',
        netto: reservation.netto,
        provisionAmount: (() => {
          const preis = parseFloat(reservation.reisepreis) || 0;
          const provStr = String(reservation.provisionRate || '').replace('%', '').trim();
          const provRate = parseFloat(provStr) || 0;
          return (preis * (provRate / 100)).toFixed(2);
        })(),
        kdOffen: reservation.kdOffen,
        restAnVA: reservation.restAnVA,
        reisebeschreibung: reservation.reisebeschreibung
      });
    });

    // Excel dosyasını oluştur ve indir
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rezervasyonlar_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // OCR Image Yükleme - Otomatik OCR başlat
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Sadece image formatları kabul et
    if (!file.type.startsWith('image/')) {
      alert('Lütfen bir resim dosyası seçin (JPG, PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageSrc = event.target.result;
      setScanningImage(imageSrc);
      
      // Otomatik olarak OCR işlemini başlat
      await performOCR(imageSrc);
    };
    reader.readAsDataURL(file);
  };

  // OCR İşlemi - Arka planda çalışır
  const performOCR = async (imageSrc) => {
    setOcrStatus('Belge analiz ediliyor...');
    setOcrProgress(5);

    try {
      setOcrProgress(10);

      // Resmi ön işleme - Canvas ile kontrast ve netlik artır
      const processedImage = await preprocessImage(imageSrc);
      setOcrProgress(20);

      // Almanca + İngilizce dil desteği ile OCR
      const result = await Tesseract.recognize(
        processedImage,
        'deu+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const progress = Math.round(20 + (m.progress * 70));
              setOcrProgress(progress);
            }
          }
        }
      );

      setOcrProgress(90);
      const text = result.data.text;
      console.log('OCR Text:', text);
      setRawOcrText(text);
      
      setOcrProgress(95);
      
      // Text'ten rezervasyon bilgilerini çıkar
      const extracted = extractReservationData(text);
      setExtractedData(extracted);
      setOcrStatus('');
      setOcrProgress(100);
      
    } catch (error) {
      console.error('OCR hatası:', error);
      setOcrStatus('');
      setOcrProgress(0);
      
      // Hata durumunda boş veri ile devam et
      setRawOcrText('OCR işlemi başarısız oldu. Lütfen verileri manuel olarak girin.');
      setExtractedData({
        vgNr: '',
        kundenNr: '',
        name: '',
        abreise: '',
        ruckreise: '',
        ziel: '',
        gebuchteVA: '',
        buchung: '',
        reisepreis: '',
        currency: 'EUR',
        provisionRate: '',
        kdOffen: '',
        netto: '',
        restAnVA: '',
        reisebeschreibung: '',
        status: 'beklemede'
      });
    }
  };

  // Resim ön işleme - kontrast artır, netleştir
  const preprocessImage = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Orijinal boyuttan 2x büyütme (daha iyi OCR için)
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        
        // Resmi çiz
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Kontrast ve netlik artırma
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const contrast = 1.5; // Kontrast faktörü
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        
        for (let i = 0; i < data.length; i += 4) {
          // RGB kanallarına kontrast uygula
          data[i] = factor * (data[i] - 128) + 128;     // R
          data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
          data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
          
          // Değerleri sınırla
          data[i] = Math.max(0, Math.min(255, data[i]));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageSrc;
    });
  };

  // Text'ten rezervasyon verilerini çıkar
  // ===== AKILLI REZERVASYON PARSING SİSTEMİ =====
  
  // Helper: Tarih mi tutar mı kontrol et
  const isDateOrAmount = (str) => {
    if (/^\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}$/.test(str)) return true;
    if (/^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}$/.test(str)) return true;
    if (/^\d{1,4}\.\d{2}$/.test(str)) return true;
    if (/^\d{1,4},\d{2}$/.test(str)) return true;
    if (/^20[12]\d$/.test(str)) return true;
    return false;
  };

  const extractReservationData = (text) => {
    console.log('\n=== 📋 REZERVASYON PARSING BAŞLADI ===');
    console.log('Metin uzunluğu:', text.length);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const textLower = text.toLowerCase();
    
    const data = {
      vgNr: '',
      kundenNr: '',
      name: '',
      abreise: '',
      ruckreise: '',
      ziel: '',
      gebuchteVA: '',
      buchung: '',
      reisepreis: '',
      currency: 'EUR',
      provisionRate: '',
      kdOffen: '',
      netto: '',
      restAnVA: '',
      reisebeschreibung: '',
      status: 'beklemede',
      provizyon_tutari: '',
      provizyon_orani: ''
    };

    // ====== AUFTRAGSNUMMER / VORGANGSNUMMER ======
    const vgKeywords = [
      'auftragsnummer', 'vorgangsnummer', 'vorgangs nr', 'vorgangs-nr',
      'auftrags nr', 'auftrags-nr', 'vg nr', 'vg-nr', 'vorgang'
    ];
    vgKeywords.forEach(keyword => {
      if (!data.vgNr) {
        // Esnek pattern: keyword + (opsiyonel : veya boşluk) + sayı
        const regex = new RegExp(keyword + '\\s*:?\\s*([0-9]+)', 'gi');
        const match = text.match(regex);
        if (match) {
          const numMatch = match[0].match(/\d+/);
          if (numMatch) {
            data.vgNr = 'VG-' + numMatch[0];
          }
        }
      }
    });
    console.log('📄 VG-Nr:', data.vgNr || '❌ Bulunamadı');

    // ====== KUNDENNUMMER ======
    const kundenKeywords = ['kundennummer', 'kunden nr', 'kunden-nr', 'customer number', 'kundenreferenz'];
    kundenKeywords.forEach(keyword => {
      const regex = new RegExp(keyword + '[:\\s-]*([0-9]+)', 'gi');
      const match = text.match(regex);
      if (match && !data.kundenNr) {
        const numMatch = match[0].match(/\d+/);
        if (numMatch) {
          data.kundenNr = 'KD-' + numMatch[0];
        }
      }
    });
    console.log('👤 Kunden-Nr:', data.kundenNr || '❌ Bulunamadı');

    // ====== NAME (Çoklu Format Desteği) ======
    let nameFound = false;
    
    // Pattern 1: Herr/Frau + Ad Soyad
    const namePattern1 = /(herr|frau|mr|mrs|ms)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/gi;
    const nameMatches1 = [...text.matchAll(namePattern1)];
    if (nameMatches1.length > 0) {
      data.name = nameMatches1[0][1] + ' ' + nameMatches1[0][2];
      nameFound = true;
    }
    
    // Pattern 2: SOYAD, AD (virgüllü format) → AD SOYAD'a çevir
    if (!nameFound) {
      const namePattern2 = /(?:sehr geehrte\(r\)\s+)?([A-ZÄÖÜ]{2,})\s*,\s*([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ]+)/gi;
      const nameMatches2 = [...text.matchAll(namePattern2)];
      if (nameMatches2.length > 0) {
        // SOYAD, AD → AD SOYAD
        const surname = nameMatches2[0][1];
        const firstname = nameMatches2[0][2];
        data.name = firstname.charAt(0).toUpperCase() + firstname.slice(1).toLowerCase() + ' ' + 
                    surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
        nameFound = true;
      }
    }
    
    // Pattern 3: BÜYÜK HARF AD SOYAD (Herr/Frau olmadan)
    if (!nameFound) {
      const namePattern3 = /\b([A-ZÄÖÜ]{3,})\s+([A-ZÄÖÜ]{3,})\b/g;
      const nameMatches3 = [...text.matchAll(namePattern3)];
      for (const match of nameMatches3) {
        const firstname = match[1];
        const lastname = match[2];
        // Blacklist: Form keyword'leri değil (HINFLUG, ANTALYA, DUESSELDORF vb.)
        const blacklistNames = [
          'HINFLUG', 'RUCKFLUG', 'RÜCKREISE', 'ANTALYA', 'DUESSELDORF', 
          'ANREISE', 'DATUM', 'SUMME', 'GESAMT', 'HOTEL', 'FLUG'
        ];
        if (!blacklistNames.includes(firstname) && !blacklistNames.includes(lastname)) {
          data.name = firstname.charAt(0) + firstname.slice(1).toLowerCase() + ' ' + 
                      lastname.charAt(0) + lastname.slice(1).toLowerCase();
          nameFound = true;
          break;
        }
      }
    }
    
    console.log('👨 Name:', data.name || '❌ Bulunamadı');

    // ====== TARİHLER (Abreise / Rückreise) ======
    
    // Yardımcı fonksiyon: 2 haneli yılı 4 haneli yap
    const expandYear = (year) => {
      const y = parseInt(year);
      if (y < 100) {
        return y >= 0 && y <= 50 ? 2000 + y : 1900 + y;
      }
      return y;
    };
    
    // Pattern 1: "vom DD.MM.YY bis DD.MM.YY" formatı
    const vomBisPattern = /vom\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+bis\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/gi;
    const vomBisMatch = text.match(vomBisPattern);
    if (vomBisMatch) {
      const dates = vomBisMatch[0].match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g);
      if (dates && dates.length >= 2) {
        const [d1, m1, y1] = dates[0].split('.');
        const [d2, m2, y2] = dates[1].split('.');
        data.abreise = `${expandYear(y1)}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
        data.ruckreise = `${expandYear(y2)}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`;
      }
    }
    
    // Pattern 2: Reisetermin: Fr, 12.03.2027 - Fr, 26.03.2027
    if (!data.abreise || !data.ruckreise) {
      const reiseterminPattern = /reisetermin[:\s]*[a-z]{0,3},?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*-\s*[a-z]{0,3},?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/gi;
      const reiseterminMatch = text.match(reiseterminPattern);
      if (reiseterminMatch) {
        const parts = reiseterminMatch[0].match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g);
        if (parts && parts.length >= 2) {
          const [d1, m1, y1] = parts[0].split('.');
          const [d2, m2, y2] = parts[1].split('.');
          data.abreise = `${expandYear(y1)}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
          data.ruckreise = `${expandYear(y2)}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`;
        }
      }
    }
    
    // Pattern 3: Reisedatum / Anreise / Hinreise aynı satırda
    if (!data.abreise) {
      const anreiseKeywords = ['reisedatum', 'anreise', 'hinreise', 'abreise'];
      anreiseKeywords.forEach(keyword => {
        if (!data.abreise) {
          const pattern = new RegExp(keyword + '[:\\s]*[~-]*\\s*(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})', 'gi');
          const match = text.match(pattern);
          if (match) {
            const dateMatch = match[0].match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
            if (dateMatch) {
              const [_, d, m, y] = dateMatch;
              data.abreise = `${expandYear(y)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        }
      });
    }
    
    // Pattern 4: Rückreise / bis separate
    if (!data.ruckreise) {
      const ruckreiseKeywords = ['rückreise', 'ruckreise', 'bis'];
      ruckreiseKeywords.forEach(keyword => {
        if (!data.ruckreise) {
          const pattern = new RegExp(keyword + '[:\\s]*[~-]*\\s*(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})', 'gi');
          const matches = [...text.matchAll(pattern)];
          // Eğer abreise varsa, ondan farklı bir tarih al
          matches.forEach(match => {
            const dateStr = match[0].match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
            if (dateStr) {
              const [_, d, m, y] = dateStr;
              const returnDate = `${expandYear(y)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              if (returnDate !== data.abreise) {
                data.ruckreise = returnDate;
              }
            }
          });
        }
      });
    }
    
    // Pattern 5: Rastgele tarih aralığı (dd.mm.yy - dd.mm.yy)
    if (!data.abreise || !data.ruckreise) {
      const rangePattern = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*[-–]+\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/gi;
      const rangeMatches = [...text.matchAll(rangePattern)];
      if (rangeMatches.length > 0) {
        const match = rangeMatches[0];
        if (!data.abreise) {
          data.abreise = `${expandYear(match[3])}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        if (!data.ruckreise) {
          data.ruckreise = `${expandYear(match[6])}-${match[5].padStart(2, '0')}-${match[4].padStart(2, '0')}`;
        }
      }
    }

    // Buchungsdatum (daha esnek - "Ersetzt Rechnung vom" veya "Datum" formatı)
    const buchungKeywords = [
      'buchungsdatum', 'buchung vom', 'erwartete buchung vom', 
      'gebucht am', 'buchung am', 'rechnung vom', 'ersetzt rechnung vom'
    ];
    
    buchungKeywords.forEach(keyword => {
      if (!data.buchung) {
        const pattern = new RegExp(keyword + '[:\\s]*[~-]*\\s*(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})', 'gi');
        const matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
          const dateMatch = matches[0][0].match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
          if (dateMatch) {
            const [_, d, m, y] = dateMatch;
            data.buchung = `${expandYear(y)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
      }
    });
    
    // Fallback: "Datum" formatı (iki nokta üst üste yok, ama Druckdatum değil)
    if (!data.buchung) {
      const datumPattern = /(?<!druck)datum[:\s]+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/gi;
      const datumMatches = [...text.matchAll(datumPattern)];
      if (datumMatches.length > 0) {
        datumMatches.forEach(match => {
          const d = match[1];
          const m = match[2];
          const y = match[3];
          const foundDate = `${expandYear(y)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          
          // Abreise veya Rückreise ile aynı değilse al
          if (foundDate !== data.abreise && foundDate !== data.ruckreise) {
            data.buchung = foundDate;
          }
        });
      }
    }

    console.log('📅 Abreise:', data.abreise || '❌ Bulunamadı');
    console.log('📅 Rückreise:', data.ruckreise || '❌ Bulunamadı');
    console.log('📅 Buchungsdatum:', data.buchung || '❌ Bulunamadı');

    // ====== ZIEL / DESTINATION ======
    const zielKeywords = [
      'hotel', 'resort', 'unterkunft', 'property', 'unterkunftsname',
      'reisebeschreibung', 'ziel', 'destination', 'reiseziel', 'nächte'
    ];
    let zielFound = false;
    
    // Blacklist: Bunlar ziel DEĞİLDİR (generic açıklamalar)
    const zielBlacklist = [
      'buchung', 'rechnung', 'erwartete', 'ersetzt',
      'hotel + flug', 'nur hotel', 'pauschalreise',
      'nur hotelbuchung', 'hotelbuchung türkei'
    ];
    
    zielKeywords.forEach(keyword => {
      if (!zielFound) {
        const pattern = new RegExp(keyword + '[:\\s]*[~-]*\\s*([^\\n]+)', 'gi');
        const matches = [...text.matchAll(pattern)];
        
        matches.forEach(match => {
          let ziel = match[1].trim();
          
          // Çok kısa, sadece sayılardan oluşuyor veya sadece noktalama işareti varsa geç
          if (ziel.length > 5 && !/^\d+$/.test(ziel) && !/^[.,\-_~\s]+$/.test(ziel)) {
            // Fiyat bilgilerini temizle (ama virgüllü yer isimlerini koru)
            ziel = ziel.replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*EUR/gi, '').trim();
            
            // Tarih temizle (ama virgüllü isimlerden önceki tarihleri)
            ziel = ziel.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}\s*-\s*\d{1,2}\.\d{1,2}\.\d{2,4}/g, '').trim();
            ziel = ziel.replace(/vom\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+bis\s+\d{1,2}\.\d{1,2}\.\d{2,4}/gi, '').trim();
            
            // Başındaki/sonundaki gereksiz işaretleri temizle
            ziel = ziel.replace(/^[~\-_\s]+|[~\-_\s]+$/g, '').trim();
            
            // Blacklist kontrolü (küçük harfle karşılaştır)
            const zielLower = ziel.toLowerCase();
            const isBlacklisted = zielBlacklist.some(term => zielLower.includes(term));
            
            // Kabul et (blacklist'te değilse ve yeterince uzunsa)
            if (ziel && ziel.length >= 5 && !isBlacklisted) {
              data.ziel = ziel;
              data.reisebeschreibung = ziel;  // Reisebeschreibung = Ziel
              zielFound = true;
            }
          }
        });
      }
    });
    
    console.log('🌍 Ziel:', data.ziel || '❌ Bulunamadı');
    console.log('📝 Reisebeschreibung:', data.reisebeschreibung || '❌ Bulunamadı');

    // ====== REISEPREIS (Leistungspreis / Gesamtpreis) ======
    const priceKeywords = [
      'leistungspreis', 'gesamtpreis', 'reisepreis', 'pauschale', 
      'total', 'summe', 'gesamt'
    ];
    const pricesFound = [];
    
    priceKeywords.forEach(keyword => {
      // Pattern 1: keyword: 7.925,00 EUR (Almanca format)
      const regex1 = new RegExp(keyword + '[\\s:]*[~-]*\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2})\\s*EUR', 'gi');
      const matches1 = [...text.matchAll(regex1)];
      matches1.forEach(m => {
        const priceStr = m[1].replace(/\./g, '').replace(',', '.');
        pricesFound.push(parseFloat(priceStr));
      });
      
      // Pattern 2: GESAMT: 3100.00 (nokta ile ondalık)
      const regex2 = new RegExp(keyword + '[\\s:]*[~-]*\\s*(\\d{1,5}\\.\\d{2})', 'gi');
      const matches2 = [...text.matchAll(regex2)];
      matches2.forEach(m => {
        pricesFound.push(parseFloat(m[1]));
      });
    });

    if (pricesFound.length > 0) {
      // En büyük fiyatı al (genelde genel toplam)
      data.reisepreis = Math.max(...pricesFound);
      data.currency = 'EUR';
    }
    console.log('💰 Reisepreis:', data.reisepreis ? `${data.reisepreis} EUR` : '❌ Bulunamadı');
    
    // ====== PROVİZYON (Commission) ======
    const provKeywords = ['prov von', 'provision', '% prov'];
    provKeywords.forEach(keyword => {
      if (!data.provizyon_tutari) {
        // Pattern: "10,0 % Prov von 5.766,00 = 576,60"
        const provPattern = new RegExp(
          '(\\d+[.,]\\d+)\\s*%\\s*' + keyword + '.*?=\\s*(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2})',
          'gi'
        );
        const provMatch = text.match(provPattern);
        if (provMatch) {
          const fullMatch = provMatch[0];
          // Oranı çıkar
          const oranMatch = fullMatch.match(/(\d+[.,]\d+)\s*%/);
          if (oranMatch) {
            data.provizyon_orani = oranMatch[1].replace(',', '.');
          }
          // Tutarı çıkar
          const tutarMatch = fullMatch.match(/=\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
          if (tutarMatch) {
            const cleanAmount = tutarMatch[1].replace(/\./g, '').replace(',', '.');
            data.provizyon_tutari = parseFloat(cleanAmount);
          }
        }
      }
    });
    console.log('💵 Provizyon:', data.provizyon_tutari ? `${data.provizyon_tutari} EUR (${data.provizyon_orani}%)` : '❌ Bulunamadı');

    // ====== GEBUCHTE VA (Veranstalter / Tour Operator) ======
    console.log('\n=== 🔍 VERANSTALTER ARAŞTIRMASI ===');
    let veranstalterFound = false;
    
    // 1. ADIM: Önce bilinen tour operator isimlerini ara
    const knownOperators = [
      'Cosmonaut', 'TUI Cruises', 'TUI', 'Coral Travel', 'Ferien Touristik', 
      'FTI', 'DERTOUR', 'ITS', 'Neckermann', 'Thomas Cook',
      'Alltours', 'Schauinsland', 'ETI', 'Berge & Meer', 'AIDA',
      'MSC Cruises', 'Costa', 'Travelix', 'SunExpress', 'Öger Tours',
      'Anex Tour', 'ANEX Tour', 'Anex Tour GmbH', 'ANEX', 
      'Bucher Reisen', 'Bucher', 'Coral Touristik'
    ];
    
    knownOperators.forEach(operator => {
      if (!veranstalterFound) {
        const operatorRegex = new RegExp('\\b' + operator + '\\b', 'gi');
        const match = text.match(operatorRegex);
        if (match) {
          data.gebuchteVA = match[0];
          veranstalterFound = true;
          console.log('✅ Bilinen operator bulundu:', match[0]);
        }
      }
    });
    
    // 2. ADIM: Eğer bulunamadıysa, keyword'lerle ara (ama çok dikkatli)
    if (!veranstalterFound) {
      console.log('⚠️ Bilinen operator bulunamadı, keyword araması yapılıyor...');
      
      const veranstalterKeywords = ['veranstalter', 'gebuchte va', 'gebuchter va', 'reiseveranstalter'];
      
      // Genişletilmiş blacklist: Form açıklamaları, cümleler, generic terimler
      const blacklistTerms = [
        'für kundeninformationen', 'gespeichert', 'kundeninformation',
        'im reisebüro', 'reisebüro', 'buchung', 'rechnung',
        'hotel + flug', 'hotel+flug', 'nur hotel', 'nur flug', 
        'pauschalreise', 'rundreise', 'mietwagen', 'transfer',
        'vollpension', 'halbpension', 'all inclusive', 'frühstück',
        'erwartete', 'ersetzt', 'bestätigung', 'informationen',
        'bei fragen', 'kontakt', 'ansprechpartner', 'telefon',
        'buchungsnummer', 'kundennummer', 'auftragsnummer'
      ];
      
      veranstalterKeywords.forEach(keyword => {
        if (!veranstalterFound) {
          const veranstalterPattern = new RegExp(keyword + '[:\\s]*[~-]*\\s*([^\\n]+)', 'gi');
          const veranstalterMatches = [...text.matchAll(veranstalterPattern)];
          
          veranstalterMatches.forEach(match => {
            let candidate = match[1].trim();
            console.log(`   🔎 Aday metin: "${candidate}"`);
            
            // Çok uzun cümleler direkt red (50+ karakter)
            if (candidate.length > 50) {
              console.log('   ❌ Çok uzun (50+ karakter)');
              return;
            }
            
            // Küçük harfle başlayan cümleler (açıklama metni olabilir)
            if (/^[a-zäöü]/.test(candidate)) {
              console.log('   ❌ Küçük harfle başlıyor (cümle olabilir)');
              return;
            }
            
            // Çok fazla kelime içeriyorsa (5+ kelime = büyük ihtimalle cümle)
            const wordCount = candidate.split(/\s+/).length;
            if (wordCount > 5) {
              console.log(`   ❌ Çok fazla kelime (${wordCount} kelime)`);
              return;
            }
            
            // Fiyat temizle
            candidate = candidate.replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*EUR/gi, '').trim();
            
            // Başındaki sayıları temizle
            candidate = candidate.replace(/^\d+\.\s*/g, '').trim();
            
            // Tarih temizle
            candidate = candidate.replace(/leistungsdatum\s+\d{1,2}\.\d{1,2}\.\d{4}\s*-\s*\d{1,2}\.\d{1,2}\.\d{4}/gi, '').trim();
            candidate = candidate.replace(/\d{1,2}\.\d{1,2}\.\d{4}\s*-\s*\d{1,2}\.\d{1,2}\.\d{4}/g, '').trim();
            
            // Adres temizle (virgülden sonra)
            if (candidate.includes(',')) {
              candidate = candidate.split(',')[0].trim();
            }
            
            // Blacklist kontrolü (case-insensitive)
            const candidateLower = candidate.toLowerCase();
            const isBlacklisted = blacklistTerms.some(term => 
              candidateLower.includes(term)
            );
            
            if (isBlacklisted) {
              console.log('   ❌ Blacklist\'te var');
              return;
            }
            
            // Kişi ismi kontrolü
            if (/^(herr|frau|mr|mrs|ms)\s+[A-Z]/gi.test(candidate)) {
              console.log('   ❌ Kişi ismi tespit edildi');
              return;
            }
            
            // Company name pattern: 
            // - En az 1 büyük harf ile başlamalı
            // - 3-30 karakter arası
            // - GmbH / AG / Ltd / Inc gibi şirket sonekleri bonus
            const hasCompanyPattern = 
              /^[A-ZÄÖÜ]/.test(candidate) && 
              candidate.length >= 3 && 
              candidate.length <= 30;
            
            const hasCompanySuffix = 
              /\b(GmbH|AG|Ltd|Inc|Co\.|KG|mbH)\b/i.test(candidate);
            
            if (hasCompanyPattern || hasCompanySuffix) {
              data.gebuchteVA = candidate;
              veranstalterFound = true;
              console.log('   ✅ KABUL EDİLDİ:', candidate);
            } else {
              console.log('   ❌ Company pattern uymuyor');
            }
          });
        }
      });
    }
    
    console.log('🏢 Gebuchte VA (Veranstalter):', data.gebuchteVA || '❌ Bulunamadı');
    console.log('=== 🔍 VERANSTALTER ARAŞTIRMASI BİTTİ ===\n');

    // OCR'la bulunan Veranstalter adını bilinen koda normalize et
    data.gebuchteVA = matchToAgenturCode(data.gebuchteVA);

    // gebuchteVA → Agentur'dan provPct otomatik ata
    if (data.gebuchteVA) {
      const agenturProv = lookupProvPct(data.gebuchteVA);
      if (agenturProv !== null) {
        data.provisionRate = String(agenturProv);
      }
    }

    // NETTO hesapla
    if (data.reisepreis && data.provisionRate) {
      data.netto = calculateNetto(data.reisepreis, data.provisionRate);
    }

    console.log('=== ✅ PARSING TAMAMLANDI ===\n');
    return data;
  };

  // Form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.vgNr || !formData.name || !formData.reisepreis) {
      alert('VgNr., Name ve Reisepreis zorunludur!');
      return;
    }

    // Prov %: kullanıcı girdiyse onu kullan, yoksa agenturData'dan al
    const finalProvRate = (formData.provisionRate !== '' && formData.provisionRate !== null && formData.provisionRate !== undefined)
      ? formData.provisionRate
      : (lookupProvPct(formData.gebuchteVA) !== null ? String(lookupProvPct(formData.gebuchteVA)) : '');

    const preis = parseFloat(formData.reisepreis) || 0;
    const finalNetto = finalProvRate !== ''
      ? calculateNetto(preis, finalProvRate)
      : (formData.netto || '0');

    const newReservation = {
      ...formData,
      reisepreis: preis,
      provisionRate: finalProvRate,
      netto: parseFloat(finalNetto),
      kdOffen: formData.kdOffen ? parseFloat(formData.kdOffen) : 0,
      restAnVA: formData.restAnVA ? parseFloat(formData.restAnVA) : 0,
      id: Date.now()
    };

    onAddReservation(newReservation);
    
    // Formu sıfırla
    setFormData({
      vgNr: '',
      kundenNr: '',
      name: '',
      abreise: new Date().toISOString().split('T')[0],
      ruckreise: '',
      ziel: '',
      gebuchteVA: '',
      buchung: new Date().toISOString().split('T')[0],
      reisepreis: '',
      currency: 'EUR',
      provisionRate: '',
      kdOffen: '',
      netto: '',
      restAnVA: '',
      reisebeschreibung: '',
      status: 'beklemede'
    });
    
    setShowAddModal(false);
  };

  // Toplu silme fonksiyonları
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map(r => r.id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      alert('Lütfen en az bir rezervasyon seçin!');
      return;
    }
    
    if (window.confirm(`Sind Sie sicher, dass Sie ${selectedIds.length} Reservierungen löschen möchten?`)) {
      selectedIds.forEach(id => onDelete(id));
      setSelectedIds([]);
    }
  };

  const handleEditClick = (reservation) => {
    setEditingReservation(reservation);
    const calculatedNetto = calculateNetto(reservation.reisepreis, reservation.provisionRate);
    setFormData({
      vgNr: reservation.vgNr || '',
      kundenNr: reservation.kundenNr || '',
      name: reservation.name || '',
      abreise: reservation.abreise || '',
      ruckreise: reservation.ruckreise || '',
      ziel: reservation.ziel || '',
      gebuchteVA: reservation.gebuchteVA || '',
      buchung: reservation.buchung || '',
      reisepreis: reservation.reisepreis || '',
      currency: reservation.currency || 'EUR',
      provisionRate: reservation.provisionRate || '',
      kdOffen: reservation.kdOffen || '',
      netto: calculatedNetto,
      restAnVA: reservation.restAnVA || '',
      reisebeschreibung: reservation.reisebeschreibung || '',
      status: reservation.status || 'beklemede'
    });
    setShowEditModal(true);
  };

  const handleUpdateReservation = (e) => {
    e.preventDefault();
    
    if (!formData.vgNr || !formData.name || !formData.reisepreis) {
      alert('VgNr., Name ve Reisepreis zorunludur!');
      return;
    }

    const updatedReservation = {
      ...editingReservation,
      ...formData,
      reisepreis: parseFloat(formData.reisepreis || 0),
      provisionRate: formData.provisionRate || '',
      kdOffen: formData.kdOffen ? parseFloat(formData.kdOffen) : 0,
      netto: formData.netto ? parseFloat(formData.netto) : 0,
      restAnVA: formData.restAnVA ? parseFloat(formData.restAnVA) : 0,
    };

    onEdit(updatedReservation);
    
    // Form'u temizle
    setFormData({
      vgNr: '',
      kundenNr: '',
      name: '',
      abreise: new Date().toISOString().split('T')[0],
      ruckreise: '',
      ziel: '',
      gebuchteVA: '',
      buchung: new Date().toISOString().split('T')[0],
      reisepreis: '',
      currency: 'EUR',
      provisionRate: '',
      kdOffen: '',
      netto: '',
      restAnVA: '',
      reisebeschreibung: '',
      status: 'beklemede'
    });
    setEditingReservation(null);
    setShowEditModal(false);
  };

  const getStatusBadge = (status) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status);
    if (!statusOption) return <span className="status-badge">-</span>;
    
    return (
      <span 
        className="status-badge" 
        style={{ 
          backgroundColor: statusOption.color + '20',
          color: statusOption.color,
          padding: '2px 6px',
          borderRadius: '8px',
          fontSize: '9px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          display: 'inline-block'
        }}
      >
        {statusOption.label}
      </span>
    );
  };

  // Sütun görünürlüğü toggle
  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  // Tüm sütunları seç/kaldır
  const toggleAllColumns = () => {
    const allSelected = Object.values(visibleColumns).every(v => v);
    const newState = COLUMN_DEFINITIONS.reduce((acc, col) => ({ 
      ...acc, 
      [col.key]: !allSelected 
    }), {});
    setVisibleColumns(newState);
  };

  // Tarih formatlama: DD.MM.YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Excel Import Fonksiyonları - .xls ve .xlsx desteği
  // Excel Import: Akıllı header satırı tespiti
  const detectHeaderRow = (jsonData) => {
    if (!jsonData || jsonData.length === 0) return 0;
    
    // İlk 10 satırı veya tüm satırları kontrol et (hangisi az ise)
    const maxRowsToCheck = Math.min(10, jsonData.length);
    let bestRowIndex = 0;
    let maxFilledCells = 0;
    
    for (let i = 0; i < maxRowsToCheck; i++) {
      const row = jsonData[i];
      if (!row) continue;
      
      // Bu satırdaki dolu hücre sayısını say
      const filledCells = row.filter(cell => 
        cell !== null && 
        cell !== undefined && 
        cell !== '' && 
        cell.toString().trim() !== ''
      ).length;
      
      // En fazla dolu hücre içeren satırı seç
      if (filledCells > maxFilledCells) {
        maxFilledCells = filledCells;
        bestRowIndex = i;
      }
    }
    
    return bestRowIndex;
  };

  // Header satırı değiştiğinde verileri yeniden parse et
  const parseExcelWithHeaderRow = (jsonData, headerIndex) => {
    if (!jsonData || jsonData.length === 0) return { headers: [], data: [] };
    
    // Başlık satırını al
    const headerRow = jsonData[headerIndex];
    const headers = [];
    
    headerRow.forEach((headerName, index) => {
      if (headerName && headerName.toString().trim() !== '') {
        headers.push({
          index: index,
          name: headerName.toString().trim()
        });
      }
    });
    
    // Veri satırlarını al (header satırından sonra)
    const data = [];
    for (let i = headerIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowData = {};
      let hasData = false;
      
      headers.forEach(header => {
        const cellValue = row[header.index];
        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
          rowData[header.index] = cellValue;
          hasData = true;
        }
      });
      
      // Boş satırları atla
      if (hasData) {
        data.push(rowData);
      }
    }
    
    return { headers, data };
  };

  const handleImportExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // xlsx kütüphanesi hem .xls hem .xlsx formatlarını destekler
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        console.log('Workbook yüklendi');
        console.log('Sayfa sayısı:', workbook.SheetNames.length);
        
        if (workbook.SheetNames.length === 0) {
          alert('Keine Arbeitsblätter in der Excel-Datei gefunden! Stellen Sie sicher, dass es sich um eine gültige Excel-Datei handelt.');
          return;
        }
        
        // İlk sheet'i al
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        console.log('Sheet bulundu:', firstSheetName);
        
        // JSON formatına çevir - header: 1 = başlıkları ayır
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        console.log('Toplam satır:', jsonData.length);
        
        if (jsonData.length < 1) {
          alert('Excel dosyası boş görünüyor!');
          return;
        }
        
        // Ham veriyi sakla
        setRawExcelData(jsonData);
        
        // Otomatik header satırını tespit et
        const detectedHeaderIndex = detectHeaderRow(jsonData);
        console.log('Otomatik tespit edilen header satırı:', detectedHeaderIndex + 1);
        setHeaderRowIndex(detectedHeaderIndex);
        
        // Header ve verileri parse et
        const { headers, data } = parseExcelWithHeaderRow(jsonData, detectedHeaderIndex);
        
        console.log('Başlıklar:', headers);
        console.log('Okunan veri satırları:', data.length);
        
        if (headers.length === 0) {
          alert('Kopfzeile in der Excel-Datei nicht gefunden!');
          return;
        }
        
        if (data.length === 0) {
          alert('Keine Datenzeilen in der Excel-Datei gefunden!');
          return;
        }
        
        setExcelHeaders(headers);
        setExcelData(data);
        
        // Otomatik eşleştirme yap
        const autoMapping = autoMatchColumns(headers);
        setColumnMapping(autoMapping);
        
        setShowImportModal(true);
        
      } catch (error) {
        console.error('Excel okuma hatası:', error);
        alert(`Excel dosyası okunamadı! Hata: ${error.message}`);
      }
    };
    input.click();
  };

  // Otomatik sütun eşleştirme - akıllı tahmin
  const autoMatchColumns = (headers) => {
    const mapping = {};
    
    const matchRules = {
      vgNr: ['vorg', 'vg', 'vorgang', 'nummer', 'no', 'id', 'ref'],
      name: ['name', 'isim', 'ad', 'kunde', 'customer', 'müşteri'],
      abreise: ['abreise', 'anreise', 'başlangıç', 'start', 'departure', 'gidiş'],
      ruckreise: ['ruckreise', 'rückreise', 'dönüş', 'bitiş', 'return', 'end'],
      ziel: ['ziel', 'hedef', 'destination', 'ülke', 'country', 'yer'],
      gebuchteVA: ['veranst', 'gebuchte', 'acentesi', 'agency', 'operator'],
      buchung: ['buchung', 'kayıt', 'booking', 'date', 'tarih'],
      reisepreis: ['preis', 'price', 'fiyat', 'tutar', 'amount', 'reisepreis'],
      currency: ['währung', 'currency', 'para', 'birim', 'doviz'],
      provisionRate: ['prov', 'provision', 'komisyon', 'commission', '%'],
      netto: ['netto', 'net'],
      kdOffen: ['offen', 'kalan', 'remaining', 'balance', 'açık'],
      restAnVA: ['rest', 'kalan', 'bakiye', 'ver'],
      reisebeschreibung: ['beschreibung', 'description', 'açıklama', 'notlar', 'notes']
    };
    
    headers.forEach(header => {
      const headerLower = header.name.toLowerCase();
      
      for (const [systemCol, keywords] of Object.entries(matchRules)) {
        if (keywords.some(keyword => headerLower.includes(keyword))) {
          mapping[header.index] = systemCol;
          break;
        }
      }
    });
    
    return mapping;
  };

  // Excel verilerini sisteme aktar
  const handleConfirmImport = () => {
    const newReservations = [];
    
    excelData.forEach((row, index) => {
      const reservation = {
        vgNr: '',
        name: '',
        abreise: '',
        ruckreise: '',
        ziel: '',
        gebuchteVA: '',
        buchung: '',
        reisepreis: '',
        currency: 'EUR',
        provisionRate: '',
        kdOffen: '',
        netto: '',
        restAnVA: '',
        reisebeschreibung: '',
        status: 'beklemede'
      };
      
      // Mapping'e göre değerleri doldur
      Object.entries(columnMapping).forEach(([excelColIndex, systemCol]) => {
        if (systemCol && systemCol !== 'skip') {
          let value = row[excelColIndex];
          
          // Excel tarih formatını dönüştür
          if (['abreise', 'ruckreise', 'buchung'].includes(systemCol)) {
            if (value instanceof Date) {
              value = value.toISOString().split('T')[0];
            } else if (typeof value === 'number') {
              // Excel serial date
              const date = new Date((value - 25569) * 86400 * 1000);
              value = date.toISOString().split('T')[0];
            } else if (typeof value === 'string') {
              // String tarih formatı (DD.MM.YYYY veya DD/MM/YYYY)
              const parts = value.split(/[./-]/);
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                value = `${year}-${month}-${day}`;
              }
            }
          }
          
          reservation[systemCol] = value?.toString() || '';
        }
      });
      
      // En azından name ve reisepreis olmalı
      if (reservation.name && reservation.reisepreis) {
        // Excel'den gelen Veranstalter adını bilinen koda normalize et
        reservation.gebuchteVA = matchToAgenturCode(reservation.gebuchteVA);

        // Öncelik: 1) Excel'deki prov değeri  2) Agentur sayfasındaki provPct  3) boş
        const excelProv = reservation.provisionRate && reservation.provisionRate !== ''
          ? reservation.provisionRate
          : null;
        const agenturProv = lookupProvPct(reservation.gebuchteVA);
        reservation.provisionRate = excelProv !== null
          ? String(excelProv)
          : (agenturProv !== null ? String(agenturProv) : '');
        
        // NETTO hesapla
        const preis = parseFloat(reservation.reisepreis) || 0;
        const provStr = String(reservation.provisionRate || '').replace('%', '').trim();
        const provRate = parseFloat(provStr) || 0;
        reservation.netto = (preis - (preis * (provRate / 100))).toFixed(2);
        
        newReservations.push(reservation);
      }
    });
    
    if (newReservations.length === 0) {
      alert('Keine gültigen Reservierungen zum Importieren gefunden! Name und Reisepreis sind Pflichtfelder.');
      return;
    }
    
    // Tüm rezervasyonları ekle
    newReservations.forEach(res => onAddReservation(res));
    
    alert(`${newReservations.length} rezervasyon başarıyla içe aktarıldı!`);
    setShowImportModal(false);
    setExcelHeaders([]);
    setExcelData([]);
    setColumnMapping({});
  };

  // Excel Import Modal'ı kapat ve state'leri temizle
  const closeImportModal = () => {
    setShowImportModal(false);
    setExcelHeaders([]);
    setExcelData([]);
    setRawExcelData([]);
    setHeaderRowIndex(0);
    setColumnMapping({});
  };

  // NETTO hesaplama: PREIS - (PREIS * PROV%)
  const calculateNetto = (reisepreis, provisionRate) => {
    const preis = parseFloat(reisepreis) || 0;
    const provStr = String(provisionRate || '').replace('%', '').trim();
    const provRate = parseFloat(provStr) || 0;
    const netto = preis - (preis * (provRate / 100));
    return netto.toFixed(2);
  };

  // Sütun içeriğini render et
  const renderCellContent = (reservation, columnKey) => {
    switch(columnKey) {
      case 'vgNr':
        return <strong>{reservation.vgNr ? reservation.vgNr.replace(/^VG-/i, '') : '-'}</strong>;
      case 'name':
        return <strong>{reservation.name || '-'}</strong>;
      case 'abreise':
        return formatDate(reservation.abreise);
      case 'ruckreise':
        return formatDate(reservation.ruckreise);
      case 'ziel':
        return reservation.ziel || '-';
      case 'gebuchteVA':
        return reservation.gebuchteVA || '-';
      case 'buchung':
        return formatDate(reservation.buchung);
      case 'reisepreis':
        return <><strong>{parseFloat(reservation.reisepreis || 0).toFixed(2)}</strong> {reservation.currency === 'EUR' ? '€' : reservation.currency}</>;
      case 'provisionRate':
        return reservation.provisionRate || '-';
      case 'netto':
        return reservation.netto ? `${parseFloat(reservation.netto).toFixed(2)} €` : '-';
      case 'provisionAmount':
        const preis = parseFloat(reservation.reisepreis) || 0;
        const provStr = String(reservation.provisionRate || '').replace('%', '').trim();
        const provRate = parseFloat(provStr) || 0;
        const provAmount = preis * (provRate / 100);
        return provAmount > 0 ? `${provAmount.toFixed(2)} €` : '-';
      case 'kdOffen':
        return reservation.kdOffen ? `${parseFloat(reservation.kdOffen).toFixed(2)} €` : '-';
      case 'restAnVA':
        return reservation.restAnVA ? `${parseFloat(reservation.restAnVA).toFixed(2)} €` : '-';
      case 'reisebeschreibung':
        return reservation.reisebeschreibung || '-';
      default:
        return '-';
    }
  };

  return (
    <div className="expense-list">
      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '8px',
        marginBottom: '20px',
        padding: '10px',
        background: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)'
      }}>
        {/* Toplam Rezervasyon */}
        <div style={{
          padding: '8px',
          background: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            GESAMT RESERVIERUNGEN
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--accent)' }}>
            {kpiData.totalReservations.toLocaleString('de-DE')}
          </div>
        </div>

        {/* Toplam Tutar */}
        <div style={{
          padding: '8px',
          background: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            GESAMTBETRAG
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--blue)' }}>
            €{kpiData.totalAmount.toLocaleString('de-DE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        {/* Provizyon */}
        <div style={{
          padding: '8px',
          background: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            PROVİZYON
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--green)' }}>
            €{kpiData.totalProvision.toLocaleString('de-DE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        {/* Netto */}
        <div style={{
          padding: '8px',
          background: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            NETTO
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#8b5cf6' }}>
            €{kpiData.totalNetto.toLocaleString('de-DE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        {/* Offen */}
        <div style={{
          padding: '8px',
          background: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            OFFEN
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
            €{kpiData.totalOffen.toLocaleString('de-DE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        {/* Rest Ver. */}
        <div style={{
          padding: '8px',
          background: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            REST VER.
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>
            €{kpiData.totalRestVer.toLocaleString('de-DE', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>
      </div>

      {/* Section Header with Buttons */}
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div className="section-title">
          Alle Reservierungen
          {selectedIds.length > 0 && (
            <span style={{ 
              marginLeft: '12px', 
              fontSize: '14px', 
              color: 'var(--accent)',
              fontWeight: '600'
            }}>
              ({selectedIds.length} ausgewählt)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedIds.length > 0 && (
            <button 
              className="btn btn-sm" 
              onClick={handleBulkDelete}
              style={{ 
                fontWeight: '600',
                background: '#ef4444',
                color: 'white',
                border: 'none'
              }}
              title={`${selectedIds.length} Reservierungen löschen`}
            >
              🗑️ {selectedIds.length} Reservierungen Löschen
            </button>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleImportExcel}
            style={{ fontWeight: '600' }}
            title="Aus Excel Laden"
          >
            📥 Excel Laden
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleExportExcel}
            style={{ fontWeight: '600' }}
            title="Nach Excel Exportieren"
          >
            📊 Excel Herunterladen
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => setShowScanModal(true)}
            style={{ fontWeight: '600' }}
            title="Reservierung Scannen"
          >
            🔍 Reservierung Scannen
          </button>
          <button 
            className="btn btn-accent btn-sm" 
            onClick={() => setShowAddModal(true)}
            style={{ fontWeight: '600' }}
          >
            ➕ Neue Reservierung
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          fontSize: '11px',
          color: 'var(--text2)',
          fontWeight: '500'
        }}>
          <span>📅</span>
          <span>Datumsfilter:</span>
        </div>
        
        <select 
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          style={{
            padding: '6px 10px',
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
          <option value="all">Alle Jahre</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: '6px 10px',
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
          {MONTHS.map(month => (
            <option key={month.value} value={month.value}>{month.label}</option>
          ))}
        </select>

        {(selectedYear !== 'all' || selectedMonth !== 'all') && (
          <button
            onClick={() => {
              setSelectedYear('all');
              setSelectedMonth('all');
            }}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,77,77,0.3)',
              background: 'rgba(255,77,77,0.1)',
              color: 'var(--red)',
              fontSize: '10px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            ✕ Zurücksetzen
          </button>
        )}

        {/* Sütun Seçici */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }}></div>
        
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '11px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>⚙️</span>
            <span>Spalten</span>
            <span style={{ fontSize: '9px' }}>{showColumnSelector ? '▲' : '▼'}</span>
          </button>

          {showColumnSelector && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '8px',
              minWidth: '200px',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 1000
            }}>
              <div style={{
                padding: '6px 8px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)' }}>
                  Spaltensichtbarkeit
                </span>
                <button
                  onClick={toggleAllColumns}
                  style={{
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--text2)',
                    cursor: 'pointer'
                  }}
                >
                  {Object.values(visibleColumns).every(v => v) ? 'Alle Abwählen' : 'Alle Auswählen'}
                </button>
              </div>
              
              {COLUMN_DEFINITIONS.map(column => (
                <label
                  key={column.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '11px',
                    transition: 'background 0.15s',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => toggleColumn(column.key)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: 'var(--text)' }}>{column.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div className="expense-table-container" style={{ 
        fontSize: '8px',
        width: '100%',
        overflow: 'visible'
      }}>
        <table className="expense-table" style={{ 
          fontSize: '8px',
          tableLayout: 'fixed',
          width: '100%'
        }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 4px', whiteSpace: 'nowrap', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.length === paginatedData.length && paginatedData.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                  title="Tümünü Seç/Kaldır"
                />
              </th>
              {COLUMN_DEFINITIONS.filter(col => visibleColumns[col.key]).map(column => (
                <th key={column.key} style={{ padding: '8px 4px', whiteSpace: 'nowrap', width: column.width }}>
                  {column.label}
                </th>
              ))}
              <th style={{ padding: '8px 4px', whiteSpace: 'nowrap', width: '8%' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(v => v).length + 2} style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ color: '#888' }}>
                    {filtered.length === 0 ? 'Noch keine Reservierungen vorhanden' : 'Keine Datensätze auf dieser Seite'}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map(reservation => (
                <tr key={reservation.id}>
                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(reservation.id)}
                      onChange={() => toggleSelectOne(reservation.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  {COLUMN_DEFINITIONS.filter(col => visibleColumns[col.key]).map(column => (
                    <td 
                      key={column.key}
                      style={{ 
                        padding: '6px 4px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}
                      title={column.key === 'reisebeschreibung' ? (reservation.reisebeschreibung || '') : undefined}
                    >
                      {renderCellContent(reservation, column.key)}
                    </td>
                  ))}
                  <td style={{ padding: '6px 4px', whiteSpace: 'nowrap' }}>
                    <div className="action-buttons" style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                      <button 
                        className="edit-btn" 
                        onClick={() => handleEditClick(reservation)}
                        title="Bearbeiten"
                        style={{ 
                          padding: '4px 6px', 
                          fontSize: '14px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="delete-btn" 
                        onClick={() => {
                          if (window.confirm('Sind Sie sicher, dass Sie diese Reservierung löschen möchten?')) {
                            onDelete(reservation.id);
                          }
                        }}
                        title="Löschen"
                        style={{ 
                          padding: '4px 6px', 
                          fontSize: '14px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Kontrolleri */}
      {filtered.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 12px',
          background: 'var(--surface)',
          borderRadius: '0 0 12px 12px',
          border: '1px solid var(--border)',
          borderTop: 'none',
          marginTop: '-1px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Sol: Bilgi */}
          <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
            <strong>{filtered.length.toLocaleString('de-DE')}</strong> kayıttan{' '}
            <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong>-
            <strong>{Math.min(currentPage * itemsPerPage, filtered.length)}</strong> arası gösteriliyor
          </div>

          {/* Orta: Sayfa Kontrolleri */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: currentPage === 1 ? 'var(--surface)' : 'var(--bg)',
                color: currentPage === 1 ? 'var(--text2)' : 'var(--text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              ⏮ İlk
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: currentPage === 1 ? 'var(--surface)' : 'var(--bg)',
                color: currentPage === 1 ? 'var(--text2)' : 'var(--text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              ◀ Önceki
            </button>
            
            <div style={{ 
              padding: '6px 16px', 
              fontSize: '13px', 
              fontWeight: '600',
              color: 'var(--text)',
              background: 'var(--accent)',
              borderRadius: '6px'
            }}>
              {currentPage} / {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: currentPage === totalPages ? 'var(--surface)' : 'var(--bg)',
                color: currentPage === totalPages ? 'var(--text2)' : 'var(--text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              Sonraki ▶
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: currentPage === totalPages ? 'var(--surface)' : 'var(--bg)',
                color: currentPage === totalPages ? 'var(--text2)' : 'var(--text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              Son ⏭
            </button>
          </div>

          {/* Sağ: Sayfa Başına Kayıt */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)' }}>Sayfa başına:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              style={{
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      )}

      {/* Yeni Rezervasyon Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>➕</span>
                <span>Neue Reservierung Hinzufügen</span>
              </h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">VgNr. *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.vgNr}
                      onChange={(e) => setFormData({...formData, vgNr: e.target.value})}
                      placeholder="VG-2024-001"
                      required
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">Name *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Max Mustermann"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Abreise *</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.abreise}
                      onChange={(e) => setFormData({...formData, abreise: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rückreise</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.ruckreise}
                      onChange={(e) => setFormData({...formData, ruckreise: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ziel</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.ziel}
                      onChange={(e) => setFormData({...formData, ziel: e.target.value})}
                      placeholder="Antalya, Türkei"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gebuchte VA</label>
                    <select
                      className="form-input"
                      value={formData.gebuchteVA}
                      onChange={(e) => {
                        const va = e.target.value;
                        const prov = lookupProvPct(va);
                        const newNetto = prov !== null
                          ? calculateNetto(formData.reisepreis, prov)
                          : formData.netto;
                        setFormData({
                          ...formData,
                          gebuchteVA: va,
                          ...(prov !== null ? { provisionRate: String(prov), netto: newNetto } : {})
                        });
                      }}
                    >
                      <option value="">— Veranstalter wählen —</option>
                      {categories.map(cat => {
                        const [code, name] = cat.includes('|') ? cat.split('|') : [cat, cat];
                        return <option key={code} value={code}>{code} — {name}</option>;
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Buchung</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.buchung}
                      onChange={(e) => setFormData({...formData, buchung: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reisepreis *</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.reisepreis}
                      onChange={(e) => {
                        const newPreis = e.target.value;
                        const newNetto = calculateNetto(newPreis, formData.provisionRate);
                        setFormData({...formData, reisepreis: newPreis, netto: newNetto});
                      }}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Währung</label>
                    <select
                      className="form-select"
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    >
                      <option value="EUR">€ — Euro</option>
                      <option value="TRY">TRY — Türk Lirası</option>
                      <option value="USD">USD — Dolar</option>
                      <option value="CZK">CZK — Çek Korunası</option>
                      <option value="GBP">GBP — Sterlin</option>
                      <option value="CHF">CHF — İsviçre Frangı</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Prov %</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.provisionRate}
                      onChange={(e) => {
                        const newProvRate = e.target.value;
                        const newNetto = calculateNetto(formData.reisepreis, newProvRate);
                        setFormData({...formData, provisionRate: newProvRate, netto: newNetto});
                      }}
                      placeholder="%10"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">KD-OFFEN</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.kdOffen}
                      onChange={(e) => setFormData({...formData, kdOffen: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">NETTO (Otomatik)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.netto}
                      readOnly
                      placeholder="0.00"
                      style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">REST AN VA</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.restAnVA}
                      onChange={(e) => setFormData({...formData, restAnVA: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">Reisebeschreibung</label>
                    <textarea
                      className="form-textarea"
                      value={formData.reisebeschreibung}
                      onChange={(e) => setFormData({...formData, reisebeschreibung: e.target.value})}
                      placeholder="Reise details..."
                      rows="3"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-accent" onClick={handleSubmit}>
                💾 Reservierung Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rezervasyon Düzenleme Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>✏️</span>
                <span>Reservierung Bearbeiten</span>
              </h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleUpdateReservation}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">VgNr. *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.vgNr}
                      onChange={(e) => setFormData({...formData, vgNr: e.target.value})}
                      placeholder="VG-2024-001"
                      required
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">Name *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Max Mustermann"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Abreise *</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.abreise}
                      onChange={(e) => setFormData({...formData, abreise: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rückreise</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.ruckreise}
                      onChange={(e) => setFormData({...formData, ruckreise: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ziel</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.ziel}
                      onChange={(e) => setFormData({...formData, ziel: e.target.value})}
                      placeholder="Antalya, Türkei"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gebuchte VA</label>
                    <select
                      className="form-input"
                      value={formData.gebuchteVA}
                      onChange={(e) => {
                        const va = e.target.value;
                        const prov = lookupProvPct(va);
                        const newNetto = prov !== null
                          ? calculateNetto(formData.reisepreis, prov)
                          : formData.netto;
                        setFormData({
                          ...formData,
                          gebuchteVA: va,
                          ...(prov !== null ? { provisionRate: String(prov), netto: newNetto } : {})
                        });
                      }}
                    >
                      <option value="">— Veranstalter wählen —</option>
                      {categories.map(cat => {
                        const [code, name] = cat.includes('|') ? cat.split('|') : [cat, cat];
                        return <option key={code} value={code}>{code} — {name}</option>;
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Buchung</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.buchung}
                      onChange={(e) => setFormData({...formData, buchung: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reisepreis *</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.reisepreis}
                      onChange={(e) => {
                        const newPreis = e.target.value;
                        const newNetto = calculateNetto(newPreis, formData.provisionRate);
                        setFormData({...formData, reisepreis: newPreis, netto: newNetto});
                      }}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Währung</label>
                    <select
                      className="form-select"
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    >
                      <option value="EUR">€ — Euro</option>
                      <option value="TRY">TRY — Türk Lirası</option>
                      <option value="USD">USD — Dolar</option>
                      <option value="CZK">CZK — Çek Korunası</option>
                      <option value="GBP">GBP — Sterlin</option>
                      <option value="CHF">CHF — İsviçre Frangı</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Prov %</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.provisionRate}
                      onChange={(e) => {
                        const newProvRate = e.target.value;
                        const newNetto = calculateNetto(formData.reisepreis, newProvRate);
                        setFormData({...formData, provisionRate: newProvRate, netto: newNetto});
                      }}
                      placeholder="%10"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">KD-OFFEN</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.kdOffen}
                      onChange={(e) => setFormData({...formData, kdOffen: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">NETTO (Otomatik)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.netto}
                      readOnly
                      placeholder="0.00"
                      style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">REST AN VA</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={formData.restAnVA}
                      onChange={(e) => setFormData({...formData, restAnVA: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">Reisebeschreibung</label>
                    <textarea
                      className="form-textarea"
                      value={formData.reisebeschreibung}
                      onChange={(e) => setFormData({...formData, reisebeschreibung: e.target.value})}
                      placeholder="Reise details..."
                      rows="3"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-accent" onClick={handleUpdateReservation}>
                Aktualisieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Tarama Modal */}
      {showScanModal && (
        <div className="modal-overlay" onClick={() => setShowScanModal(false)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: extractedData ? '960px' : '580px',
              width: extractedData ? '95%' : '90%'
            }}
          >
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📋</span>
                <span>Rezervasyon Bilgilerini Kontrol Edin</span>
              </h2>
              <button className="close-btn" onClick={() => {
                setShowScanModal(false);
                setScanningImage(null);
                setExtractedData(null);
                setRawOcrText('');
                setOcrProgress(0);
                setOcrStatus('');
              }}>×</button>
            </div>
            
            {/* Dosya Yükleme veya Split-Screen */}
            {!scanningImage ? (
              /* İlk Yükleme Ekranı */
              <>
                <div className="modal-body" style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{
                    maxWidth: '500px',
                    margin: '0 auto',
                    padding: '40px',
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    border: '2px dashed var(--border)'
                  }}>
                    <div style={{ fontSize: '64px', marginBottom: '20px' }}>📁</div>
                    <h3 style={{ 
                      marginBottom: '16px', 
                      color: 'var(--text)',
                      fontSize: '20px'
                    }}>
                      Rezervasyon Formu Yükle
                    </h3>
                    <p style={{ 
                      color: 'var(--text2)', 
                      marginBottom: '24px',
                      lineHeight: '1.6'
                    }}>
                      Resim yüklediğinizde otomatik olarak<br/>
                      rezervasyon bilgileri çıkartılacak
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="ocr-file-input"
                    />
                    <label 
                      htmlFor="ocr-file-input"
                      className="btn btn-primary"
                      style={{ 
                        display: 'inline-block',
                        padding: '12px 24px',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: '600'
                      }}
                    >
                      📷 Resim Seç
                    </label>
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--text2)', 
                      marginTop: '20px',
                      padding: '12px',
                      background: 'var(--bg)',
                      borderRadius: '8px'
                    }}>
                      💡 PDF belgelerini resim olarak kaydedin
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setShowScanModal(false)}>Abbrechen</button>
                </div>
              </>
            ) : (
              /* Split-Screen: Sol Form, Sağ Resim */
              <>
                {/* Loading Bar - OCR işlemi devam ederken */}
                {!extractedData && ocrProgress < 100 && (
                  <div style={{
                    padding: '16px 24px',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ 
                        fontSize: '20px',
                        animation: 'pulse 2s ease-in-out infinite'
                      }}>
                        🔍
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: 'var(--text)',
                        flex: '1'
                      }}>
                        Belge Analiz Ediliyor...
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--text2)',
                        fontWeight: '600'
                      }}>
                        {ocrProgress}%
                      </div>
                    </div>
                    <div style={{ 
                      width: '100%',
                      height: '4px',
                      background: 'var(--border)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)',
                        width: `${ocrProgress}%`,
                        transition: 'width 0.3s ease',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                )}

                {/* Ana İçerik - extractedData hazır olduğunda göster */}
                {extractedData && (
                  <div className="modal-body">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      // Düzenlenen verileri kaydet
                      const newReservation = {
                        ...extractedData,
                        reisepreis: parseFloat(extractedData.reisepreis || 0),
                        kdOffen: extractedData.kdOffen ? parseFloat(extractedData.kdOffen) : 0,
                        netto: extractedData.netto ? parseFloat(extractedData.netto) : 0,
                        restAnVA: extractedData.restAnVA ? parseFloat(extractedData.restAnVA) : 0,
                        id: Date.now()
                      };
                      onAddReservation(newReservation);
                      // Modalı kapat ve state'i temizle
                      setShowScanModal(false);
                      setScanningImage(null);
                      setExtractedData(null);
                      setRawOcrText('');
                      setOcrProgress(0);
                      setOcrStatus('');
                    }}>
                      
                      <div style={{ display: 'flex', gap: '20px' }}>
                        {/* Sol: Form Alanları */}
                        <div style={{ flex: '1' }}>
                          <div className="form-grid">
                            <div className="form-group">
                              <label className="form-label">VgNr. *</label>
                              <input
                                className="form-input"
                                type="text"
                                value={extractedData.vgNr}
                                onChange={(e) => setExtractedData({...extractedData, vgNr: e.target.value})}
                                placeholder="VG-2024-001"
                                required
                              />
                            </div>

                            <div className="form-group full">
                              <label className="form-label">Name *</label>
                              <input
                                className="form-input"
                                type="text"
                                value={extractedData.name}
                                onChange={(e) => setExtractedData({...extractedData, name: e.target.value})}
                                placeholder="Max Mustermann"
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Abreise *</label>
                              <input
                                className="form-input"
                                type="date"
                                value={extractedData.abreise}
                                onChange={(e) => setExtractedData({...extractedData, abreise: e.target.value})}
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Rückreise</label>
                              <input
                                className="form-input"
                                type="date"
                                value={extractedData.ruckreise}
                                onChange={(e) => setExtractedData({...extractedData, ruckreise: e.target.value})}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Ziel</label>
                              <input
                                className="form-input"
                                type="text"
                                value={extractedData.ziel}
                                onChange={(e) => setExtractedData({...extractedData, ziel: e.target.value})}
                                placeholder="Antalya, Türkei"
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Gebuchte VA</label>
                              <select
                                className="form-input"
                                value={extractedData.gebuchteVA}
                                onChange={(e) => {
                                  const va = e.target.value;
                                  const prov = lookupProvPct(va);
                                  setExtractedData({
                                    ...extractedData,
                                    gebuchteVA: va,
                                    ...(prov !== null ? { provisionRate: String(prov) } : {})
                                  });
                                }}
                              >
                                <option value="">— Veranstalter wählen —</option>
                                {categories.map(cat => {
                                  const [code, name] = cat.includes('|') ? cat.split('|') : [cat, cat];
                                  return <option key={code} value={code}>{code} — {name}</option>;
                                })}
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="form-label">Buchung</label>
                              <input
                                className="form-input"
                                type="date"
                                value={extractedData.buchung}
                                onChange={(e) => setExtractedData({...extractedData, buchung: e.target.value})}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Reisepreis *</label>
                              <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                value={extractedData.reisepreis}
                                onChange={(e) => {
                                  const newPreis = e.target.value;
                                  const newNetto = calculateNetto(newPreis, extractedData.provisionRate);
                                  setExtractedData({...extractedData, reisepreis: newPreis, netto: newNetto});
                                }}
                                placeholder="0.00"
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Währung</label>
                              <select
                                className="form-select"
                                value={extractedData.currency}
                                onChange={(e) => setExtractedData({...extractedData, currency: e.target.value})}
                              >
                                <option value="EUR">€ — Euro</option>
                                <option value="TRY">TRY — Türk Lirası</option>
                                <option value="USD">USD — Dolar</option>
                                <option value="CZK">CZK — Çek Korunası</option>
                                <option value="GBP">GBP — Sterlin</option>
                                <option value="CHF">CHF — İsviçre Frangı</option>
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="form-label">Prov %</label>
                              <input
                                className="form-input"
                                type="text"
                                value={extractedData.provisionRate}
                                onChange={(e) => {
                                  const newProvRate = e.target.value;
                                  const newNetto = calculateNetto(extractedData.reisepreis, newProvRate);
                                  setExtractedData({...extractedData, provisionRate: newProvRate, netto: newNetto});
                                }}
                                placeholder="%10"
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">KD-OFFEN</label>
                              <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                value={extractedData.kdOffen}
                                onChange={(e) => setExtractedData({...extractedData, kdOffen: e.target.value})}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">NETTO (Otomatik)</label>
                              <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                value={extractedData.netto}
                                readOnly
                                placeholder="0.00"
                                style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">REST AN VA</label>
                              <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                value={extractedData.restAnVA}
                                onChange={(e) => setExtractedData({...extractedData, restAnVA: e.target.value})}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group full">
                              <label className="form-label">Reisebeschreibung</label>
                              <textarea
                                className="form-textarea"
                                value={extractedData.reisebeschreibung}
                                onChange={(e) => setExtractedData({...extractedData, reisebeschreibung: e.target.value})}
                                placeholder="Reise details..."
                                rows="3"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Sağ: Görsel Preview */}
                        {scanningImage && (
                          <div style={{ 
                            flex: '0 0 320px',
                            background: 'var(--bg)',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ 
                              fontSize: '12px', 
                              fontWeight: '600', 
                              color: 'var(--text2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              📄 Taranan Belge
                            </div>
                            <div style={{ 
                              flex: '1',
                              background: '#000',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: '400px'
                            }}>
                              <img 
                                src={scanningImage} 
                                alt="Rezervasyon Formu"
                                style={{ 
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* Modal Footer - extractedData varsa göster */}
            {scanningImage && extractedData && (
              <div className="modal-footer">
                <button 
                  type="button"
                  className="btn btn-outline" 
                  onClick={() => {
                    setShowScanModal(false);
                    setScanningImage(null);
                    setExtractedData(null);
                    setRawOcrText('');
                    setOcrProgress(0);
                    setOcrStatus('');
                  }}
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="btn btn-accent"
                  onClick={(e) => {
                    e.preventDefault();
                    const newReservation = {
                      ...extractedData,
                      reisepreis: parseFloat(extractedData.reisepreis || 0),
                      kdOffen: extractedData.kdOffen ? parseFloat(extractedData.kdOffen) : 0,
                      netto: extractedData.netto ? parseFloat(extractedData.netto) : 0,
                      restAnVA: extractedData.restAnVA ? parseFloat(extractedData.restAnVA) : 0,
                      id: Date.now()
                    };
                    onAddReservation(newReservation);
                    setShowScanModal(false);
                    setScanningImage(null);
                    setExtractedData(null);
                    setRawOcrText('');
                    setOcrProgress(0);
                    setOcrStatus('');
                  }}
                >
                  💾 Reservierung Speichern
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 Excel Importieren - Spalten-Zuordnung</h2>
              <button className="close-btn" onClick={closeImportModal}>×</button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)' }}>
                  ℹ️ <strong>{excelData.length}</strong> Zeilen aus Ihrer Excel-Datei wurden gelesen. 
                  Ordnen Sie unten Ihre Excel-Spalten den Systemspalten zu. 
                  Das grüne ✓ zeigt automatische Zuordnungen an.
                </p>
              </div>

              {/* Header Satırı Seçimi */}
              <div style={{ 
                marginBottom: '20px', 
                padding: '14px', 
                background: 'rgba(59, 130, 246, 0.08)', 
                borderRadius: '8px', 
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px', display: 'block' }}>
                    📋 Başlık Satırı (Header)
                  </label>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text2)', lineHeight: '1.4' }}>
                    Sütun başlıklarının bulunduğu satırı seçin. Otomatik tespit: <strong>Satır {headerRowIndex + 1}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={headerRowIndex}
                    onChange={(e) => {
                      const newIndex = parseInt(e.target.value);
                      setHeaderRowIndex(newIndex);
                      // Yeni header ile verileri yeniden parse et
                      const { headers, data } = parseExcelWithHeaderRow(rawExcelData, newIndex);
                      setExcelHeaders(headers);
                      setExcelData(data);
                      // Otomatik eşleştirmeyi yeniden yap
                      const autoMapping = autoMatchColumns(headers);
                      setColumnMapping(autoMapping);
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: '2px solid rgba(59, 130, 246, 0.5)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    {Array.from({ length: Math.min(15, rawExcelData.length) }, (_, i) => (
                      <option key={i} value={i}>
                        Satır {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Header Preview */}
              {rawExcelData[headerRowIndex] && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '12px', 
                  background: 'var(--surface)', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
                    🔍 Seçili Satır Önizleme:
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    flexWrap: 'wrap',
                    fontSize: '11px'
                  }}>
                    {rawExcelData[headerRowIndex].slice(0, 10).map((cell, idx) => (
                      cell && cell.toString().trim() ? (
                        <span 
                          key={idx} 
                          style={{ 
                            padding: '4px 8px', 
                            background: 'var(--accent-bg)', 
                            borderRadius: '4px',
                            color: 'var(--text)',
                            border: '1px solid var(--accent)'
                          }}
                        >
                          {cell.toString().substring(0, 20)}{cell.toString().length > 20 ? '...' : ''}
                        </span>
                      ) : null
                    ))}
                    {rawExcelData[headerRowIndex].length > 10 && (
                      <span style={{ color: 'var(--text2)', alignSelf: 'center' }}>
                        ... ve {rawExcelData[headerRowIndex].length - 10} sütun daha
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', width: '40%' }}>Excel Sütunu</th>
                      <th style={{ padding: '10px', textAlign: 'center', width: '10%' }}>Durum</th>
                      <th style={{ padding: '10px', textAlign: 'left', width: '50%' }}>Sistem Sütunu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelHeaders.map((header) => (
                      <tr key={header.index} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px' }}>
                          <strong>{header.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                            Örnek: {excelData[0]?.[header.index]?.toString().substring(0, 30) || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {columnMapping[header.index] && columnMapping[header.index] !== 'skip' && (
                            <span style={{ fontSize: '18px', color: 'var(--green)' }}>✓</span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <select
                            value={columnMapping[header.index] || ''}
                            onChange={(e) => setColumnMapping({ ...columnMapping, [header.index]: e.target.value })}
                            style={{ 
                              width: '100%', 
                              padding: '6px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border)',
                              background: 'var(--bg)',
                              color: 'var(--text)',
                              fontSize: '12px'
                            }}
                          >
                            <option value="">-- Atla --</option>
                            <option value="vgNr">Vorg.-Nr.</option>
                            <option value="name">Name</option>
                            <option value="abreise">Abreise (Başlangıç Tarihi)</option>
                            <option value="ruckreise">Rückreise (Dönüş Tarihi)</option>
                            <option value="ziel">Ziel (Hedef)</option>
                            <option value="gebuchteVA">Veranstaltung (Acentesi)</option>
                            <option value="buchung">Buchung (Kayıt Tarihi)</option>
                            <option value="reisepreis">Reisepreis (Fiyat) *</option>
                            <option value="currency">Währung (Para Birimi)</option>
                            <option value="provisionRate">Provision % (Komisyon)</option>
                            <option value="netto">Netto</option>
                            <option value="kdOffen">Kd. Offen (Açık)</option>
                            <option value="restAnVA">Rest an VA</option>
                            <option value="reisebeschreibung">Reisebeschreibung (Açıklama)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--accent)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--accent)' }}>🔍 Önizleme (İlk 3 Satır)</h4>
                <div style={{ overflow: 'auto', maxHeight: '200px' }}>
                  {excelData.slice(0, 3).map((row, idx) => (
                    <div key={idx} style={{ 
                      padding: '8px', 
                      marginBottom: '8px', 
                      background: 'var(--bg)', 
                      borderRadius: '6px',
                      fontSize: '11px'
                    }}>
                      <strong>Satır {idx + 1}:</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                        {Object.entries(columnMapping)
                          .filter(([_, systemCol]) => systemCol && systemCol !== 'skip')
                          .map(([excelColIndex, systemCol]) => (
                            <div key={excelColIndex} style={{ fontSize: '10px' }}>
                              <span style={{ color: 'var(--text2)' }}>
                                {COLUMN_DEFINITIONS.find(c => c.key === systemCol)?.label || systemCol}:
                              </span>{' '}
                              <strong>{row[excelColIndex]?.toString() || '-'}</strong>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={closeImportModal}
              >
                Abbrechen
              </button>
              <button 
                type="button" 
                className="btn btn-accent" 
                onClick={handleConfirmImport}
                disabled={!Object.values(columnMapping).some(v => v && v !== 'skip')}
              >
                ✅ Importieren ({excelData.length} Zeilen)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReservationsView;
