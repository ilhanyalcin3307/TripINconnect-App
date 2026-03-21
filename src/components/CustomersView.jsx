import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

function CustomersView({ reservations = [], exchangeRates = { EUR: 1 } }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('cards');
  const [activeTagFilter, setActiveTagFilter] = useState([]); // seçili etiket filtreleri
  // Müşteri profil verileri (localStorage'da saklanır)
  const [customerProfiles, setCustomerProfiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tripinconnect_customerProfiles') || '{}'); }
    catch { return {}; }
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null); // modal için seçili müşteri
  const [editProfile, setEditProfile] = useState(null);           // modal içindeki taslak

  // Etiket tanımları
  const tagDefinitions = [
    { name: 'VIP', emoji: '👑', color: '#f59e0b' },
    { name: 'Premium', emoji: '⭐', color: '#8b5cf6' },
    { name: 'Budget', emoji: '💰', color: '#10b981' },
    { name: 'Standart', emoji: '📌', color: '#3b82f6' },
    { name: 'Stammkunde', emoji: '🔄', color: '#ef4444' },
    { name: 'Blacklist', emoji: '⛔', color: '#991b1b' }
  ];

  // Kart üzerinde direkt etiket toggle (modal dışı)
  const toggleTag = (customerName, tagName) => {
    setCustomerProfiles(prev => {
      const profile = prev[customerName] || {};
      const currentTags = profile.tags || [];
      const newTags = currentTags.includes(tagName)
        ? currentTags.filter(t => t !== tagName)
        : [...currentTags, tagName];
      const updated = { ...prev, [customerName]: { ...profile, tags: newTags } };
      localStorage.setItem('tripinconnect_customerProfiles', JSON.stringify(updated));
      return updated;
    });
  };

  // Modal açma
  const openCustomer = (customer) => {
    const saved = customerProfiles[customer.name] || {};
    setEditProfile({
      geburtsdatum: saved.geburtsdatum || '',
      telefon:      saved.telefon      || '',
      email:        saved.email        || '',
      adresse:      saved.adresse      || '',
      passnr:       saved.passnr       || '',
      passexp:      saved.passexp      || '',
      notizen:      saved.notizen      || '',
      tags:         saved.tags         || [],
    });
    setSelectedCustomer(customer);
  };

  // Modal kaydet
  const saveProfile = () => {
    if (!selectedCustomer) return;
    setCustomerProfiles(prev => {
      const updated = { ...prev, [selectedCustomer.name]: { ...editProfile } };
      localStorage.setItem('tripinconnect_customerProfiles', JSON.stringify(updated));
      return updated;
    });
    setSelectedCustomer(null);
  };

  // Müşteri verilerini hazırla
  const customersData = useMemo(() => {
    // Name'e göre grupla
    const customerMap = {};

    reservations.forEach((reservation) => {
      const customerName = reservation.name?.trim();
      if (!customerName) return;

      if (!customerMap[customerName]) {
        customerMap[customerName] = {
          name: customerName,
          reservations: [],
          totalReservations: 0,
          totalRevenue: 0,
          firstReservation: null,
          lastReservation: null,
          zielCount: {},
          monthCount: {},
          priceSum: 0,
          priceCount: 0,
        };
      }

      customerMap[customerName].reservations.push(reservation);
      customerMap[customerName].totalReservations += 1;

      // Top Ziel
      const ziel = reservation.ziel?.trim();
      if (ziel) customerMap[customerName].zielCount[ziel] = (customerMap[customerName].zielCount[ziel] || 0) + 1;

      // Top Monat
      const abreiseDt = reservation.abreise ? new Date(reservation.abreise) : null;
      if (abreiseDt && !isNaN(abreiseDt)) {
        const mo = abreiseDt.getMonth(); // 0-11
        customerMap[customerName].monthCount[mo] = (customerMap[customerName].monthCount[mo] || 0) + 1;
      }

      // Ø Budget (reisepreis)
      const rp = parseFloat(reservation.reisepreis || reservation.netto);
      if (rp > 0) { customerMap[customerName].priceSum += rp; customerMap[customerName].priceCount += 1; }

      // Revenue hesapla (netto değeri EUR'a çevir)
      const netto = parseFloat(reservation.netto) || 0;
      const currency = reservation.currency || 'EUR';
      const rate = exchangeRates[currency] || 1;
      const nettoInEUR = netto * rate;
      customerMap[customerName].totalRevenue += nettoInEUR;

      // Tarih bilgilerini güncelle
      const resDate = new Date(reservation.abreise || reservation.buchung);
      if (!customerMap[customerName].firstReservation || resDate < new Date(customerMap[customerName].firstReservation)) {
        customerMap[customerName].firstReservation = reservation.abreise || reservation.buchung;
      }
      if (!customerMap[customerName].lastReservation || resDate > new Date(customerMap[customerName].lastReservation)) {
        customerMap[customerName].lastReservation = reservation.abreise || reservation.buchung;
      }
    });

    const MONTHS_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

    return Object.values(customerMap).map(c => {
      // Top Ziel
      const topZiel = Object.entries(c.zielCount).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
      // Top Monat
      const topMonthIdx = Object.entries(c.monthCount).sort((a,b) => b[1]-a[1])[0]?.[0];
      const topMonth = topMonthIdx != null ? MONTHS_DE[parseInt(topMonthIdx)] : null;
      // Ø Budget
      const avgBudget = c.priceCount > 0 ? Math.round(c.priceSum / c.priceCount) : null;
      return { ...c, topZiel, topMonth, avgBudget };
    });
  }, [reservations, exchangeRates]);

  // Arama ve sıralama
  const filteredAndSorted = useMemo(() => {
    let result = [...customersData];

    // Arama filtresi
    if (searchTerm) {
      result = result.filter((customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Etiket filtresi
    if (activeTagFilter.length > 0) {
      result = result.filter((customer) =>
        activeTagFilter.every(t => (customerProfiles[customer.name]?.tags || []).includes(t))
      );
    }

    // Sıralama
    result.sort((a, b) => {
      let compareA, compareB;

      switch (sortBy) {
        case 'name':
          compareA = a.name.toLowerCase();
          compareB = b.name.toLowerCase();
          break;
        case 'totalReservations':
          compareA = a.totalReservations;
          compareB = b.totalReservations;
          break;
        case 'totalRevenue':
          compareA = a.totalRevenue;
          compareB = b.totalRevenue;
          break;
        case 'lastReservation':
          compareA = new Date(a.lastReservation || 0);
          compareB = new Date(b.lastReservation || 0);
          break;
        default:
          compareA = a.name.toLowerCase();
          compareB = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return compareA > compareB ? 1 : -1;
      } else {
        return compareA < compareB ? 1 : -1;
      }
    });

    return result;
  }, [customersData, searchTerm, sortBy, sortOrder, activeTagFilter, customerProfiles]);

  // Tarih formatlama
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };

  // Excel Export
  const handleExportExcel = async () => {
    if (filteredAndSorted.length === 0) {
      alert('Keine Kunden zum Exportieren gefunden!');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Müşteriler');

    // Başlıklar
    worksheet.columns = [
      { header: 'Kundenname', key: 'name', width: 30 },
      { header: 'Gesamt Reservierungen', key: 'totalReservations', width: 20 },
      { header: 'Gesamt Umsatz (EUR)', key: 'totalRevenue', width: 20 },
      { header: 'Erste Reservierung', key: 'firstReservation', width: 18 },
      { header: 'Letzte Reservierung', key: 'lastReservation', width: 18 },
    ];

    // Başlık stili
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Veri satırları
    filteredAndSorted.forEach((customer) => {
      worksheet.addRow({
        name: customer.name,
        totalReservations: customer.totalReservations,
        totalRevenue: customer.totalRevenue.toFixed(2),
        firstReservation: formatDate(customer.firstReservation),
        lastReservation: formatDate(customer.lastReservation),
      });
    });

    // Dosyayı kaydet
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `Musteriler_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // KPI hesaplamaları
  const kpiData = useMemo(() => {
    return {
      totalCustomers: customersData.length,
      totalReservations: customersData.reduce((sum, c) => sum + c.totalReservations, 0),
      totalRevenue: customersData.reduce((sum, c) => sum + c.totalRevenue, 0),
      avgReservationsPerCustomer: customersData.length > 0 
        ? (customersData.reduce((sum, c) => sum + c.totalReservations, 0) / customersData.length).toFixed(1)
        : 0,
      avgRevenuePerCustomer: customersData.length > 0
        ? (customersData.reduce((sum, c) => sum + c.totalRevenue, 0) / customersData.length).toFixed(2)
        : 0,
    };
  }, [customersData]);

  return (
    <div>
      {/* Başlık ve Aksiyonlar */}
      <div className="section-header">
        <div className="section-title">Kunden Liste</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-sm"
            onClick={handleExportExcel}
            style={{ fontWeight: '600', background: '#10b981', color: 'white', border: 'none' }}
          >
            📈 Excel Exportieren
          </button>
        </div>
      </div>

      {/* KPI Kartları */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="kpi-card">
          <div className="kpi-label">Gesamt Kunden</div>
          <div className="kpi-value">{kpiData.totalCustomers}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Gesamt Reservierungen</div>
          <div className="kpi-value">{kpiData.totalReservations}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Gesamt Umsatz</div>
          <div className="kpi-value">{kpiData.totalRevenue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Durchschn. Reservierungen/Kunde</div>
          <div className="kpi-value">{kpiData.avgReservationsPerCustomer}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Durchschn. Umsatz/Kunde</div>
          <div className="kpi-value">{parseFloat(kpiData.avgRevenuePerCustomer).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</div>
        </div>
      </div>

      {/* Arama ve Filtreler */}
      <div style={{
        background: 'var(--surface)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr auto auto auto',
          gap: '12px',
          alignItems: 'center'
        }}>
          {/* Arama */}
          <div>
            <input
              type="text"
              placeholder="🔍 Kunde suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--surface2)',
                color: 'var(--text)'
              }}
            />
          </div>

          {/* Sıralama */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--surface2)',
                color: 'var(--text)'
              }}
            >
              <option value="name">Nach Name</option>
              <option value="totalReservations">Anzahl Reservierungen</option>
              <option value="totalRevenue">Nach Umsatz</option>
              <option value="lastReservation">Letzte Reservierung</option>
            </select>
          </div>

          {/* Sıralama Yönü */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '10px 16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--surface2)',
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--text)'
            }}
            title={sortOrder === 'asc' ? 'Artan' : 'Azalan'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          {/* Görünüm Modu */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '10px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: viewMode === 'cards' ? '#3b82f6' : 'var(--surface2)',
                color: viewMode === 'cards' ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '18px'
              }}
              title="Kart Görünümü"
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '10px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: viewMode === 'list' ? '#3b82f6' : 'var(--surface2)',
                color: viewMode === 'list' ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '18px'
              }}
              title="Liste Görünümü"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Sonuç Sayısı + Etiket Filtreleri */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: 'var(--text2)', fontSize: '12px', marginRight: '4px' }}>
            {filteredAndSorted.length} Kunden
          </span>
          {tagDefinitions.map(tag => {
            const isActive = activeTagFilter.includes(tag.name);
            return (
              <button
                key={tag.name}
                onClick={() => setActiveTagFilter(prev =>
                  prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name]
                )}
                title={tag.name}
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  border: isActive ? `2px solid ${tag.color}` : '1px solid var(--border)',
                  background: isActive ? tag.color : 'var(--surface2)',
                  color: isActive ? 'white' : 'var(--text2)',
                  fontSize: '11px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  opacity: isActive ? 1 : 0.7
                }}
              >
                <span>{tag.emoji}</span>
                <span>{tag.name}</span>
              </button>
            );
          })}
          {activeTagFilter.length > 0 && (
            <button
              onClick={() => setActiveTagFilter([])}
              style={{
                padding: '3px 10px',
                borderRadius: '20px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text3)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              ✕ Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Müşteri Listesi - Kart Görünümü */}
      {viewMode === 'cards' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '20px',
          gridAutoRows: '1fr'
        }}>
          {filteredAndSorted.map((customer, index) => (
            <div
              key={index}
              onClick={() => openCustomer(customer)}
              style={{
                background: 'var(--surface)',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                minHeight: '220px',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
                e.currentTarget.style.background = 'var(--surface2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              {/* Kundenname */}
              <div style={{
                fontSize: '15px',
                fontWeight: '700',
                color: 'var(--text)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '12px'
              }}>
                👤 {customer.name}
              </div>

              {/* İstatistikler */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Reservierungen:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#3b82f6',
                    fontSize: '14px'
                  }}>
                    {customer.totalReservations}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Gesamtumsatz:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#10b981',
                    fontSize: '14px'
                  }}>
                    {customer.totalRevenue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Erste Reservierung:</span>
                  <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                    {formatDate(customer.firstReservation)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Letzte Reservierung:</span>
                  <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                    {formatDate(customer.lastReservation)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Durchschn. Reservierungswert:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#8b5cf6',
                    fontSize: '14px'
                  }}>
                    {(customer.totalRevenue / customer.totalReservations).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                  </span>
                </div>
              </div>

              {/* Alt Çizgi - Etiketler için */}
              <div style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'nowrap', 
                  gap: '4px',
                  justifyContent: 'center'
                }}>
                  {tagDefinitions.map((tag) => {
                    const isSelected = (customerProfiles[customer.name]?.tags || []).includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        onClick={(e) => { e.stopPropagation(); toggleTag(customer.name, tag.name); }}
                        title={tag.name}
                        style={{
                          padding: '3px 6px',
                          borderRadius: '5px',
                          border: isSelected ? `2px solid ${tag.color}` : '1px solid var(--border)',
                          background: isSelected ? tag.color : 'var(--surface2)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: '13px',
                          lineHeight: 1,
                          opacity: isSelected ? 1 : 0.45,
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.opacity = '0.75'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.opacity = '0.45'; }}
                      >
                        {tag.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Otomatik hesaplanan bilgiler */}
              {(customer.avgBudget || customer.topZiel || customer.topMonth) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px', justifyContent: 'center' }}>
                  {customer.avgBudget && (
                    <span title="Durchschn. Reisepreis" style={{
                      padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600',
                      background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)'
                    }}>
                      Ø {customer.avgBudget.toLocaleString('de-DE')} €
                    </span>
                  )}
                  {customer.topZiel && (
                    <span title="Meistbesuchtes Reiseziel" style={{
                      padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600',
                      background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)',
                      maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      📍 {customer.topZiel}
                    </span>
                  )}
                  {customer.topMonth && (
                    <span title="Beliebtester Reisemonat" style={{
                      padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600',
                      background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)'
                    }}>
                      🗓 {customer.topMonth}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Müşteri Listesi - Liste Görünümü */}
      {viewMode === 'list' && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'left', 
                  fontWeight: '600',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  Kundenname
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  fontWeight: '600',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  Anzahl Reservierungen
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'right', 
                  fontWeight: '600',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  Gesamtumsatz (€)
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'right', 
                  fontWeight: '600',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  Durchschn. Reservierung (€)
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  fontWeight: '600',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  Erste Reservierung
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  fontWeight: '600',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  Letzte Reservierung
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((customer, index) => (
                <tr 
                  key={index}
                  onClick={() => openCustomer(customer)}
                  style={{
                    background: index % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'}
                >
                  <td style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border)',
                    fontWeight: '600',
                    color: 'var(--text)',
                    fontSize: '13px'
                  }}>
                    👤 {customer.name}
                  </td>
                  <td style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                    color: '#3b82f6',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}>
                    {customer.totalReservations}
                  </td>
                  <td style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'right',
                    color: '#10b981',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}>
                    {customer.totalRevenue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'right',
                    color: '#8b5cf6',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}>
                    {(customer.totalRevenue / customer.totalReservations).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                    color: 'var(--text2)',
                    fontSize: '12px'
                  }}>
                    {formatDate(customer.firstReservation)}
                  </td>
                  <td style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                    color: 'var(--text2)',
                    fontSize: '12px'
                  }}>
                    {formatDate(customer.lastReservation)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Müşteri Bulunamadı */}
      {filteredAndSorted.length === 0 && (
        <div style={{
          background: 'var(--surface)',
          padding: '60px 20px',
          borderRadius: '12px',
          textAlign: 'center',
          color: 'var(--text2)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>Keine Kunden gefunden</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            Versuchen Sie, Ihre Suchkriterien zu ändern
          </div>
        </div>
      )}

      {/* Müşteri Detay Modalı */}
      {selectedCustomer && editProfile && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target.className === 'modal-overlay' && setSelectedCustomer(null)}
        >
          <div className="modal" style={{ maxWidth: '720px', width: '96vw' }}>
            <div className="modal-header">
              <div className="modal-title">👤 {selectedCustomer.name}</div>
              <button className="modal-close" onClick={() => setSelectedCustomer(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>

              {/* Temel Bilgiler */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  📋 Grundinformationen
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Geburtsdatum</label>
                    <input
                      className="form-input"
                      type="date"
                      value={editProfile.geburtsdatum}
                      onChange={e => setEditProfile(p => ({ ...p, geburtsdatum: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Telefon</span>
                      {editProfile.telefon && (
                        <a
                          href={`https://wa.me/${editProfile.telefon.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp öffnen"
                          style={{ lineHeight: 1, textDecoration: 'none' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      )}
                    </label>
                    <input
                      className="form-input"
                      type="tel"
                      value={editProfile.telefon}
                      onChange={e => setEditProfile(p => ({ ...p, telefon: e.target.value }))}
                      placeholder="+49 ..."
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>E-Mail</span>
                      {editProfile.email && (
                        <a
                          href={`mailto:${editProfile.email}`}
                          title="E-Mail senden"
                          style={{ lineHeight: 1, textDecoration: 'none' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                          </svg>
                        </a>
                      )}
                    </label>
                    <input
                      className="form-input"
                      type="email"
                      value={editProfile.email}
                      onChange={e => setEditProfile(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Adresse</label>
                    <input
                      className="form-input"
                      type="text"
                      value={editProfile.adresse}
                      onChange={e => setEditProfile(p => ({ ...p, adresse: e.target.value }))}
                      placeholder="Straße, PLZ, Stadt"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Reisepass-Nr.</label>
                    <input
                      className="form-input"
                      type="text"
                      value={editProfile.passnr}
                      onChange={e => setEditProfile(p => ({ ...p, passnr: e.target.value }))}
                      placeholder="C01234567"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Pass gültig bis</label>
                    <input
                      className="form-input"
                      type="date"
                      value={editProfile.passexp}
                      onChange={e => setEditProfile(p => ({ ...p, passexp: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Notlar */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  📝 Notizen
                </div>
                <textarea
                  className="form-input"
                  value={editProfile.notizen}
                  onChange={e => setEditProfile(p => ({ ...p, notizen: e.target.value }))}
                  placeholder="Notizen zum Kunden..."
                  style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Etiketler */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  🏷️ Etiketten
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tagDefinitions.map(tag => {
                    const isSelected = (editProfile.tags || []).includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        onClick={() => setEditProfile(p => {
                          const tags = p.tags || [];
                          return { ...p, tags: isSelected ? tags.filter(t => t !== tag.name) : [...tags, tag.name] };
                        })}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${tag.color}` : '1px solid var(--border)',
                          background: isSelected ? tag.color : 'var(--surface2)',
                          color: isSelected ? 'white' : 'var(--text2)',
                          fontSize: '12px',
                          fontWeight: isSelected ? '700' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <span>{tag.emoji}</span>
                        <span>{tag.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rezervasyonlar */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  📅 Reservierungen ({selectedCustomer.reservations.length})
                </div>
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left',   color: 'var(--text2)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>VG-Nr.</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left',   color: 'var(--text2)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Reiseziel</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text2)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Abreise</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text2)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Rückreise</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: 'var(--text2)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Netto (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.reservations
                        .slice()
                        .sort((a, b) => new Date(b.abreise || 0) - new Date(a.abreise || 0))
                        .map((res, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface2)' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--text3)', fontFamily: 'monospace', fontSize: '11px' }}>{res.vgNr || '—'}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{res.ziel || '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text)' }}>{formatDate(res.abreise)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text)' }}>{formatDate(res.ruckreise)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                              {parseFloat(res.netto || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Kaydet / İptal */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                <button className="btn btn-accent" onClick={saveProfile} style={{ flex: 1 }}>
                  💾 Speichern
                </button>
                <button className="btn btn-outline" onClick={() => setSelectedCustomer(null)}>
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomersView;
