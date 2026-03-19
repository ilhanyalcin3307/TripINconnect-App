import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CAT_CLASS = {
  seyahat: 'cat-travel',
  konaklama: 'cat-hotel',
  uçak: 'cat-flight',
  taksi: 'cat-taxi',
  park: 'cat-parking',
  yemek: 'cat-food',
  marketing: 'cat-marketing',
  kırtasiye: 'cat-stationery',
  diğer: 'cat-other'
};

const CAT_EMOJI = {
  seyahat: '✈',
  konaklama: '🏨',
  uçak: '✈️',
  taksi: '🚕',
  park: '🅿️',
  yemek: '🍽',
  marketing: '📢',
  kırtasiye: '📝',
  diğer: '📦'
};

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

// Para birimi dönüştürme (EUR'a) - KPI hesaplamaları için
const convertToEUR = (amount, currency, exchangeRates) => {
  const rate = exchangeRates ? exchangeRates[currency] : (currency === 'EUR' ? 1 : 0.92);
  return amount * (rate || 1);
};

function ExpenseList({ expenses, onDelete, onEdit, onScanExpense, onAddExpense, exchangeRates }) {
  const [filter, setFilter] = useState('tümü');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showPDFModal, setShowPDFModal] = useState(false);
  
  // Sütun filtreleri
  const [searchTarih, setSearchTarih] = useState('');
  const [searchFisno, setSearchFisno] = useState('');
  const [searchAciklama, setSearchAciklama] = useState('');
  const [searchTutar, setSearchTutar] = useState('');

  // Mevcut yılları bul
  const availableYears = useMemo(() => {
    const years = [...new Set(expenses.map(e => e.tarih.substring(0, 4)))];
    return years.sort().reverse();
  }, [expenses]);

  // Filtreleme mantığı
  const filtered = useMemo(() => {
    let result = expenses;

    // Yıl filtresi
    if (selectedYear !== 'all') {
      result = result.filter(e => e.tarih.startsWith(selectedYear));
    }

    // Ay filtresi
    if (selectedMonth !== 'all') {
      result = result.filter(e => e.tarih.substring(5, 7) === selectedMonth);
    }

    // Kategori filtresi
    if (filter !== 'tümü') {
      result = result.filter(e => e.kategori === filter);
    }

    // Sütun aramaları
    if (searchTarih) {
      result = result.filter(e => 
        e.tarih && e.tarih.toLowerCase().includes(searchTarih.toLowerCase())
      );
    }
    
    if (searchFisno) {
      result = result.filter(e => 
        e.fisno && e.fisno.toLowerCase().includes(searchFisno.toLowerCase())
      );
    }
    
    if (searchAciklama) {
      result = result.filter(e => 
        e.aciklama && e.aciklama.toLowerCase().includes(searchAciklama.toLowerCase())
      );
    }
    
    if (searchTutar) {
      result = result.filter(e => 
        (e.tutar && String(e.tutar).includes(searchTutar)) ||
        (e.currency && e.currency.toLowerCase().includes(searchTutar.toLowerCase()))
      );
    }

    return result;
  }, [expenses, selectedYear, selectedMonth, filter, searchTarih, searchFisno, searchAciklama, searchTutar]);

  // KPI Hesaplamaları
  const kpiData = useMemo(() => {
    if (filtered.length === 0) {
      return {
        totalFiltered: 0,
        yearTotal: 0,
        trend: 0,
        avgExpense: 0,
        maxExpense: 0,
        topCategory: '-',
        currencies: new Set()
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filtrelenmiş tüm fişlerin toplamı (EUR)
    const totalFiltered = filtered
      .reduce((sum, e) => sum + convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates), 0);

    // Yıllık toplam (EUR) - filtrelenmiş verilerden
    const yearTotal = filtered
      .filter(e => new Date(e.tarih).getFullYear() === currentYear)
      .reduce((sum, e) => sum + convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates), 0);

    // Son 30 gün trend - filtrelenmiş verilerden
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const lastMonthExpenses = filtered.filter(e => new Date(e.tarih) >= thirtyDaysAgo);
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates), 0);
    const prevLastMonthExpenses = filtered.filter(e => {
      const date = new Date(e.tarih);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });
    const prevLastMonthTotal = prevLastMonthExpenses.reduce((sum, e) => sum + convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates), 0);
    const trend = prevLastMonthTotal > 0 ? ((lastMonthTotal - prevLastMonthTotal) / prevLastMonthTotal * 100) : 0;

    // Fiş sayısı - filtrelenmiş verilerden
    const expenseCount = filtered.length;

    // En yüksek harcama - filtrelenmiş verilerden
    const maxExpense = filtered.reduce((max, e) => {
      const amount = convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates);
      return amount > max ? amount : max;
    }, 0);

    // En çok harcama yapılan kategori - filtrelenmiş verilerden
    const catTotals = {};
    filtered.forEach(e => {
      const cat = e.kategori || 'Diğer';
      catTotals[cat] = (catTotals[cat] || 0) + convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates);
    });
    const topCategory = Object.keys(catTotals).reduce((a, b) => catTotals[a] > catTotals[b] ? a : b, '-');

    // Kullanılan para birimleri - filtrelenmiş verilerden
    const currencies = new Set(filtered.map(e => e.currency).filter(Boolean));

    return {
      totalFiltered,
      yearTotal,
      trend,
      expenseCount,
      maxExpense,
      topCategory,
      currencies
    };
  }, [filtered]);

  // Excel Export fonksiyonu
  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      alert('Keine Belege zum Exportieren gefunden!');
      return;
    }

    // Profil bilgilerini yükle
    const settings = await window.electronAPI.getSettings();
    const profile = settings.profile || {};
    
    const fullName = profile.firstName && profile.lastName 
      ? `${profile.firstName} ${profile.lastName}`.toUpperCase()
      : 'ILHAN YALCIN';
    
    const companyName = profile.companyName || 'Anex Tour Austria GmbH';
    const iban = profile.iban || 'AT92 2011 1850 8467 3902';
    const bic = profile.bic || 'GIBAATWWXXX';

    // Ay ve yıl bilgisi
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const currentMonth = selectedMonth !== 'all' 
      ? monthNames[parseInt(selectedMonth) - 1] 
      : monthNames[now.getMonth()];
    const currentYear = selectedYear !== 'all' ? selectedYear : now.getFullYear();

    // Toplam hesapla
    const total = filtered.reduce((sum, e) => {
      const eurAmount = e.eurAmount 
        ? parseFloat(e.eurAmount) 
        : convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates);
      return sum + eurAmount;
    }, 0);

    // Workbook oluştur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expense Report');

    // Sütun genişlikleri
    worksheet.columns = [
      { width: 32 },  // Receipt Number
      { width: 20 },  // Date
      { width: 20 },  // Category
      { width: 50 },  // Description
      { width: 24 }   // Amount
    ];

    // ===== BAŞLIK SATIRI (A1) =====
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Expense Claim Form/ Kostenabrechnung';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    worksheet.getRow(1).height = 30;

    // ===== INFO SATIRLARI =====
    const infoRows = [
      ['Name', fullName],
      ['Company/Firma', companyName],
      ['Expenses for the month of/', `${currentMonth} ${currentYear}`]
    ];

    infoRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      worksheet.getRow(rowNum).values = row;
      
      // Label cell (A)
      const labelCell = worksheet.getCell(`A${rowNum}`);
      labelCell.font = { bold: true, size: 11 };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
      };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Value cell (B)
      const valueCell = worksheet.getCell(`B${rowNum}`);
      valueCell.font = { size: 11 };
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
      valueCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      worksheet.getRow(rowNum).height = 20;
    });

    // Boş satır
    worksheet.addRow([]);

    // ===== TABLO BAŞLIKLARI =====
    const headerRow = worksheet.addRow([
      'Number of Receipt/ Rechnungsnummer',
      'Date of Receipt/ Rechnungsdatum',
      'Category/ Kategorie',
      'Description/ Beschreibung',
      'Amount EUR/ Betrag EUR'
    ]);

    headerRow.height = 35;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF5B9BD5' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // ===== DATA SATIRLARI =====
    filtered.forEach((expense, idx) => {
      // Kaydedilmiş eurAmount'u kullan, yoksa anlık hesapla
      const amountEUR = expense.eurAmount 
        ? parseFloat(expense.eurAmount) 
        : convertToEUR(parseFloat(expense.tutar) || 0, expense.currency, exchangeRates);

      const dataRow = worksheet.addRow([
        expense.fisno || '',
        expense.tarih || '',
        expense.kategori || '',
        expense.aciklama || '',
        amountEUR
      ]);

      dataRow.height = 20;
      
      // Zebra striping
      const fillColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2';
      
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        };
        cell.alignment = { 
          horizontal: colNumber === 5 ? 'right' : 'left', 
          vertical: 'middle' 
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };

        // Tutar sütunu için format
        if (colNumber === 5) {
          cell.numFmt = '#,##0.00 "€"';
        }
      });
    });

    // ===== GRAND TOTAL =====
    const totalRow = worksheet.addRow(['', '', '', 'Grand Total/ Gesamtsumme', total]);
    totalRow.height = 25;
    
    // İlk 3 hücre boş
    totalRow.getCell(1).border = { top: { style: 'medium' } };
    totalRow.getCell(2).border = { top: { style: 'medium' } };
    totalRow.getCell(3).border = { top: { style: 'medium' } };

    // Total label
    const totalLabelCell = totalRow.getCell(4);
    totalLabelCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    totalLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    totalLabelCell.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };

    // Total value
    const totalValueCell = totalRow.getCell(5);
    totalValueCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    totalValueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    totalValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    totalValueCell.numFmt = '#,##0.00 "€"';
    totalValueCell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'medium' }
    };

    // ===== BANK DETAILS =====
    worksheet.addRow([]);
    worksheet.addRow([]);

    const bankDetailsRows = [
      ['Name', fullName],
      ['Date / Datum:', ''],
      ['Signature / Unterschrift :', ''],
      ['Details for bank transfer:', ''],
      ['IBAN:', iban],
      ['BIC:', bic]
    ];

    bankDetailsRows.forEach((row) => {
      const bankRow = worksheet.addRow(row);
      bankRow.height = 18;
      
      const labelCell = bankRow.getCell(1);
      labelCell.font = { bold: true, size: 10 };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF2CC' }
      };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };

      const valueCell = bankRow.getCell(2);
      valueCell.font = { size: 10, bold: row[0].includes('IBAN') || row[0].includes('BIC') };
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Print ayarları
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      }
    };

    // Dosyayı oluştur ve indir
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const fileName = `Expense_Report_${currentMonth}_${currentYear}.xlsx`;
    saveAs(blob, fileName);
  };

  const handleExportPDF = async (includeReceipts = false) => {
    try {
      if (filtered.length === 0) {
        alert('Dışa aktarılacak fiş bulunamadı!');
        return;
      }

      // Profil bilgilerini yükle
      const settings = await window.electronAPI.getSettings();
      const profile = settings.profile || {};
      
      const fullName = profile.firstName && profile.lastName 
        ? `${profile.firstName} ${profile.lastName}`.toUpperCase()
        : 'ILHAN YALCIN';
      
      const companyName = profile.companyName || 'Anex Tour Austria GmbH';
      const iban = profile.iban || 'AT92 2011 1850 8467 3902';
      const bic = profile.bic || 'GIBAATWWXXX';

      // Ay ve yıl bilgisi
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const now = new Date();
      const currentMonth = selectedMonth !== 'all' 
        ? monthNames[parseInt(selectedMonth) - 1] 
        : monthNames[now.getMonth()];
      const currentYear = selectedYear !== 'all' ? selectedYear : now.getFullYear();

      // Toplam hesapla
      const total = filtered.reduce((sum, e) => {
        const eurAmount = e.eurAmount 
          ? parseFloat(e.eurAmount) 
          : convertToEUR(parseFloat(e.tutar) || 0, e.currency, exchangeRates);
        return sum + eurAmount;
      }, 0);

      // PDF oluştur
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true
      });

      // Başlık
      doc.setFillColor(68, 114, 196);
      doc.rect(14, 10, 182, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('Expense Claim Form / Kostenabrechnung', 105, 18, { align: 'center' });

      // Info kutuları
      doc.setFontSize(11);
      
      // Name
      doc.setFillColor(240, 240, 240);
      doc.rect(14, 25, 60, 8, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Name:', 16, 30);
      doc.text(fullName, 76, 30);

      // Company
      doc.setFillColor(240, 240, 240);
      doc.rect(14, 35, 60, 8, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Company/Firma:', 16, 40);
      doc.text(companyName, 76, 40);

      // Month
      doc.setFillColor(240, 240, 240);
      doc.rect(14, 45, 60, 8, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Month:', 16, 50);
      doc.text(`${currentMonth} ${currentYear}`, 76, 50);

      // Expenses tablo
      const tableData = filtered.map((expense) => {
        // Kaydedilmiş eurAmount'u kullan, yoksa anlık hesapla
        const amountEUR = expense.eurAmount 
          ? parseFloat(expense.eurAmount) 
          : convertToEUR(parseFloat(expense.tutar) || 0, expense.currency, exchangeRates);

        return [
          expense.fisno || '-',
          expense.tarih || '-',
          expense.kategori || '-',
          expense.aciklama || '-',
          `${amountEUR.toFixed(2)} €`
        ];
      });

      autoTable(doc, {
        startY: 58,
        head: [['Receipt Number', 'Date', 'Category', 'Description', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [68, 114, 196],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11
        },
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 65 },
          4: { cellWidth: 28, halign: 'right' }
        }
      });

      // Total satırı
      const finalY = doc.lastAutoTable.finalY;
      doc.setFontSize(12);
      doc.setFillColor(68, 114, 196);
      doc.rect(14, finalY + 2, 164, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL', 16, finalY + 7);
      doc.text(`${total.toFixed(2)} €`, 176, finalY + 7, { align: 'right' });

      // Bank Details
      doc.setFontSize(10);
      
      const bankY = finalY + 20;
      
      // Name
      doc.setFillColor(255, 250, 220);
      doc.rect(14, bankY, 60, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Name:', 16, bankY + 4);
      doc.text(fullName, 76, bankY + 4);

      // Date
      doc.setFillColor(255, 250, 220);
      doc.rect(14, bankY + 8, 60, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Date / Datum:', 16, bankY + 12);

      // Signature
      doc.setFillColor(255, 250, 220);
      doc.rect(14, bankY + 16, 60, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Signature / Unterschrift:', 16, bankY + 20);

      // Details
      doc.setFillColor(255, 250, 220);
      doc.rect(14, bankY + 24, 60, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('Details for bank transfer:', 16, bankY + 28);

      // IBAN
      doc.setFillColor(255, 250, 220);
      doc.rect(14, bankY + 32, 60, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('IBAN:', 16, bankY + 36);
      doc.text(iban, 76, bankY + 36);

      // BIC
      doc.setFillColor(255, 250, 220);
      doc.rect(14, bankY + 40, 60, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text('BIC:', 16, bankY + 44);
      doc.text(bic, 76, bankY + 44);

      // Eğer fişler dahil edilecekse
      if (includeReceipts) {
        const receiptsWithImages = filtered.filter(e => e.receiptPath);
        console.log('Filtered expenses:', filtered.length);
        console.log('Receipts with images:', receiptsWithImages.length);
        console.log('Receipt paths:', receiptsWithImages.map(e => ({ id: e.id, path: e.receiptPath })));
        
        if (receiptsWithImages.length > 0) {
          // Yeni sayfa ekle
          doc.addPage();
          
          // Başlık
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Receipt Images / Fiş Görselleri', 105, 15, { align: 'center' });
          
          let yPos = 25;
          let xPos = 15;
          const imgWidth = 90;
          const imgHeight = 120;
          const marginX = 10;
          const marginY = 10;
          let imagesInRow = 0;

          for (const expense of receiptsWithImages) {
            try {
              // Görseli al
              const result = await window.electronAPI.getReceipt(expense.receiptPath);
              if (result.success) {
                // Sayfada yer yoksa yeni sayfa
                if (yPos + imgHeight > 280) {
                  doc.addPage();
                  yPos = 25;
                  xPos = 15;
                  imagesInRow = 0;
                  
                  // Başlık tekrar
                  doc.setFontSize(14);
                  doc.setFont('helvetica', 'bold');
                  doc.text('Receipt Images / Fiş Görselleri', 105, 15, { align: 'center' });
                }

                // Görseli ekle
                doc.addImage(result.dataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);
                
                // Altına expense bilgisi
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(`${expense.tarih} - ${expense.aciklama}`, xPos, yPos + imgHeight + 3);
                doc.text(`${expense.tutar} ${expense.currency}`, xPos, yPos + imgHeight + 7);
                
                // Pozisyonu güncelle (2 sütun)
                imagesInRow++;
                if (imagesInRow >= 2) {
                  // Yeni satır
                  yPos += imgHeight + marginY + 10;
                  xPos = 15;
                  imagesInRow = 0;
                } else {
                  // Sağa kaydır
                  xPos += imgWidth + marginX;
                }
              }
            } catch (err) {
              console.error('Fiş görseli eklenemedi:', err);
            }
          }
        }
      }

      // PDF'i kaydet
      const fileName = `Expense_Report_${currentMonth}_${currentYear}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('PDF Export Hatası:', error);
      alert(`PDF oluşturulurken hata oluştu: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Ausgabenverfolgung</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-sm" 
            onClick={() => setShowPDFModal(true)}
            style={{ fontWeight: '600', background: '#ef4444', color: 'white', border: 'none' }}
          >
            📕 PDF Export
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleExportExcel}
            style={{ fontWeight: '600' }}
          >
            📊 Excel Export
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={onScanExpense}
            style={{ fontWeight: '600' }}
          >
            📄 Beleg Scannen
          </button>
          <button className="btn btn-accent btn-sm" onClick={onAddExpense} style={{ fontWeight: '600' }}>
            ➕ Beleg Hinzufügen
          </button>
        </div>
      </div>

      {/* KPI Kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '10px',
        marginBottom: '20px',
        padding: '12px',
        background: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)'
      }}>
        {/* Toplam */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            Gesamt
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent)' }}>
            €{kpiData.totalFiltered.toFixed(0)}
          </div>
        </div>

        {/* Yıllık Toplam */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            Jahresgesamt
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--blue)' }}>
            €{kpiData.yearTotal.toFixed(0)}
          </div>
        </div>

        {/* 30 Gün Trend */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            30-Tage-Trend
          </div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: '700', 
            color: kpiData.trend >= 0 ? 'var(--green)' : 'var(--red)' 
          }}>
            {kpiData.trend >= 0 ? '↑' : '↓'} {Math.abs(kpiData.trend).toFixed(1)}%
          </div>
        </div>

        {/* Fiş Sayısı */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            Anzahl Belege
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--purple)' }}>
            {kpiData.expenseCount}
          </div>
        </div>

        {/* En Yüksek Kategori */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            Top Kategorie
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>
            {CAT_EMOJI[kpiData.topCategory] || '📊'} {kpiData.topCategory}
          </div>
        </div>

        {/* En Yüksek Harcama */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            Max. Ausgabe
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--orange)' }}>
            €{kpiData.maxExpense.toFixed(0)}
          </div>
        </div>

        {/* Para Birimi Sayısı */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'var(--text2)', marginBottom: '4px', fontWeight: '600' }}>
            Währungen
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>
            {Array.from(kpiData.currencies).join(', ') || 'EUR'}
          </div>
        </div>
      </div>

      {/* Filtreler - Tek Satır */}
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

        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }}></div>

        <button 
          className={`filter-chip ${filter === 'tümü' ? 'active' : ''}`}
          onClick={() => setFilter('tümü')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          Alle
        </button>
        <button 
          className={`filter-chip ${filter === 'seyahat' ? 'active' : ''}`}
          onClick={() => setFilter('seyahat')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          ✈ Reise
        </button>
        <button 
          className={`filter-chip ${filter === 'konaklama' ? 'active' : ''}`}
          onClick={() => setFilter('konaklama')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          🏨 Konaklama
        </button>
        <button 
          className={`filter-chip ${filter === 'uçak' ? 'active' : ''}`}
          onClick={() => setFilter('uçak')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          ✈️ Flug
        </button>
        <button 
          className={`filter-chip ${filter === 'taksi' ? 'active' : ''}`}
          onClick={() => setFilter('taksi')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          🚕 Taksi
        </button>
        <button 
          className={`filter-chip ${filter === 'park' ? 'active' : ''}`}
          onClick={() => setFilter('park')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          🅿️ Park
        </button>
        <button 
          className={`filter-chip ${filter === 'yemek' ? 'active' : ''}`}
          onClick={() => setFilter('yemek')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          🍽 Essen
        </button>
        <button 
          className={`filter-chip ${filter === 'marketing' ? 'active' : ''}`}
          onClick={() => setFilter('marketing')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          📢 Marketing
        </button>
        <button 
          className={`filter-chip ${filter === 'kırtasiye' ? 'active' : ''}`}
          onClick={() => setFilter('kırtasiye')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          📝 Büromaterial
        </button>
        <button 
          className={`filter-chip ${filter === 'diğer' ? 'active' : ''}`}
          onClick={() => setFilter('diğer')}
          style={{ fontSize: '10px', padding: '5px 10px' }}
        >
          📦 Sonstiges
        </button>
      </div>

      <div style={{ 
        background: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: '12px', 
        overflow: 'hidden' 
      }}>
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>Beleg</th>
              <th style={{ minWidth: '85px', maxWidth: '90px' }}>Datum</th>
              <th style={{ minWidth: '100px', maxWidth: '120px' }}>Beleg Nr.</th>
              <th style={{ minWidth: '150px' }}>Beschreibung</th>
              <th style={{ minWidth: '95px', maxWidth: '100px' }}>Kategorie</th>
              <th style={{ minWidth: '85px', maxWidth: '90px' }}>Betrag</th>
              <th style={{ minWidth: '85px', maxWidth: '90px' }}>€ Betrag</th>
              <th style={{ minWidth: '160px', maxWidth: '160px' }}></th>
            </tr>
            <tr>
              <th style={{ padding: '8px 6px' }}></th>
              <th style={{ padding: '8px 6px' }}>
                <input
                  type="text"
                  placeholder="🔍"
                  value={searchTarih}
                  onChange={(e) => setSearchTarih(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </th>
              <th style={{ padding: '8px 6px' }}>
                <input
                  type="text"
                  placeholder="🔍"
                  value={searchFisno}
                  onChange={(e) => setSearchFisno(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </th>
              <th style={{ padding: '8px 6px' }}>
                <input
                  type="text"
                  placeholder="🔍 Suchen..."
                  value={searchAciklama}
                  onChange={(e) => setSearchAciklama(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </th>
              <th style={{ padding: '8px 6px' }}></th>
              <th style={{ padding: '8px 6px' }}>
                <input
                  type="text"
                  placeholder="🔍"
                  value={searchTutar}
                  onChange={(e) => setSearchTutar(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </th>
              <th style={{ padding: '8px 6px' }}></th>
              <th style={{ padding: '8px 6px' }}>
                {(searchTarih || searchFisno || searchAciklama || searchTutar) && (
                  <button
                    onClick={() => {
                      setSearchTarih('');
                      setSearchFisno('');
                      setSearchAciklama('');
                      setSearchTutar('');
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '9px',
                      border: '1px solid rgba(255,77,77,0.3)',
                      borderRadius: '4px',
                      background: 'rgba(255,77,77,0.1)',
                      color: 'var(--red)',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    ✕ Temizle
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td 
                  colSpan="8" 
                  style={{ 
                    textAlign: 'center', 
                    color: 'var(--text2)', 
                    padding: '50px', 
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {expenses.length === 0 
                    ? 'Noch keine Belege vorhanden — rechts oben Beleg hinzufügen 🧾' 
                    : 'Keine Belege zu diesen Filtern gefunden 🔍'}
                </td>
              </tr>
            ) : (
              filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ minWidth: '50px', maxWidth: '50px' }}>
                    <div className="receipt-thumb" title="Fiş görüntüle">
                      {e.hasReceipt ? '🧾' : '📄'}
                    </div>
                  </td>
                  <td style={{ 
                    fontFamily: "'JetBrains Mono', monospace", 
                    fontSize: '10px', 
                    color: 'var(--text2)',
                    lineHeight: '1.3',
                    minWidth: '85px',
                    maxWidth: '90px'
                  }}>
                    {e.tarih}
                  </td>
                  <td style={{ 
                    fontFamily: "'JetBrains Mono', monospace", 
                    fontSize: '10px', 
                    color: 'var(--text3)',
                    fontWeight: '500',
                    minWidth: '100px',
                    maxWidth: '120px'
                  }}>
                    {e.fisno}
                  </td>
                  <td style={{ minWidth: '150px' }}>
                    <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.aciklama}
                    </div>
                  </td>
                  <td style={{ minWidth: '95px', maxWidth: '100px' }}>
                    <span className={`cat-badge ${CAT_CLASS[e.kategori]}`} style={{ fontSize: '10px', fontWeight: '600' }}>
                      {CAT_EMOJI[e.kategori]} {e.kategori}
                    </span>
                  </td>
                  <td className="amount-cell" style={{ fontSize: '11px', whiteSpace: 'nowrap', minWidth: '85px', maxWidth: '90px' }}>
                    <span className="currency-flag">{e.currency}</span>
                    {parseFloat(e.tutar).toFixed(2)}
                  </td>
                  <td className="amount-cell" style={{ fontSize: '11px', whiteSpace: 'nowrap', minWidth: '85px', maxWidth: '90px', color: '#10b981', fontWeight: '600' }}>
                    €{e.eurAmount ? parseFloat(e.eurAmount).toFixed(2) : convertToEUR(parseFloat(e.tutar), e.currency, exchangeRates).toFixed(2)}
                  </td>
                  <td style={{ minWidth: '160px', maxWidth: '160px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => onEdit(e)}
                        style={{ 
                          color: 'var(--accent)', 
                          borderColor: 'rgba(99,102,241,0.3)' 
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => onDelete(e.id)}
                        style={{ 
                          color: 'var(--red)', 
                          borderColor: 'rgba(255,77,77,0.2)' 
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PDF Export Modal */}
      {showPDFModal && (
        <div 
          className="modal-overlay" 
          onClick={(e) => e.target.className === 'modal-overlay' && setShowPDFModal(false)}
        >
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>📕 PDF Export</h3>
              <button className="modal-close" onClick={() => setShowPDFModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <p style={{ marginBottom: '20px', color: 'var(--text2)' }}>
                Möchten Sie Belegbilder in den PDF-Bericht aufnehmen?
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-outline"
                  onClick={() => {
                    setShowPDFModal(false);
                    handleExportPDF(false);
                  }}
                >
                  Nein, nur Bericht
                </button>
                <button 
                  className="btn btn-accent"
                  onClick={() => {
                    setShowPDFModal(false);
                    handleExportPDF(true);
                  }}
                >
                  Ja, mit Belegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseList;
