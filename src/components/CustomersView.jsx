import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

function CustomersView({ reservations = [], exchangeRates = { EUR: 1 } }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, totalReservations, totalRevenue, lastReservation
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('cards'); // cards or list
  const [customerTags, setCustomerTags] = useState({}); // { "Müşteri Adı": ["VIP", "Premium"], ... }

  // Etiket tanımları
  const tagDefinitions = [
    { name: 'VIP', emoji: '👑', color: '#f59e0b' },
    { name: 'Premium', emoji: '⭐', color: '#8b5cf6' },
    { name: 'Budget', emoji: '💰', color: '#10b981' },
    { name: 'Standart', emoji: '📌', color: '#3b82f6' },
    { name: 'Stammkunde', emoji: '🔄', color: '#ef4444' },
    { name: 'Blacklist', emoji: '⛔', color: '#991b1b' }
  ];

  // Etiket toggle fonksiyonu
  const toggleTag = (customerName, tagName) => {
    setCustomerTags(prev => {
      const currentTags = prev[customerName] || [];
      const newTags = currentTags.includes(tagName)
        ? currentTags.filter(t => t !== tagName)
        : [...currentTags, tagName];
      return { ...prev, [customerName]: newTags };
    });
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
        };
      }

      customerMap[customerName].reservations.push(reservation);
      customerMap[customerName].totalReservations += 1;

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

    return Object.values(customerMap);
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
  }, [customersData, searchTerm, sortBy, sortOrder]);

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

        {/* Sonuç Sayısı */}
        <div style={{ marginTop: '12px', color: 'var(--text2)', fontSize: '12px' }}>
          {filteredAndSorted.length} Kunden werden angezeigt
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
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px',
                  justifyContent: 'center'
                }}>
                  {tagDefinitions.map((tag) => {
                    const isSelected = (customerTags[customer.name] || []).includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        onClick={() => toggleTag(customer.name, tag.name)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: isSelected ? `2px solid ${tag.color}` : '1px solid var(--border)',
                          background: isSelected ? tag.color : 'var(--surface2)',
                          color: isSelected ? 'white' : 'var(--text2)',
                          fontSize: '10px',
                          fontWeight: isSelected ? '700' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          opacity: isSelected ? 1 : 0.6
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.opacity = '0.8';
                            e.currentTarget.style.borderColor = tag.color;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.opacity = '0.6';
                            e.currentTarget.style.borderColor = 'var(--border)';
                          }
                        }}
                      >
                        <span>{tag.emoji}</span>
                        <span>{tag.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                  style={{
                    background: index % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                    transition: 'background 0.2s'
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
    </div>
  );
}

export default CustomersView;
