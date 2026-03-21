import React, { useMemo, useState } from 'react';
import { calcProvisionDates } from '../lib/provisionUtils';

// Maliyet kalemlerinin renkleri
const COST_COLORS = {
  katilim: '#10b981',
  standYer: '#3b82f6',
  standYapim: '#8b5cf6',
  diger: '#f59e0b'
};

const COST_LABELS = {
  katilim: 'Katılım Ücreti',
  standYer: 'Stand Yer',
  standYapim: 'Stand Yapım',
  diger: 'Diğer'
};

const COST_EMOJI = {
  katilim: '🎟️',
  standYer: '📍',
  standYapim: '🏗️',
  diger: '💼'
};


const WEEKDAYS_SHORT = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
};

function Dashboard({ marketingEvents = [], reservations = [], exchangeRates = { EUR: 1, USD: 0.92, GBP: 1.17, TRY: 0.029 }, agenturData = {} }) {
  // Takvim state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalDay, setSelectedCalDay] = useState(null);
  
  // KPI hesaplamaları
  const kpiData = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // ====== REZERVASYON VERİLERİ ======
    // Bu ay rezervasyonları (buchung tarihine göre)
    const monthReservations = reservations.filter(r => {
      const d = new Date(r.buchung || r.abreise);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    // Bu yıl rezervasyonları (buchung tarihine göre)
    const yearReservations = reservations.filter(r => {
      const d = new Date(r.buchung || r.abreise);
      return d.getFullYear() === thisYear;
    });

    // Rezervasyon cirosunu hesapla (netto değeri EUR'a çevir)
    const calculateReservationRevenue = (reservation) => {
      const netto = parseFloat(reservation.netto) || 0;
      const currency = reservation.currency || 'EUR';
      const rate = exchangeRates[currency] || 1;
      return netto * rate;
    };

    // Bu ay rezervasyon cirosu
    const monthReservationRevenue = monthReservations.reduce((s, r) => s + calculateReservationRevenue(r), 0);
    
    // Yıllık rezervasyon cirosu
    const yearReservationRevenue = yearReservations.reduce((s, r) => s + calculateReservationRevenue(r), 0);
    
    // Tüm zamanların toplam rezervasyon cirosu
    const totalReservationRevenue = reservations.reduce((s, r) => s + calculateReservationRevenue(r), 0);
    
    // Ortalama rezervasyon değeri
    const avgReservationValue = monthReservations.length > 0 ? monthReservationRevenue / monthReservations.length : 0;

    // Provizyon hakediş hesaplama (reisepreis * provisionRate%)
    const calculateProvision = (reservation) => {
      const preis = parseFloat(reservation.reisepreis) || 0;
      const provStr = String(reservation.provisionRate || '').replace('%', '').trim();
      const provRate = parseFloat(provStr) || 0;
      const provisionAmount = preis * (provRate / 100);
      
      // EUR'ya çevir
      const currency = reservation.currency || 'EUR';
      const rate = exchangeRates[currency] || 1;
      return provisionAmount * rate;
    };

    // Tüm zamanların toplam provizyon hakedişi
    const totalProvision = reservations.reduce((s, r) => s + calculateProvision(r), 0);

    // Bu yılın provizyon hakedişi
    const yearProvision = yearReservations.reduce((s, r) => s + calculateProvision(r), 0);

    // Bu ayın provizyon hakedişi (buchung tarihine göre)
    const monthProvision = monthReservations.reduce((s, r) => s + calculateProvision(r), 0);

    // Bu ay ödeme tarihi düşen provizyon (tarih bazlı DKI/RBI hesabı)
    const startOfMonth = new Date(thisYear, thisMonth, 1);
    const endOfMonth = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);
    let monthProvisionDue = 0;
    reservations.forEach(r => {
      if (r.status === 'iptal') return;
      const vaCode = (r.gebuchteVA || '').trim().toUpperCase();
      const entry = agenturData[vaCode] ||
        Object.entries(agenturData).find(([k]) => k.toUpperCase() === vaCode)?.[1];
      if (!entry) return;
      const result = calcProvisionDates(r, entry);
      if (!result) return;
      result.payments.forEach(p => {
        if (p.date >= startOfMonth && p.date <= endOfMonth) {
          monthProvisionDue += p.amount;
        }
      });
    });

    // Geçen dönem karşılaştırmaları için hesaplamalar
    // Geçen ay
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const lastMonthReservations = reservations.filter(r => {
      const d = new Date(r.buchung || r.abreise);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const lastMonthReservationRevenue = lastMonthReservations.reduce((s, r) => s + calculateReservationRevenue(r), 0);
    const lastMonthProvision = lastMonthReservations.reduce((s, r) => s + calculateProvision(r), 0);
    
    // Geçen yıl
    const lastYear = thisYear - 1;
    const lastYearReservations = reservations.filter(r => {
      const d = new Date(r.buchung || r.abreise);
      return d.getFullYear() === lastYear;
    });
    const lastYearReservationRevenue = lastYearReservations.reduce((s, r) => s + calculateReservationRevenue(r), 0);
    const lastYearProvision = lastYearReservations.reduce((s, r) => s + calculateProvision(r), 0);
    
    // Yüzde değişim hesaplamaları (Ciro)
    const monthChangePercent = lastMonthReservationRevenue > 0 
      ? ((monthReservationRevenue - lastMonthReservationRevenue) / lastMonthReservationRevenue) * 100 
      : 0;
    const yearChangePercent = lastYearReservationRevenue > 0 
      ? ((yearReservationRevenue - lastYearReservationRevenue) / lastYearReservationRevenue) * 100 
      : 0;
    
    // Yüzde değişim hesaplamaları (Provizyon)
    const monthProvisionChangePercent = lastMonthProvision > 0 
      ? ((monthProvision - lastMonthProvision) / lastMonthProvision) * 100 
      : 0;
    const yearProvisionChangePercent = lastYearProvision > 0 
      ? ((yearProvision - lastYearProvision) / lastYearProvision) * 100 
      : 0;

    // Toplam müşteri sayısı (benzersiz isimler)
    const uniqueCustomers = new Set(reservations.map(r => r.name?.trim()).filter(Boolean)).size;

    // Status'lara göre rezervasyon dağılımı (bu ay)
    const statusCounts = {
      onaylandi: monthReservations.filter(r => r.status === 'onaylandi').length,
      beklemede: monthReservations.filter(r => r.status === 'beklemede').length,
      iptal: monthReservations.filter(r => r.status === 'iptal').length
    };

    return {
      // Rezervasyon KPI'ları
      monthReservationCount: monthReservations.length,
      yearReservationCount: yearReservations.length,
      monthReservationRevenue,
      yearReservationRevenue,
      totalReservationRevenue,
      totalReservationCount: reservations.length,
      totalProvision,
      yearProvision,
      monthProvision,
      monthProvisionDue,
      avgReservationValue,
      uniqueCustomers,
      statusCounts,
      monthChangePercent,
      yearChangePercent,
      monthProvisionChangePercent,
      yearProvisionChangePercent
    };
  }, [reservations, exchangeRates, agenturData]);

  // Yaklaşan tatiller - İlk 10 rezervasyon
  const upcomingReservations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Gelecekteki rezervasyonları filtrele ve sırala
    const upcoming = reservations
      .filter(r => {
        const abreiseDate = new Date(r.abreise || r.buchung);
        return abreiseDate >= today && r.status !== 'iptal';
      })
      .sort((a, b) => {
        const dateA = new Date(a.abreise || a.buchung);
        const dateB = new Date(b.abreise || b.buchung);
        return dateA - dateB;
      })
      .slice(0, 10);
    
    return upcoming;
  }, [reservations]);

  // Şu an tatilde olan müşteriler - Abreise ile Rückreise arası bugün olan
  const currentlyOnVacation = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Tatilde olan rezervasyonları filtrele
    const onVacation = reservations
      .filter(r => {
        if (!r.abreise || !r.ruckreise || r.status === 'iptal') return false;
        
        const abreiseDate = new Date(r.abreise);
        const ruckreiseDate = new Date(r.ruckreise);
        abreiseDate.setHours(0, 0, 0, 0);
        ruckreiseDate.setHours(0, 0, 0, 0);
        
        // Bugün abreise ile rückreise arasında mı?
        return abreiseDate <= today && ruckreiseDate >= today;
      })
      .sort((a, b) => {
        // Rückreise tarihine göre sırala (önce dönenler)
        const dateA = new Date(a.ruckreise);
        const dateB = new Date(b.ruckreise);
        return dateA - dateB;
      })
      .slice(0, 10);
    
    return onVacation;
  }, [reservations]);

  // Top 10 Lokasyonlar (en çok rezervasyon olan destinasyonlar)
  const topDestinations = useMemo(() => {
    const destinationMap = {};
    
    // Her destinasyon için rezervasyon sayısını ve toplam geliri hesapla
    reservations.forEach(reservation => {
      const ziel = reservation.ziel || 'Bilinmiyor';
      if (!destinationMap[ziel]) {
        destinationMap[ziel] = {
          name: ziel,
          count: 0,
          revenue: 0
        };
      }
      destinationMap[ziel].count++;
      
      // Geliri hesapla (reisepreis'i EUR'ya çevir)
      let revenue = parseFloat(reservation.reisepreis) || 0;
      const currency = reservation.currency || 'EUR';
      
      if (currency === 'TRY') {
        revenue = revenue / 35;
      } else if (currency === 'USD') {
        revenue = revenue * 0.92;
      } else if (currency === 'GBP') {
        revenue = revenue * 1.17;
      }
      // EUR ise olduğu gibi al
      
      destinationMap[ziel].revenue += revenue;
    });
    
    // Array'e çevir ve rezervasyon sayısına göre sırala
    return Object.values(destinationMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
  }, [reservations]);

  // Top 5 Veranstalter (en çok rezervasyon yapan)
  const topVeranstalter = useMemo(() => {
    const veranstalterMap = {};
    
    reservations.forEach(reservation => {
      const va = reservation.gebuchteVA || 'Bilinmiyor';
      if (!veranstalterMap[va]) {
        veranstalterMap[va] = {
          name: va,
          count: 0
        };
      }
      veranstalterMap[va].count++;
    });
    
    return Object.values(veranstalterMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  }, [reservations]);

  // Takvim helper fonksiyonları
  const parseDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  // Ödeme tarihlerini gün bazında grupla (Anz / Rest / Prov)
  const zpByDate = useMemo(() => {
    const map = {};
    const fmtKey = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    reservations.forEach(r => {
      if (!r.gebuchteVA) return;
      const code = r.gebuchteVA.trim().toUpperCase();
      const ag = agenturData[code] ||
        Object.entries(agenturData).find(([k]) => k.toUpperCase() === code)?.[1];
      const result = calcProvisionDates(r, ag || {});
      if (!result || result.payments.length === 0) return;
      const amount = result.payments.reduce((s, p) => s + p.amount, 0);
      if (amount <= 0) return;
      const p0 = result.payments[0];
      const p1 = result.payments[1] || null;
      // Anzahlung
      const anzKey = fmtKey(p0.date);
      if (!map[anzKey]) map[anzKey] = { anz: 0, rest: 0, prov: 0 };
      map[anzKey].anz += p0.amount;
      // Restzahlung
      if (p1) {
        const restKey = fmtKey(p1.date);
        if (!map[restKey]) map[restKey] = { anz: 0, rest: 0, prov: 0 };
        map[restKey].rest += p1.amount;
      }
      // Provision
      const provKey = fmtKey(p1 ? p1.date : p0.date);
      if (!map[provKey]) map[provKey] = { anz: 0, rest: 0, prov: 0 };
      map[provKey].prov += amount;
    });
    return map;
  }, [reservations, agenturData]);

  // Takvim günlerini oluştur
  const getCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let firstDayOfWeek = firstDay.getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6;
    
    const days = [];
    
    // Önceki ayın günleri
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(year, month, -i);
      days.push({ date: day, isCurrentMonth: false });
    }
    
    // Bu ayın günleri
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const day = new Date(year, month, i);
      days.push({ date: day, isCurrentMonth: true });
    }
    
    // Sonraki ayın günleri (6 satır toplam için)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(year, month + 1, i);
      days.push({ date: day, isCurrentMonth: false });
    }
    
    return days;
  };

  const calendarDays = getCalendarDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysUntil = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      {/* KPI Satırı - Marketing + Rezervasyon */}
      <div className="kpi-row" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div className="kpi kpi-accent" style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6' }}>
          <div className="kpi-label" style={{ fontSize: '9px', color: '#3b82f6' }}>Gesamt € (All)</div>
          <div className="kpi-val" style={{ fontSize: '20px', color: '#3b82f6' }}>€{kpiData.totalReservationRevenue.toFixed(0)}</div>
          <div className="kpi-sub" style={{ fontSize: '9px', color: '#3b82f6' }}>{kpiData.totalReservationCount} Reservierungen</div>
        </div>

        <div className="kpi" style={{ padding: '12px' }}>
          <div className="kpi-label" style={{ fontSize: '9px' }}>Gesamt € (Year)</div>
          <div className="kpi-val" style={{ fontSize: '20px' }}>€{kpiData.yearReservationRevenue.toFixed(0)}</div>
          <div className="kpi-sub" style={{ fontSize: '9px' }}>{kpiData.yearReservationCount} Reservierungen</div>
          <div style={{ fontSize: '8px', marginTop: '4px', color: kpiData.yearChangePercent >= 0 ? '#10b981' : '#ef4444' }}>
            {kpiData.yearChangePercent >= 0 ? '+' : ''}{kpiData.yearChangePercent.toFixed(0)}% {kpiData.yearChangePercent >= 0 ? '↑' : '↓'}
          </div>
        </div>

        <div className="kpi" style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div className="kpi-label" style={{ fontSize: '9px' }}>Gesamt € (Month)</div>
          <div className="kpi-val" style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>
            €{kpiData.monthReservationRevenue.toFixed(0)}
          </div>
          <div className="kpi-sub" style={{ fontSize: '9px' }}>{kpiData.monthReservationCount} Reservierungen</div>
          <div style={{ fontSize: '8px', marginTop: '4px', color: kpiData.monthChangePercent >= 0 ? '#10b981' : '#ef4444' }}>
            {kpiData.monthChangePercent >= 0 ? '+' : ''}{kpiData.monthChangePercent.toFixed(0)}% {kpiData.monthChangePercent >= 0 ? '↑' : '↓'}
          </div>
        </div>

        <div className="kpi" style={{ padding: '12px' }}>
          <div className="kpi-label" style={{ fontSize: '9px' }}>Provision (All)</div>
          <div className="kpi-val" style={{ fontSize: '20px' }}>€{kpiData.totalProvision.toFixed(0)}</div>
          <div className="kpi-sub" style={{ fontSize: '9px' }}>{kpiData.totalReservationCount} Reservierungen</div>
        </div>

        <div className="kpi" style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.08)' }}>
          <div className="kpi-label" style={{ fontSize: '9px' }}>Provision (Year)</div>
          <div className="kpi-val" style={{ fontSize: '20px', fontWeight: '700', color: '#8b5cf6' }}>
            €{kpiData.yearProvision.toFixed(0)}
          </div>
          <div className="kpi-sub" style={{ fontSize: '9px' }}>{kpiData.yearReservationCount} Reservierungen</div>
          <div style={{ fontSize: '8px', marginTop: '4px', color: kpiData.yearProvisionChangePercent >= 0 ? '#10b981' : '#ef4444' }}>
            {kpiData.yearProvisionChangePercent >= 0 ? '+' : ''}{kpiData.yearProvisionChangePercent.toFixed(0)}% {kpiData.yearProvisionChangePercent >= 0 ? '↑' : '↓'}
          </div>
        </div>

        <div className="kpi" style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.08)' }}>
          <div className="kpi-label" style={{ fontSize: '9px' }}>Provision (Month)</div>
          <div className="kpi-val" style={{ fontSize: '20px', fontWeight: '700', color: COST_COLORS.katilim }}>
            €{kpiData.monthProvision.toFixed(0)}
          </div>
          <div className="kpi-sub" style={{ fontSize: '9px' }}>{kpiData.monthReservationCount} Reservierungen</div>
          <div style={{ fontSize: '8px', marginTop: '4px', color: kpiData.monthProvisionChangePercent >= 0 ? '#10b981' : '#ef4444' }}>
            {kpiData.monthProvisionChangePercent >= 0 ? '+' : ''}{kpiData.monthProvisionChangePercent.toFixed(0)}% {kpiData.monthProvisionChangePercent >= 0 ? '↑' : '↓'}
          </div>
        </div>

        <div className="kpi" style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div className="kpi-label" style={{ fontSize: '9px', marginBottom: '8px' }}>Top 5 Veranstalter</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {topVeranstalter.slice(0, 5).map((va, index) => (
              <div key={va.name} style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '9px',
                padding: '3px 0',
                borderBottom: index < 4 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  color: 'var(--text)',
                  fontWeight: '500'
                }}>
                  {index + 1}. {va.name}
                </div>
                <div style={{ 
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#f59e0b',
                  marginLeft: '8px'
                }}>
                  {va.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="charts-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card">
          <div className="card-title">Bevorstehende Reisen</div>
          <div className="card-sub">
            Erste 10 Reservierungen — nach Abreisedatum
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            marginTop: '16px',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {upcomingReservations.length === 0 ? (
              <div style={{ 
                color: 'var(--text2)', 
                fontSize: '11px', 
                textAlign: 'center',
                padding: '20px',
                fontWeight: '500' 
              }}>
                Keine bevorstehenden Reservierungen
              </div>
            ) : (
              upcomingReservations.map((reservation, index) => {
                const abreiseDate = new Date(reservation.abreise || reservation.buchung);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((abreiseDate - today) / (1000 * 60 * 60 * 24));
                
                return (
                  <div 
                    key={reservation.id || index}
                    style={{
                      background: 'var(--surface2)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        color: 'var(--text)',
                        marginBottom: '3px'
                      }}>
                        {reservation.name}
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'var(--text2)'
                      }}>
                        📍 {reservation.ziel} • {formatDate(reservation.abreise)}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: daysUntil <= 7 ? '#ef4444' : daysUntil <= 30 ? '#f59e0b' : '#3b82f6',
                      textAlign: 'right',
                      minWidth: '50px'
                    }}>
                      {daysUntil === 0 ? 'Heute' : 
                       daysUntil === 1 ? 'Morgen' :
                       `${daysUntil} Tage`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Aktuell im Urlaub</div>
          <div className="card-sub">
            {currentlyOnVacation.length} Kunden im Urlaub
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            marginTop: '16px',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {currentlyOnVacation.length === 0 ? (
              <div style={{ 
                color: 'var(--text2)', 
                fontSize: '11px', 
                textAlign: 'center',
                padding: '20px',
                fontWeight: '500' 
              }}>
                Keine Kunden im Urlaub
              </div>
            ) : (
              currentlyOnVacation.map((reservation, index) => {
                const abreiseDate = new Date(reservation.abreise);
                const ruckreiseDate = new Date(reservation.ruckreise);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Tatilde kaç gündür ve kaç gün kaldı?
                const daysInVacation = Math.ceil((today - abreiseDate) / (1000 * 60 * 60 * 24));
                const daysRemaining = Math.ceil((ruckreiseDate - today) / (1000 * 60 * 60 * 24));
                const totalDays = Math.ceil((ruckreiseDate - abreiseDate) / (1000 * 60 * 60 * 24));
                
                return (
                  <div 
                    key={reservation.id || index}
                    style={{
                      background: 'var(--surface2)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '6px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: 'var(--text)',
                          marginBottom: '3px'
                        }}>
                          🏖️ {reservation.name}
                        </div>
                        <div style={{ 
                          fontSize: '10px', 
                          color: 'var(--text2)'
                        }}>
                          📍 {reservation.ziel}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        color: daysRemaining === 0 ? '#ef4444' : 
                               daysRemaining <= 2 ? '#f59e0b' : '#10b981',
                        textAlign: 'right',
                        minWidth: '60px'
                      }}>
                        {daysRemaining === 0 ? 'Letzter Tag' : 
                         daysRemaining === 1 ? '1 Tag verbleibend' :
                         `${daysRemaining} Tage verbleibend`}
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'var(--surface)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      marginTop: '6px'
                    }}>
                      <div style={{
                        width: `${Math.min(((daysInVacation + 1) / (totalDays + 1)) * 100, 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                        transition: 'width 0.3s'
                      }}></div>
                    </div>
                    
                    <div style={{
                      fontSize: '9px',
                      color: 'var(--text3)',
                      marginTop: '4px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>{formatDate(reservation.abreise)}</span>
                      <span>{formatDate(reservation.ruckreise)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">🌍 Top 10 Destinationen</div>
          <div className="card-sub">
            Die beliebtesten Reiseziele
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            marginTop: '16px',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {topDestinations.length === 0 ? (
              <div style={{ 
                color: 'var(--text2)', 
                fontSize: '11px', 
                textAlign: 'center',
                padding: '20px',
                fontWeight: '500'
              }}>
                Noch keine Reservierungen
              </div>
            ) : (
              topDestinations.map((destination, index) => {
                // En çok rezervasyona göre yüzde hesapla
                const maxCount = topDestinations[0].count;
                const percentage = (destination.count / maxCount) * 100;
                
                // Sıralama renkleri
                let rankColor = '#3b82f6'; // Mavi
                if (index === 0) rankColor = '#f59e0b'; // Altın
                else if (index === 1) rankColor = '#94a3b8'; // Gümüş
                else if (index === 2) rankColor = '#cd7f32'; // Bronz
                
                return (
                  <div 
                    key={destination.name}
                    style={{
                      background: 'var(--surface2)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        {/* Sıralama badge */}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: rankColor,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: '700',
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        
                        {/* Destinasyon adı */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: '12px', 
                            fontWeight: '600', 
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            📍 {destination.name}
                          </div>
                          <div style={{ 
                            fontSize: '9px', 
                            color: 'var(--text2)',
                            marginTop: '2px'
                          }}>
                            Durchschnitt: €{(destination.revenue / destination.count).toFixed(0)}
                          </div>
                        </div>
                      </div>
                      
                      {/* İstatistikler */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'var(--text)'
                        }}>
                          {destination.count}
                        </div>
                        <div style={{
                          fontSize: '8px',
                          color: 'var(--text2)',
                          fontWeight: '500'
                        }}>
                          rezervasyon
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'var(--surface)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${rankColor} 0%, ${rankColor}99 100%)`,
                        transition: 'width 0.3s'
                      }}></div>
                    </div>
                    
                    {/* Toplam gelir */}
                    <div style={{
                      marginTop: '6px',
                      fontSize: '10px',
                      color: '#10b981',
                      fontWeight: '600',
                      textAlign: 'right'
                    }}>
                      Toplam: €{destination.revenue.toFixed(0)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Takvim Widget */}
        <div className="card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div className="card-title">📅 Kalender</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => {
                  const newDate = new Date(calendarDate);
                  newDate.setMonth(newDate.getMonth() - 1);
                  setCalendarDate(newDate);
                  setSelectedCalDay(null);
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ←
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(calendarDate);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setCalendarDate(newDate);
                  setSelectedCalDay(null);
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                →
              </button>
            </div>
          </div>
          <div className="card-sub" style={{ marginBottom: '12px' }}>
            {MONTHS[calendarDate.getMonth()]} {calendarDate.getFullYear()}
          </div>

          {/* Hafta günleri */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            marginBottom: '4px'
          }}>
              {WEEKDAYS_SHORT.map((day, idx) => (
                <div key={day + idx} style={{
                padding: '4px',
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text2)'
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Günler */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px'
          }}>
            {calendarDays.map((dayObj, index) => {
              const dateKey = formatDateISO(dayObj.date);
              const dayData = zpByDate[dateKey];
              const isToday = isSameDay(dayObj.date, today);
              const isSelected = selectedCalDay && isSameDay(dayObj.date, selectedCalDay);
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (!dayData) return;
                    setSelectedCalDay(prev => prev && isSameDay(prev, dayObj.date) ? null : dayObj.date);
                  }}
                  style={{
                    padding: '4px',
                    backgroundColor: isSelected ? 'rgba(0,184,122,0.15)' : isToday ? 'rgba(59,130,246,0.15)' : 'var(--bg)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: '4px',
                    opacity: dayObj.isCurrentMonth ? 1 : 0.3,
                    minHeight: '32px',
                    cursor: dayData ? 'pointer' : 'default',
                    transition: 'all 0.12s'
                  }}
                >
                  <div style={{
                    fontSize: '11px',
                    fontWeight: isToday || isSelected ? 600 : 400,
                    color: isSelected ? 'var(--accent)' : isToday ? '#3b82f6' : 'var(--text)'
                  }}>
                    {dayObj.date.getDate()}
                  </div>
                  {dayData && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', marginTop: '2px' }}>
                      {dayData.anz > 0 && <div style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent)', borderRadius: '50%' }} />}
                      {dayData.rest > 0 && <div style={{ width: '4px', height: '4px', backgroundColor: '#f59e0b', borderRadius: '50%' }} />}
                      {dayData.prov > 0 && <div style={{ width: '4px', height: '4px', backgroundColor: '#818cf8', borderRadius: '50%' }} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gün / Ay özeti */}
          {(() => {
            if (!selectedCalDay) {
              // Ay toplamları
              const monthPrefix = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
              let anz = 0, rest = 0, prov = 0;
              Object.entries(zpByDate).forEach(([key, v]) => {
                if (key.startsWith(monthPrefix)) { anz += v.anz; rest += v.rest; prov += v.prov; }
              });
              if (anz === 0 && rest === 0 && prov === 0) return null;
              return (
                <div style={{ marginTop: '10px', padding: '8px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text2)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    {MONTHS[calendarDate.getMonth()]} — Gesamt
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '8px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>Anzahlung</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{anz.toFixed(0)} €</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase' }}>Restzahlung</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>{rest.toFixed(0)} €</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '8px', color: '#818cf8', fontWeight: '700', textTransform: 'uppercase' }}>Provision</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>{prov.toFixed(0)} €</div>
                    </div>
                  </div>
                </div>
              );
            }
            const key = formatDateISO(selectedCalDay);
            const d = zpByDate[key] || { anz: 0, rest: 0, prov: 0 };
            return (
              <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,184,122,0.08)', borderRadius: '6px', border: '1px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: '700', letterSpacing: '0.04em' }}>
                    {selectedCalDay.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                  <button onClick={() => setSelectedCalDay(null)} style={{ fontSize: '9px', background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 0 }}>× Schließen</button>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>Anzahlung</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: d.anz > 0 ? 'var(--accent)' : 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>{d.anz > 0 ? d.anz.toFixed(0) + ' €' : '—'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase' }}>Restzahlung</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: d.rest > 0 ? '#f59e0b' : 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>{d.rest > 0 ? d.rest.toFixed(0) + ' €' : '—'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', color: '#818cf8', fontWeight: '700', textTransform: 'uppercase' }}>Provision</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: d.prov > 0 ? '#818cf8' : 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>{d.prov > 0 ? d.prov.toFixed(0) + ' €' : '—'}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
