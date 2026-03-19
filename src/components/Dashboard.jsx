import React, { useMemo, useState } from 'react';

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

const PROGRAM_EMOJI = {
  'Workshop': '🎯',
  'Fuar': '🏢',
  'Roadshow': '🚗',
  'Sales Call': '📞',
  'Gala': '🎭',
  'Ziyaret': '🤝',
  'Info Tour': '🚌'
};

const PROGRAM_COLORS = {
  'Fuar': { bg: '#166534', border: '#16a34a' },
  'Workshop': { bg: '#1e3a8a', border: '#2563eb' },
  'Roadshow': { bg: '#9a3412', border: '#ea580c' },
  'Sales Call': { bg: '#581c87', border: '#a855f7' },
  'Gala': { bg: '#991b1b', border: '#dc2626' },
  'Ziyaret': { bg: '#0e7490', border: '#06b6d4' },
  'Info Tour': { bg: '#713f12', border: '#ca8a04' },
  'Diğer': { bg: '#374151', border: '#6b7280' }
};

const WEEKDAYS_SHORT = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
};

function Dashboard({ marketingEvents = [], reservations = [], exchangeRates = { EUR: 1, USD: 0.92, GBP: 1.17, TRY: 0.029 } }) {
  // Takvim state
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // KPI hesaplamaları - Sadece Marketing verileri
  const kpiData = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Marketing harcamaları hesaplama
    const calculateMarketingCost = (event) => {
      const katilim = parseFloat(event.katilimUcreti) || 0;
      const standYer = parseFloat(event.standYerUcreti) || 0;
      const stand = parseFloat(event.standBedeli) || 0;
      const diger = parseFloat(event.digerUcret) || 0;
      const total = katilim + standYer + stand + diger;
      
      // Merkezi döviz kurlarını kullan
      const rate = exchangeRates[event.currency || 'EUR'] || 1;
      return total * rate;
    };

    // Bu ay marketing etkinlikleri
    const monthMarketing = marketingEvents.filter(e => {
      const d = new Date(e.tarih);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    // Bu yıl marketing etkinlikleri
    const yearMarketing = marketingEvents.filter(e => {
      const d = new Date(e.tarih);
      return d.getFullYear() === thisYear;
    });

    // Marketing toplamları
    const monthMarketingTotal = monthMarketing.reduce((s, e) => s + calculateMarketingCost(e), 0);
    const yearMarketingTotal = yearMarketing.reduce((s, e) => s + calculateMarketingCost(e), 0);

    // Ortalama etkinlik maliyeti
    const avgEventCost = monthMarketing.length > 0 ? monthMarketingTotal / monthMarketing.length : 0;

    // Maliyet kalemleri toplamları (bu ay)
    let katilimTotal = 0;
    let standYerTotal = 0;
    let standYapimTotal = 0;
    let digerTotal = 0;

    monthMarketing.forEach(e => {
      const rate = exchangeRates[e.currency || 'EUR'] || 1;
      
      katilimTotal += (parseFloat(e.katilimUcreti) || 0) * rate;
      standYerTotal += (parseFloat(e.standYerUcreti) || 0) * rate;
      standYapimTotal += (parseFloat(e.standBedeli) || 0) * rate;
      digerTotal += (parseFloat(e.digerUcret) || 0) * rate;
    });

    // En yüksek maliyet kalemi
    const costItems = [
      { name: 'katilim', total: katilimTotal },
      { name: 'standYer', total: standYerTotal },
      { name: 'standYapim', total: standYapimTotal },
      { name: 'diger', total: digerTotal }
    ].sort((a, b) => b.total - a.total);

    const topCostItem = costItems[0];

    // En yüksek program tipi
    const programTypes = {};
    monthMarketing.forEach(e => {
      if (!programTypes[e.programTipi]) programTypes[e.programTipi] = 0;
      programTypes[e.programTipi]++;
    });
    const topProgramType = Object.entries(programTypes).sort((a, b) => b[1] - a[1])[0];

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

    // Bu ayın provizyon hakedişi
    const monthProvision = monthReservations.reduce((s, r) => s + calculateProvision(r), 0);

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
      monthMarketingTotal,
      yearMarketingTotal,
      monthEventsCount: monthMarketing.length,
      yearEventsCount: yearMarketing.length,
      avgEventCost,
      katilimTotal,
      standYerTotal,
      standYapimTotal,
      digerTotal,
      topCostItem,
      topProgramType,
      costItems,
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
      avgReservationValue,
      uniqueCustomers,
      statusCounts,
      monthChangePercent,
      yearChangePercent,
      monthProvisionChangePercent,
      yearProvisionChangePercent
    };
  }, [marketingEvents, reservations, exchangeRates]);

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

  // Aylık chart data (sadece marketing)
  const chartData = useMemo(() => {
    const monthlyMarketing = {};

    // Marketing events
    marketingEvents.forEach(e => {
      const d = new Date(e.tarih);
      const key = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
      if (!monthlyMarketing[key]) monthlyMarketing[key] = 0;
      
      const katilim = parseFloat(e.katilimUcreti) || 0;
      const standYer = parseFloat(e.standYerUcreti) || 0;
      const stand = parseFloat(e.standBedeli) || 0;
      const diger = parseFloat(e.digerUcret) || 0;
      const total = katilim + standYer + stand + diger;
      
      const rates = { EUR: 1, USD: 0.92, GBP: 1.17, TRY: 0.03 };
      monthlyMarketing[key] += total * (rates[e.currency || 'EUR'] || 1);
    });

    // Aylara dönüştür
    const combined = Object.keys(monthlyMarketing).map(month => ({
      month,
      marketing: monthlyMarketing[month] || 0
    }));

    // Son 6 ayı al ve sırala
    return combined.slice(-6);
  }, [marketingEvents]);

  const maxAmt = chartData.length 
    ? Math.max(...chartData.map(d => d.marketing)) 
    : 0;

  // Maliyet kalemleri breakdown (bu ay) - detaylı
  const costBreakdown = kpiData.costItems
    .filter(item => item.total > 0)
    .map(item => {
      // Bu maliyet kalemini kullanan etkinlik sayısı
      const eventCount = marketingEvents.filter(e => {
        const d = new Date(e.tarih);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        
        const rate = exchangeRates[e.currency || 'EUR'] || 1;
        
        let value = 0;
        if (item.name === 'katilim') value = (parseFloat(e.katilimUcreti) || 0) * rate;
        if (item.name === 'standYer') value = (parseFloat(e.standYerUcreti) || 0) * rate;
        if (item.name === 'standYapim') value = (parseFloat(e.standBedeli) || 0) * rate;
        if (item.name === 'diger') value = (parseFloat(e.digerUcret) || 0) * rate;
        
        return value > 0;
      }).length;
      
      return { ...item, eventCount };
    });
  const costTotal = costBreakdown.reduce((a, b) => a + b.total, 0);

  // Yaklaşan marketing etkinlikleri
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return marketingEvents
      .filter(e => {
        const eventDate = new Date(e.tarih);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
      })
      .sort((a, b) => new Date(a.tarih) - new Date(b.tarih))
      .slice(0, 10); // İlk 10 etkinlik
  }, [marketingEvents]);

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

  // Events'leri tarihe göre grupla
  const eventsByDate = useMemo(() => {
    const grouped = {};
    marketingEvents.forEach(event => {
      const startDate = parseDate(event.tarih);
      const endDate = event.tarihBitis ? parseDate(event.tarihBitis) : startDate;
      
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const key = formatDateISO(currentDate);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(event);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    return grouped;
  }, [marketingEvents]);

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
              const dayEvents = eventsByDate[dateKey] || [];
              const isToday = isSameDay(dayObj.date, today);
              
              return (
                <div
                  key={index}
                  style={{
                    padding: '4px',
                    backgroundColor: isToday ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    opacity: dayObj.isCurrentMonth ? 1 : 0.3,
                    minHeight: '32px',
                    position: 'relative',
                    cursor: dayEvents.length > 0 ? 'pointer' : 'default'
                  }}
                  title={dayEvents.map(e => e.programAdi).join(', ')}
                >
                  <div style={{
                    fontSize: '11px',
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? '#3b82f6' : 'var(--text)',
                    marginBottom: '2px'
                  }}>
                    {dayObj.date.getDate()}
                  </div>
                  {dayEvents.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1px'
                    }}>
                      {dayEvents.slice(0, 3).map((event, i) => {
                        const colors = PROGRAM_COLORS[event.programTipi] || PROGRAM_COLORS['Diğer'];
                        return (
                          <div
                            key={event.id ? event.id + '-' + i : i}
                            style={{
                              width: '4px',
                              height: '4px',
                              backgroundColor: colors.border,
                              borderRadius: '50%'
                            }}
                          ></div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
