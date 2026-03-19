import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';

function UploadModal({ onClose, onSave, showToast, editingExpense, skipToForm, exchangeRates }) {
  const [step, setStep] = useState(
    editingExpense ? 'form' : skipToForm ? 'form' : 'upload'
  ); // upload, processing, form
  const [processingStep, setProcessingStep] = useState('');
  const [ocrRawText, setOcrRawText] = useState('');
  const [showOcrRaw, setShowOcrRaw] = useState(false);
  const [uploadedImageData, setUploadedImageData] = useState(null); // Görsel data'sı
  const [imageZoom, setImageZoom] = useState(false); // Zoom aktif mi
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 }); // Zoom merkezi (%)
  const fileInputRef = useRef(null);
  const workerRef = useRef(null); // Tesseract worker'ı cache'le

  const [formData, setFormData] = useState({
    tarih: new Date().toISOString().split('T')[0],
    fisno: '',
    aciklama: '',
    tutar: '',
    currency: 'EUR',
    eurAmount: '',
    kategori: 'seyahat',
    otel: 'Genel',
    not: '',
    hasReceipt: true
  });

  // Düzenleme modunda verileri doldur
  useEffect(() => {
    if (editingExpense) {
      setFormData({
        tarih: editingExpense.tarih || new Date().toISOString().split('T')[0],
        fisno: editingExpense.fisno || '',
        aciklama: editingExpense.aciklama || '',
        tutar: String(editingExpense.tutar || ''),
        currency: editingExpense.currency || 'EUR',
        eurAmount: String(editingExpense.eurAmount || ''),
        kategori: editingExpense.kategori || 'seyahat',
        otel: editingExpense.otel || 'Genel',
        not: editingExpense.not || '',
        hasReceipt: editingExpense.hasReceipt || false
      });
    }
  }, [editingExpense]);

  // Component unmount olduğunda worker'ı temizle
  useEffect(() => {
    // Modal açıldığında worker'ı önceden başlat (ilk OCR daha hızlı olsun)
    const initWorker = async () => {
      if (!workerRef.current && step === 'upload') {
        try {
          workerRef.current = await Tesseract.createWorker('deu', 1, {
            logger: () => {} // Sustur
          });
        } catch (err) {
          console.log('Worker başlatma hatası (sorun değil):', err);
        }
      }
    };
    
    initWorker();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [step]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep('processing');
    setProcessingStep('Datei wird hochgeladen...');

    try {
      const fileType = file.type;

      // Sadece Image formatlarını kabul et
      if (fileType.startsWith('image/')) {
        // Image işleme - Görseli base64'e çevir ve kaydet
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedImageData(event.target.result);
        };
        reader.readAsDataURL(file);
        
        await processImage(file);
      } else {
        showToast('❌ Nicht unterstütztes Dateiformat. Bitte laden Sie JPG oder PNG Bilder hoch.');
        setStep('upload');
      }
    } catch (err) {
      console.error('File processing error:', err);
      setStep('form');
      showToast('⚠️ Datei konnte nicht verarbeitet werden — bitte manuell eingeben');
    }
  };

  // Görüntüyü OCR için optimize et (AGRESIF küçültme + kontrast artır)
  const optimizeImageForOCR = (imageSrc) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Max genişlik 1000px (daha küçük = daha hızlı)
        const maxWidth = 1000;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Resmi çiz
        ctx.drawImage(img, 0, 0, width, height);
        
        // Kontrast artır (OCR için daha iyi)
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const contrast = 1.3; // Kontrast faktörü artırıldı
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = factor * (data[i] - 128) + 128;     // R
          data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
          data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Optimize edilmiş resmi base64 olarak döndür (kalite düşürüldü)
        const optimizedImage = canvas.toDataURL('image/jpeg', 0.85);
        resolve(optimizedImage);
      };
      img.onerror = reject;
      img.src = imageSrc;
    });
  };

  // Resimden OCR ile text çıkar (hız optimizasyonu)
  const processImage = async (file) => {
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const imgSrc = ev.target.result;

        try {
          setProcessingStep('🖼️ Görsel optimize ediliyor...');
          
          // Görüntüyü optimize et (küçült + kontrast artır)
          const optimizedImage = await optimizeImageForOCR(imgSrc);
          
          setProcessingStep('📄 OCR başlatılıyor...');
          
          // Worker'ı başlat (cache'lenmiş yoksa)
          if (!workerRef.current) {
            setProcessingStep('⚙️ OCR motoru hazırlanıyor...');
            workerRef.current = await Tesseract.createWorker('deu', 1, {
              logger: () => {} // Worker başlatma loglarını sustur
            });
          }
          
          setProcessingStep('🔍 Metin okunuyor...');
          
          // OCR işlemi
          const result = await workerRef.current.recognize(optimizedImage, {
            rotateAuto: true,
          });
          
          // Progress gösterimi için
          setProcessingStep('✓ OCR tamamlandı');

          const text = result.data.text;
          setOcrRawText(text);
          setProcessingStep('✓ OCR tamamlandı — veriler çıkarılıyor...');

          // Parse OCR text
          await processOcrText(text);

        } catch (err) {
          console.error('OCR Error:', err);
          setStep('form');
          setShowOcrRaw(false);
          showToast('⚠️ OCR fehlgeschlagen — bitte manuell eingeben');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image read error:', err);
      setStep('form');
      showToast('⚠️ Datei konnte nicht gelesen werden');
    }
  };

  // ===== SÜPER AKILLI PARSING SİSTEMİ =====
  // Hem rezervasyon formları hem de fatura/fişler için optimize edilmiş
  
  // YARDIMCI FONKSİYONLAR (processOcrText'ten ÖNCE tanımlı olmalı)
  
  // Form tipini tespit et (rezervasyon, fatura, fiş)
  const detectFormType = (text) => {
    const textLower = text.toLowerCase();
    
    // Rezervasyon formu indikatörleri
    const reservationIndicators = [
      'reisebestätigung', 'buchungsbestätigung', 'reservation confirmation',
      'booking confirmation', 'travel confirmation', 'hotel reservation',
      'room confirmation', 'flight booking', 'tour booking',
      'veranstalter', 'tour operator', 'reisebüro', 'travel agency',
      'teilnehmer', 'reisende', 'travelers', 'guests', 'passengers',
      'check in', 'check out', 'reisetermin', 'aufenthalt', 'stay'
    ];
    
    // Fatura/Fiş indikatörleri
    const invoiceIndicators = [
      'rechnung', 'invoice', 'quittung', 'receipt', 'kassenbon',
      'tax invoice', 'bill', 'beleg', 'kassenschnitt',
      'steuer', 'mwst', 'vat', 'tax', 'kdv', 'ust',
      'betrag', 'summe', 'total', 'zahlung', 'payment',
      'bar', 'cash', 'karte', 'card', 'kartenzahlung'
    ];
    
    let reservationScore = 0;
    let invoiceScore = 0;
    
    reservationIndicators.forEach(indicator => {
      if (textLower.includes(indicator)) reservationScore++;
    });
    
    invoiceIndicators.forEach(indicator => {
      if (textLower.includes(indicator)) invoiceScore++;
    });
    
    if (reservationScore > invoiceScore && reservationScore >= 2) {
      return 'reservation';
    } else if (invoiceScore >= reservationScore) {
      return 'invoice';
    }
    
    return 'unknown';
  };
  
  // Tarih mi tutar mı kontrol et
  const isDateOrAmount = (str) => {
    if (/^\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}$/.test(str)) return true;
    if (/^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}$/.test(str)) return true;
    if (/^\d{1,4}\.\d{2}$/.test(str)) return true;
    if (/^\d{1,4},\d{2}$/.test(str)) return true;
    if (/^20[12]\d$/.test(str)) return true;
    return false;
  };
  
  // OCR hatalarını temizle
  const cleanOcrText = (text) => {
    return text
      .replace(/[|@#$%^*+=<>{}[\]\\]/g, ' ')
      .replace(/\b(exkl|inkl|excl|incl|naskenuj|qr kod|scannen|scan)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+[a-z0-9]{1,2}$/i, '')
      .replace(/^[-\s]+/, '')
      .replace(/[-\s,]+$/, '');
  };

  // Ana parsing fonksiyonu
  const parseReceiptText = (text) => {
    const result = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const textLower = text.toLowerCase();

    console.log('=== PARSING TEXT (Smart OCR v2) ===');
    console.log('Text length:', text.length);
    console.log('Lines:', lines.length);

    // ====== FORM TİPİ TESPİTİ ======
    const formType = detectFormType(text);
    console.log('🔍 Form tipi:', formType);

    // ====== TARİH ARAMA (Geliştirilmiş - Çoklu Tarih Desteği) ======
    const dateKeywords = [
      // Genel tarih kelimeleri
      'date', 'datum', 'tarih', 'fecha', 'data', 'vom', 'am', 'den', 'günü', 'day',
      // Rezervasyon tarihleri
      'reisetermin', 'check in', 'checkin', 'check out', 'checkout', 'arrival', 'departure',
      'anreise', 'abreise', 'einschiffung', 'ausschiffung', 'giriş', 'çıkış',
      // Fatura tarihleri
      'buchungsdatum', 'invoice date', 'bill date', 'rechnungsdatum', 'druckdatum',
      'belge tarihi', 'fatura tarihi', 'issued', 'ausgestellt'
    ];
    
    const allDates = [];
    
    // Tarih formatları - genişletilmiş
    const dateRegexes = [
      /\b(\d{1,2})[.\-\/\s](\d{1,2})[.\-\/\s](\d{2,4})\b/g,
      /\b(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})\b/g,
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)[a-z]*\s+(\d{2,4})\b/gi,
      // Tarih aralıkları: "12.03.2027 - Fr, 26.03.2027"
      /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})\s*[-–]\s*\w*[,.\s]*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/g,
      // Gün isimleri ile: "Fr, 12.03.2027"
      /(mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun)[a-z]*[,.\s]+(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/gi
    ];
    
    const monthMap = {
      jan: '01', januar: '01', feb: '02', februar: '02', mar: '03', märz: '03',
      apr: '04', april: '04', may: '05', mai: '05', jun: '06', juni: '06',
      jul: '07', juli: '07', aug: '08', august: '08', sep: '09', september: '09',
      oct: '10', oktober: '10', nov: '11', november: '11', dec: '12', dezember: '12'
    };
    
    // Tarih çıkarma fonksiyonu
    const extractDate = (day, month, year) => {
      try {
        let monthNum = month;
        
        // Ay ismi mi kontrol et
        if (isNaN(month)) {
          monthNum = monthMap[month.toLowerCase().substring(0, 3)] || monthMap[month.toLowerCase()];
        }
        
        // Yıl 2 haneli mi?
        const fullYear = year.length === 2 ? '20' + year : year;
        
        const dateStr = `${fullYear}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const d = new Date(dateStr);
        
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2035) {
          return dateStr;
        }
      } catch (e) {}
      return null;
    };
    
    // Tüm tarihleri çıkar
    dateRegexes.forEach((regex, idx) => {
      const matches = [...text.matchAll(regex)];
      matches.forEach(m => {
        if (idx === 3) {
          // Tarih aralığı: start ve end tarihleri
          const startDate = extractDate(m[1], m[2], m[3]);
          const endDate = extractDate(m[4], m[5], m[6]);
          if (startDate) allDates.push({ date: startDate, match: m[0], type: 'range_start' });
          if (endDate) allDates.push({ date: endDate, match: m[0], type: 'range_end' });
        } else if (idx === 4) {
          // Gün ismi ile: Fr, 12.03.2027
          const dateStr = extractDate(m[2], m[3], m[4]);
          if (dateStr) allDates.push({ date: dateStr, match: m[0] });
        } else if (m[2] && isNaN(m[2])) {
          // Ay ismi ile
          const dateStr = extractDate(m[1], m[2], m[3]);
          if (dateStr) allDates.push({ date: dateStr, match: m[0] });
        } else if (m[1].length === 4) {
          // YYYY-MM-DD formatı
          const dateStr = extractDate(m[3], m[2], m[1]);
          if (dateStr) allDates.push({ date: dateStr, match: m[0] });
        } else {
          // DD.MM.YYYY formatı
          const dateStr = extractDate(m[1], m[2], m[3]);
          if (dateStr) allDates.push({ date: dateStr, match: m[0] });
        }
      });
    });
    
    // Tarih seçimi - keyword yakınlığına göre en iyi tarihi bul
    let bestDate = null;
    let minDistance = Infinity;
    
    // Buchungsdatum, Druckdatum, Invoice Date → Fatura tarihi (öncelikli)
    const priorityKeywords = ['buchungsdatum', 'druckdatum', 'invoice date', 'bill date', 'rechnungsdatum', 'belge tarihi', 'fatura tarihi'];
    priorityKeywords.forEach(keyword => {
      const keywordIndex = textLower.indexOf(keyword);
      if (keywordIndex !== -1) {
        allDates.forEach(dateObj => {
          const dateIndex = text.toLowerCase().indexOf(dateObj.match.toLowerCase());
          const distance = Math.abs(dateIndex - keywordIndex);
          if (distance < 150) {
            if (distance < minDistance) {
              minDistance = distance;
              bestDate = dateObj.date;
            }
          }
        });
      }
    });
    
    // Bulunamadıysa genel keyword'lerle ara
    if (!bestDate) {
      dateKeywords.forEach(keyword => {
        const keywordIndex = textLower.indexOf(keyword);
        if (keywordIndex !== -1) {
          allDates.forEach(dateObj => {
            const dateIndex = text.toLowerCase().indexOf(dateObj.match.toLowerCase());
            const distance = Math.abs(dateIndex - keywordIndex);
            if (distance < 100) {
              if (distance < minDistance) {
                minDistance = distance;
                bestDate = dateObj.date;
              }
            }
          });
        }
      });
    }
    
    // Hala bulunamadıysa ilk tarihi al (bugüne en yakın olanı tercih et)
    if (!bestDate && allDates.length > 0) {
      const today = new Date();
      allDates.sort((a, b) => {
        const diffA = Math.abs(new Date(a.date) - today);
        const diffB = Math.abs(new Date(b.date) - today);
        return diffA - diffB;
      });
      bestDate = allDates[0].date;
    }
    
    result.tarih = bestDate || '';
    console.log('📅 Bulunan tarihler:', allDates.length, '→ Seçilen:', result.tarih);

    // ====== FIŞ/REZERVASYON NUMARASI ARAMA (Geliştirilmiş) ======
    const invoiceKeywords = [
      // Fatura kelimeleri
      'invoice', 'inv', 'rechnung', 'rechn', 'rech', 'beleg', 'bon', 'receipt', 'rec',
      'fiş', 'fis', 'fatura', 'belge', 'bill', 'quittung', 'kassenbon', 'tax invoice',
      'no', 'nr', 'number', 'nummer', 'numara', 'numarası', 'num', 'doc', 'document',
      'ticket', 'voucher', 'gutschein', 'slip', 'reference', 'ref', 'transaction', 'trans',
      // Rezervasyon kelimeleri (eklendi)
      'auftragsnummer', 'buchungsnummer', 'buchungs nr', 'buchungs-nr', 'booking number',
      'booking ref', 'confirmation', 'bestätigung', 'kundennummer', 'customer number',
      'reservierung', 'reservation', 'order', 'auftrag', 'pnr', 'record locator',
      'teilnehmer', 'guests', 'travelers'
    ];
    
    const invoiceNumbers = [];
    
    // Pattern 1: Keyword + Numara (en yüksek öncelik)
    invoiceKeywords.forEach(keyword => {
      const regex1 = new RegExp(keyword + '\\s*[:.#\\-]?\\s*([A-Z0-9][A-Z0-9\\-\\/\\.]{1,25})', 'gi');
      const matches1 = [...text.matchAll(regex1)];
      matches1.forEach(m => {
        const candidate = m[1].trim();
        if (candidate.length >= 2 && !isDateOrAmount(candidate)) {
          invoiceNumbers.push({ value: candidate, priority: 10 });
        }
      });
    });
    
    // Pattern 2: Harf-rakam kombinasyonları
    const pattern2 = /\b([A-Z]{2,5}[\-\/\.]\d{2,15})\b/g;
    [...text.matchAll(pattern2)].forEach(m => {
      const candidate = m[1].trim();
      if (!isDateOrAmount(candidate)) {
        invoiceNumbers.push({ value: candidate, priority: 8 });
      }
    });
    
    // Pattern 3: Uzun rakam dizileri (6-12 hane) - rezervasyon numaraları için
    const pattern3 = /\b(\d{6,12})\b/g;
    [...text.matchAll(pattern3)].forEach(m => {
      const candidate = m[1];
      if (!isDateOrAmount(candidate)) {
        invoiceNumbers.push({ value: candidate, priority: 5 });
      }
    });
    
    // Pattern 4: Kısa rakam dizileri keyword yakınında
    invoiceKeywords.forEach(keyword => {
      const keywordPos = textLower.indexOf(keyword.toLowerCase());
      if (keywordPos !== -1) {
        const snippet = text.substring(keywordPos, keywordPos + 50);
        const regex = /\b(\d{4,8})\b/g;
        [...snippet.matchAll(regex)].forEach(m => {
          const candidate = m[1];
          if (!isDateOrAmount(candidate)) {
            invoiceNumbers.push({ value: candidate, priority: 7 });
          }
        });
      }
    });
    
    // Pattern 5: Harf-rakam-harf kombinasyonları
    const pattern5 = /\b([A-Z0-9]{5,15})\b/g;
    [...text.matchAll(pattern5)].forEach(m => {
      const candidate = m[1];
      if (/[A-Z]/.test(candidate) && /\d/.test(candidate) && !isDateOrAmount(candidate)) {
        invoiceNumbers.push({ value: candidate, priority: 6 });
      }
    });
    
    // Tekrar edenleri birleştir (aynı değerden varsa en yüksek önceliği al)
    const uniqueNumbers = new Map();
    invoiceNumbers.forEach(item => {
      if (!uniqueNumbers.has(item.value) || uniqueNumbers.get(item.value) < item.priority) {
        uniqueNumbers.set(item.value, item.priority);
      }
    });
    
    // Map'i array'e çevir ve sırala
    const sortedNumbers = Array.from(uniqueNumbers.entries())
      .map(([value, priority]) => ({ value, priority }))
      .sort((a, b) => b.priority - a.priority);
    
    result.fisno = sortedNumbers.length > 0 ? sortedNumbers[0].value : '';
    console.log('🔢 Bulunan numaralar:', sortedNumbers.map(n => `${n.value} (p:${n.priority})`).slice(0, 5), '→ Seçilen:', result.fisno);

    // ====== MÜŞTERİ ADI ÇIKARMA (Rezervasyon formları için) ======
    if (formType === 'reservation') {
      const nameKeywords = [
        'herr', 'frau', 'mr', 'mrs', 'ms', 'miss',
        'reisende', 'travelers', 'guests', 'passengers', 'passengers',
        'kunde', 'customer', 'müşteri', 'name', 'namen'
      ];
      
      const names = [];
      
      // Pattern: Herr/Frau + Ad Soyad
      const namePattern = /(herr|frau|mr|mrs|ms)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/gi;
      [...text.matchAll(namePattern)].forEach(m => {
        const fullName = m[2].trim();
        if (fullName.length >= 5 && fullName.split(' ').length <= 4) {
          names.push(fullName);
        }
      });
      
      if (names.length > 0) {
        // İlk ismi not alanına ekle
        result.not = `Müşteri: ${names.join(', ')}`;
        console.log('👤 Bulunan isimler:', names);
      }
    }

    // ====== TUTAR ARAMA (Geliştirilmiş - Rezervasyon + Fatura) ======
    const amountKeywords = [
      // İngilizce
      'total', 'sum', 'amount', 'payable', 'to pay', 'grand total', 'subtotal', 
      'total due', 'amount due', 'balance', 'charge', 'payment', 'paid', 'price',
      'total price', 'final amount',
      // Almanca (genişletilmiş)
      'gesamt', 'summe', 'betrag', 'zahlen', 'brutto', 'netto', 'endsumme',
      'zu zahlen', 'bezahlt', 'preis', 'kosten', 'rechnungsbetrag',
      'gesamtpreis', 'leistungspreis', 'reisepreis', 'restbetrag', 'pauschale',
      'anzahlung', 'restzahlung', 'endpreis',
      // Türkçe
      'toplam', 'tutar', 'ödenecek', 'ara toplam', 'genel toplam', 'ödenen', 'fiyat'
    ];
    
    const amounts = new Map(); // amount -> context score
    
    // Pattern 1: Keyword + Amount (en yüksek öncelik)
    amountKeywords.forEach(keyword => {
      // Keyword sonrası : veya boşluk ve ardından tutar
      const regex = new RegExp(keyword + '[:\\s€$£₺]*([\\d.,]+)', 'gi');
      const matches = [...text.matchAll(regex)];
      matches.forEach(m => {
        const numStr = m[1];
        const cleanNum = normalizeNumber(numStr);
        const val = parseFloat(cleanNum);
        
        if (val > 0 && val < 1000000) {
          const score = amounts.get(val) || 0;
          amounts.set(val, score + 10);
        }
      });
    });
    
    // Pattern 2: Currency + Amount (yüksek öncelik)
    const currencyPatterns = [
      /(EUR|€|USD|\$|CHF|GBP|£|TRY|TL|₺|CZK|Kč)[:\s]*(\d{1,7}[.,]\d{2})/gi,
      /(\d{1,7}[.,]\d{2})\s*(EUR|€|USD|\$|CHF|GBP|£|TRY|TL|₺|CZK|Kč)/gi,
      // Binlik ayraçlı: 7.925,00 EUR
      /(\d{1,3}\.\d{3}[.,]\d{2})\s*(EUR|€|USD|\$|CHF|GBP|£|TRY|TL|₺)/gi,
      /(EUR|€|USD|\$|CHF|GBP|£|TRY|TL|₺)\s*(\d{1,3}\.\d{3}[.,]\d{2})/gi
    ];
    
    currencyPatterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(m => {
        const numStr = m[1].match(/[\d.,]+/) ? m[1] : m[2];
        const cleanNum = normalizeNumber(numStr);
        const val = parseFloat(cleanNum);
        
        if (val > 0 && val < 1000000) {
          const score = amounts.get(val) || 0;
          amounts.set(val, score + 8);
        }
      });
    });
    
    // Pattern 3: Herhangi bir XX.XX veya XX,XX (düşük öncelik)
    const allNumbers = [...text.matchAll(/\b(\d{1,7}[.,]\d{2})\b/g)];
    allNumbers.forEach(m => {
      const numStr = m[1];
      const cleanNum = normalizeNumber(numStr);
      const val = parseFloat(cleanNum);
      
      if (val > 10 && val < 1000000) {
        const score = amounts.get(val) || 0;
        amounts.set(val, score + 1);
      }
    });
    
    // Sayı normalizasyonu fonksiyonu
    function normalizeNumber(numStr) {
      // Virgül ve nokta var mı kontrol et
      const hasComma = numStr.includes(',');
      const hasDot = numStr.includes('.');
      
      if (hasComma && hasDot) {
        // 1.234,56 → 1234.56 (Avrupa formatı)
        // 1,234.56 → 1234.56 (US formatı)
        const lastComma = numStr.lastIndexOf(',');
        const lastDot = numStr.lastIndexOf('.');
        
        if (lastComma > lastDot) {
          // Virgül sonda → Avrupa: 1.234,56
          return numStr.replace(/\./g, '').replace(',', '.');
        } else {
          // Nokta sonda → US: 1,234.56
          return numStr.replace(/,/g, '');
        }
      } else if (hasComma) {
        // Sadece virgül: 13,82 → 13.82 (Avrupa)
        return numStr.replace(',', '.');
      } else if (hasDot) {
        // Sadece nokta: kontrol et
        const parts = numStr.split('.');
        if (parts.length === 2 && parts[1].length === 2) {
          // 13.82 (decimal) → 13.82
          return numStr;
        } else if (parts.length === 2 && parts[1].length === 3) {
          // 7.925 (binlik ayraç) → 7925
          return numStr.replace('.', '');
        } else {
          // Çok parçalı: 1.234.567 → 1234567
          return numStr.replace(/\./g, '');
        }
      }
      
      return numStr;
    }
    
    // En yüksek skorlu tutarı seç
    let bestAmount = 0;
    let bestScore = 0;
    amounts.forEach((score, amount) => {
      if (score > bestScore || (score === bestScore && amount > bestAmount)) {
        bestScore = score;
        bestAmount = amount;
      }
    });
    
    if (bestAmount > 0) {
      result.tutar = bestAmount.toFixed(2);
    }
    console.log('💰 Bulunan tutarlar:', Array.from(amounts.entries()).slice(0, 10), '→ Seçilen:', result.tutar, `(score: ${bestScore})`);

    // ====== PARA BİRİMİ ======
    const currencyMap = {
      'EUR': /€|EUR|euro/gi,
      'USD': /\$|USD|dollar/gi,
      'GBP': /£|GBP|pound/gi,
      'CHF': /CHF|franc/gi,
      'TRY': /TL|TRY|₺|lira/gi,
      'CZK': /CZK|Kč|koruna/gi
    };
    
    // Önce tutarın yakınındaki para birimini ara
    if (result.tutar) {
      const amountStr = result.tutar.replace('.', '[.,]'); // 13.82 veya 13,82 olabilir
      const amountRegex = new RegExp(`(${Object.keys(currencyMap).join('|')}|€|\\$|£|₺|Kč|TL)\\s*${amountStr}|${amountStr}\\s*(${Object.keys(currencyMap).join('|')}|€|\\$|£|₺|Kč|TL)`, 'gi');
      const match = text.match(amountRegex);
      
      if (match && match[0]) {
        for (const [curr, pattern] of Object.entries(currencyMap)) {
          if (pattern.test(match[0])) {
            result.currency = curr;
            break;
          }
        }
      }
    }
    
    // Bulunamadıysa genel aramada bul
    if (!result.currency) {
      for (const [curr, pattern] of Object.entries(currencyMap)) {
        if (pattern.test(text)) {
          result.currency = curr;
          break;
        }
      }
    }

    // ====== KATEGORİ OTOMATİK TESPİT (Geliştirilmiş) ======
    const categoryKeywords = {
      // YEMEK - Restaurant, market, cafe, bakery...
      'yemek': [
        'restaurant', 'cafe', 'bistro', 'bar', 'imbiss', 'mensa', 'kantine',
        'supermarket', 'market', 'grocery', 'lebensmittel', 'edeka', 'rewe', 'aldi', 'lidl', 'penny', 'kaufland',
        'bakery', 'bäckerei', 'fırın', 'patisserie', 'konditorei',
        'pizza', 'burger', 'kebab', 'döner', 'sushi', 'pasta',
        'food', 'essen', 'yemek', 'lokanta', 'breakfast', 'lunch', 'dinner', 'brunch',
        'mcdonald', 'starbucks', 'subway', 'kfc', 'beverage', 'getränk', 'drink'
      ],
      // KONAKLAMA - Hotel, hostel, cruise (genişletilmiş)
      'konaklama': [
        'hotel', 'motel', 'hostel', 'pension', 'accommodation', 'unterkunft', 
        'resort', 'inn', 'lodge', 'airbnb', 'booking', 'otel', 'pansiyon',
        'mercure', 'ibis', 'hilton', 'marriott', 'holiday inn', 'novotel', 'radisson',
        'übernachtung', 'zimmer', 'room', 'suite', 'apartment', 'guesthouse',
        // Cruise/gemi seyahatleri eklendi
        'cruise', 'kreuzfahrt', 'cruises', 'schiff', 'gemi', 'ship', 'msc', 
        'aida', 'tui cruises', 'costa', 'norwegian', 'royal caribbean',
        'kabine', 'cabin', 'balkonkabine', 'deck', 'einschiffung', 'ausschiffung'
      ],
      // UÇAK - Airlines, flight...
      'uçak': [
        'airline', 'airways', 'flight', 'flug', 'airport', 'lufthansa', 'turkish airlines',
        'thy', 'ryanair', 'easyjet', 'wizz', 'boarding', 'ticket', 'uçak', 'uçuş',
        'eurowings', 'condor', 'emirates', 'klm', 'air france', 'british airways'
      ],
      // TAKSİ - Taxi, uber, bolt...
      'taksi': [
        'taxi', 'cab', 'uber', 'bolt', 'lyft', 'taksi', 'fahrservice',
        'ride', 'transfer', 'chauffeur', 'driver', 'freeNow', 'mytaxi'
      ],
      // PARK - Parking...
      'park': [
        'parking', 'parkhaus', 'parkplatz', 'otopark', 'park',
        'garage', 'garaj', 'stellplatz', 'tiefgarage', 'park one',
        'apcoa', 'contipark'
      ],
      // SEYAHAT - Train, bus, transportation, tour operators (genişletilmiş)
      'seyahat': [
        'train', 'bahn', 'railway', 'tren', 'zug', 'db', 'ice', 'deutsche bahn',
        'bus', 'autobus', 'otobüs', 'coach', 'fernbus', 'flixbus',
        'metro', 'u-bahn', 's-bahn', 'subway', 'tram', 'tramvay',
        'ticket', 'bilet', 'fahrkarte', 'transportation', 'travel', 'reise',
        'mietwagen', 'rent', 'rental', 'kiralama', 'car rental', 'sixt', 'europcar', 'hertz',
        'vignette', 'maut', 'toll', 'geçiş ücreti', 'highway', 'autobahn',
        'petrol', 'benzin', 'diesel', 'fuel', 'yakıt', 'tankstelle', 'gas station', 'shell', 'aral', 'total',
        // Tour operatörleri ve rezervasyon kelimeleri
        'reisebestätigung', 'buchungsbestätigung', 'veranstalter', 'tour operator',
        'reisebüro', 'travel agency', 'pauschalreise', 'package tour',
        'rundreise', 'ausflug', 'excursion', 'safari', 'tour', 'tur',
        'fti', 'dertour', 'tui', 'alltours', 'thomas cook', 'neckermann'
      ],
      // MARKETING - Advertisement, social media, promotion...
      'marketing': [
        'marketing', 'advertisement', 'werbung', 'reklam', 'advertising',
        'facebook', 'google ads', 'instagram', 'social media', 'promotion',
        'flyer', 'banner', 'print', 'design', 'agency', 'agentur',
        'hostes', 'hostess', 'stand', 'messe', 'exhibition', 'fair', 'expo',
        'presentation', 'präsentation', 'sunum', 'workshop', 'seminar', 'event',
        'lieferung', 'delivery', 'versand', 'shipping', 'druck', 'printing'
      ],
      // KIRTASİYE - Office, stationery...
      'kırtasiye': [
        'office', 'büro', 'stationery', 'kırtasiye', 'kağıt', 'paper',
        'pen', 'kalem', 'printer', 'drucker', 'yazıcı', 'toner', 'ink',
        'staples', 'folder', 'file', 'ordner', 'dosya'
      ]
    };
    
    // Metinde en çok eşleşen kategoriyi bul
    let bestCategory = 'seyahat'; // default
    let maxMatches = 0;
    
    // Form tipine göre kategori önceliklendirme
    if (formType === 'reservation') {
      // Rezervasyon formu ise varsayılan olarak "seyahat" veya "konaklama"
      if (textLower.includes('hotel') || textLower.includes('unterkunft') || 
          textLower.includes('cruise') || textLower.includes('kreuzfahrt') ||
          textLower.includes('zimmer') || textLower.includes('room')) {
        bestCategory = 'konaklama';
      } else {
        bestCategory = 'seyahat';
      }
    }
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let matches = 0;
      keywords.forEach(keyword => {
        if (textLower.includes(keyword.toLowerCase())) {
          matches++;
        }
      });
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category;
      }
    }
    
    result.kategori = bestCategory;
    console.log('🏷️ Kategori tespit - Eşleşmeler:', maxMatches, '→ Seçilen:', bestCategory);

    // ====== AÇIKLAMA (Şirket/Veranstalter Adı) - Geliştirilmiş ======
    
    // Rezervasyon formları için "Veranstalter" (tur operatörü) ara
    if (formType === 'reservation') {
      const veranstalterKeywords = [
        'veranstalter', 'tour operator', 'reisebüro', 'travel agency',
        'anbieter', 'firma', 'company', 'şirket', 'organizer'
      ];
      
      veranstalterKeywords.forEach(keyword => {
        const keywordPos = textLower.indexOf(keyword.toLowerCase());
        if (keywordPos !== -1 && !result.aciklama) {
          // Keyword'den sonraki 100 karakter içinde şirket adı ara
          const snippet = text.substring(keywordPos, keywordPos + 150);
          const snippetLines = snippet.split('\n');
          
          // Şirket adı indikatörleri
          const companyPattern = /([A-ZÄÖÜ][a-zäöüß]*[\s\-]*)+\s+(GmbH|AG|Ltd|Inc|LLC|S\.A\.|Corp|Company)/gi;
          const matches = [...snippet.matchAll(companyPattern)];
          
          if (matches.length > 0) {
            const companyName = cleanOcrText(matches[0][0]);
            result.aciklama = companyName.substring(0, 60);
          } else {
            // Pattern bulunamadıysa keyword'den sonraki ilk anlamlı satırı al
            for (let i = 1; i < snippetLines.length && i < 3; i++) {
              const line = cleanOcrText(snippetLines[i]);
              if (line.length >= 5 && line.length <= 70 &&
                  /[A-Z]/.test(line) && // En az 1 büyük harf
                  !/\d{4,}/.test(line)) { // 4+ haneli rakam yok
                result.aciklama = line.substring(0, 60);
                break;
              }
            }
          }
        }
      });
    }
    
    // Fatura/Fiş için şirket adını genel yöntemle ara
    if (!result.aciklama) {
      const companyIndicators = /gmbh|ltd|inc|llc|ag|s\.a\.|corp|company|hotel|restaurant|cafe|shop|store|market|supermarket|apotheke|pharmacy|eczane|tankstelle|petrol|gas station|bistro|bar|bäckerei|bakery|fırın|park one|mercure|ibis|cruises/gi;
      
      for (const line of lines) {
        const cleanLine = cleanOcrText(line);
        if (cleanLine.length >= 5 && cleanLine.length <= 70 && companyIndicators.test(cleanLine)) {
          if (!/invoice|receipt|total|date|tax|vat|mwst|thank|danke|teşekkür|rechnung/gi.test(cleanLine)) {
            result.aciklama = cleanLine.substring(0, 60);
            break;
          }
        }
      }
    }
    
    // Hala bulunamadıysa ilk anlamlı satır
    if (!result.aciklama) {
      for (const line of lines) {
        const cleanLine = cleanOcrText(line);
        if (cleanLine.length >= 5 && cleanLine.length <= 70 && 
            /[a-zA-ZäöüÄÖÜßğĞıİşŞçÇ]{3,}/.test(cleanLine) &&  // En az 3 harf
            !/^\d+$/.test(cleanLine) &&  // Sadece rakam değil
            !/invoice|receipt|date|total|tax|page|\d{4}|thank|mwst|vat|ust|kdv/gi.test(cleanLine)) {  // Gereksiz kelimeler yok
          result.aciklama = cleanLine.substring(0, 60);
          break;
        }
      }
    }

    console.log('📝 Açıklama:', result.aciklama);
    
    // ====== PARSING SONUÇ ÖZETİ ======
    console.log('\n=== 🎯 PARSING SONUÇLARI ===');
    console.log('Form Tipi:', formType === 'reservation' ? '📋 Rezervasyon' : formType === 'invoice' ? '🧾 Fatura' : '❓ Bilinmeyen');
    console.log('Tarih:', result.tarih || '❌ Bulunamadı');
    console.log('Fiş/Rezervasyon No:', result.fisno || '❌ Bulunamadı');
    console.log('Tutar:', result.tutar ? `${result.tutar} ${result.currency || 'EUR'}` : '❌ Bulunamadı');
    console.log('Kategori:', result.kategori);
    console.log('Açıklama:', result.aciklama || '❌ Bulunamadı');
    if (result.not) console.log('Not:', result.not);
    console.log('========================\n');

    return result;
  };

  // OCR sonucunu analiz et ve form alanlarını doldur
  const processOcrText = async (text) => {
    setProcessingStep('📋 Veriler çıkarılıyor...');
    
    const parsed = parseReceiptText(text);
    
    // EUR amount hesapla (currency EUR değilse)
    if (parsed.currency && parsed.currency !== 'EUR' && parsed.tutar && exchangeRates) {
      const amount = parseFloat(parsed.tutar) || 0;
      const rate = exchangeRates[parsed.currency] || 1;
      parsed.eurAmount = amount > 0 ? (amount * rate).toFixed(2) : '';
    }
    
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        ...parsed
      }));
      setShowOcrRaw(true);
      setStep('form');
      
      const filledCount = [parsed.tarih, parsed.fisno, parsed.tutar, parsed.aciklama, parsed.kategori].filter(Boolean).length;
      if (filledCount > 0) {
        showToast(`✓ OCR: ${filledCount} alan otomatik dolduruldu (kategori: ${parsed.kategori}) — kontrol edin`);
      } else {
        showToast('⚠️ OCR metni okundu ama alan çıkarılamadı — elle doldurun');
      }
    }, 400);
  };


  // Mouse hareketiyle zoom pozisyonunu güncelle
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const handleSave = async () => {
    if (!formData.tutar || parseFloat(formData.tutar) <= 0) {
      showToast('⚠️ Bitte geben Sie einen gültigen Betrag ein!');
      return;
    }

    if (!formData.aciklama) {
      showToast('⚠️ Bitte geben Sie eine Beschreibung ein!');
      return;
    }

    // Görseli formData ile birlikte gönder (kaydetme App.jsx'de olacak)
    const finalData = {
      ...formData,
      imageData: uploadedImageData // Base64 görsel
    };

    onSave(finalData);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: value
      };
      
      // Tutar veya currency değiştiğinde EUR Amount'u otomatik hesapla
      if ((name === 'tutar' || name === 'currency') && updated.currency !== 'EUR' && exchangeRates) {
        const amount = parseFloat(updated.tutar) || 0;
        const rate = exchangeRates[updated.currency] || 1;
        updated.eurAmount = amount > 0 ? (amount * rate).toFixed(2) : '';
      } else if (updated.currency === 'EUR') {
        // EUR seçildiğinde eurAmount'u temizle
        updated.eurAmount = '';
      }
      
      return updated;
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div 
        className="modal" 
        style={{ 
          maxWidth: (step === 'form' && uploadedImageData) ? '960px' : '580px',
          transition: 'max-width 0.3s ease'
        }}
      >
        <div className="modal-header">
          <div className="modal-title">🧾 {editingExpense ? 'Beleg Bearbeiten' : 'Beleg Hinzufügen'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {step === 'upload' && (
            <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div className="drop-icon">�</div>
              <div className="drop-title">Beleg hochladen</div>
              <div className="drop-sub">JPG, PNG unterstützt • OCR Texterkennung</div>
            </div>
          )}

          {step === 'processing' && (
            <div className="ai-processing">
              <div className="spinner"></div>
              <div className="ai-text">OCR liest...</div>
              <div className="ai-step">{processingStep}</div>
            </div>
          )}

          {step === 'form' && (
            <>
              {/* OCR Debug - Her zaman göster */}
              {ocrRawText && (
                <>
                  <div className="extracted-badge" style={{
                    background: 'rgba(0,184,255,0.12)',
                    border: '1px solid rgba(0,184,255,0.3)',
                    color: 'var(--accent2)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowOcrRaw(!showOcrRaw)}
                  >
                    📄 Mit OCR gelesen — {showOcrRaw ? 'Text ausblenden' : 'Gelesenen Text anzeigen'}
                  </div>
                  {showOcrRaw && (
                    <div className="ocr-raw-box" style={{ marginBottom: '15px' }}>
                      <div className="ocr-raw-label">OCR Rohtext (Debug)</div>
                      <div className="ocr-raw" style={{
                        maxHeight: '250px',
                        overflowY: 'auto',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.4'
                      }}>
                        {ocrRawText}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '20px' }}>
                {/* Sol: Form Alanları */}
                <div style={{ flex: uploadedImageData ? '1' : '1' }}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Datum</label>
                      <input
                        className="form-input"
                        type="date"
                        name="tarih"
                        value={formData.tarih}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Beleg Nr.</label>
                      <input
                        className="form-input"
                        type="text"
                        name="fisno"
                        value={formData.fisno}
                        onChange={handleChange}
                        placeholder="INV-2026-001"
                      />
                    </div>

                    <div className="form-group full">
                      <label className="form-label">Beschreibung</label>
                      <input
                        className="form-input"
                        type="text"
                        name="aciklama"
                        value={formData.aciklama}
                        onChange={handleChange}
                        placeholder="Ausgabenbeschreibung"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Betrag</label>
                      <input
                        className="form-input"
                        type="number"
                        name="tutar"
                        value={formData.tutar}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Währung</label>
                      <select
                        className="form-select"
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                      >
                        <option value="EUR">EUR — Euro</option>
                        <option value="TRY">TRY — Türk Lirası</option>
                        <option value="CZK">CZK — Çek Korunası</option>
                        <option value="USD">USD — Dolar</option>
                        <option value="GBP">GBP — Sterlin</option>
                        <option value="CHF">CHF — İsviçre Frangı</option>
                      </select>
                    </div>

                    {formData.currency !== 'EUR' && (
                      <div className="form-group">
                        <label className="form-label">€ Betrag (EUR Gegenwert)</label>
                        <input
                          className="form-input"
                          type="number"
                          name="eurAmount"
                          value={formData.eurAmount}
                          onChange={handleChange}
                          placeholder="Wird automatisch berechnet..."
                          step="0.01"
                          style={{ 
                            background: 'rgba(16, 185, 129, 0.05)',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        />
                        {exchangeRates && formData.currency && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: 'var(--text2)', 
                            marginTop: '4px',
                            fontStyle: 'italic'
                          }}>
                            Kurs: 1 {formData.currency} = {exchangeRates[formData.currency]?.toFixed(4) || '—'} EUR
                          </div>
                        )}
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Kategorie</label>
                  <select
                    className="form-select"
                    name="kategori"
                    value={formData.kategori}
                    onChange={handleChange}
                  >
                    <option value="seyahat">✈ Reise</option>
                    <option value="konaklama">🏨 Konaklama</option>
                    <option value="uçak">✈️ Flug</option>
                    <option value="taksi">🚕 Taksi</option>
                    <option value="park">🅿️ Park</option>
                    <option value="yemek">🍽 Essen</option>
                    <option value="marketing">📢 Marketing</option>
                    <option value="kırtasiye">📝 Büromaterial</option>
                    <option value="diğer">📦 Sonstiges</option>
                  </select>
                </div>

                <div className="form-group full">
                  <label className="form-label">Notiz</label>
                  <textarea
                    className="form-textarea"
                    name="not"
                    value={formData.not}
                    onChange={handleChange}
                    placeholder="Zusätzliche Bemerkungen..."
                  />
                </div>
              </div>
            </div>

            {/* Sağ: Fiş Görseli Preview */}
            {uploadedImageData && (
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
                  � Taranan Fiş
                </div>
                <div 
                  style={{ 
                    flex: '1',
                    background: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '400px',
                    cursor: 'crosshair',
                    position: 'relative'
                  }}
                  onMouseEnter={() => setImageZoom(true)}
                  onMouseLeave={() => setImageZoom(false)}
                  onMouseMove={handleMouseMove}
                  title="Mit der Maus über das Bild fahren"
                >
                  <img 
                    src={uploadedImageData} 
                    alt="Receipt Preview"
                    style={{ 
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: imageZoom ? 'scale(2)' : 'scale(1)',
                      transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                      transition: 'transform 0.2s ease',
                      pointerEvents: 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {step === 'form' && (
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
            <button className="btn btn-accent" onClick={handleSave}>
              {editingExpense ? 'Aktualisieren' : 'Speichern'}
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
            <button 
              className="btn btn-accent" 
              onClick={() => setStep('form')}
            >
              Manuelle Eingabe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadModal;
