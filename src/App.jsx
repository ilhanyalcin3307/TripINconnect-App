import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import HotelView from './components/HotelView';
import BudgetView from './components/BudgetView';
import ReportView from './components/ReportView';
import ReservationsView from './components/ReservationsView';
import CustomersView from './components/CustomersView';
import UploadModal from './components/UploadModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import ProfileModal from './components/ProfileModal';
import Toast from './components/Toast';

const DEFAULT_CATEGORIES = [
  // 1A Vista
  'AVST|1A Vista',
  // AIDA
  'AIDA|AIDA', 'AIR|Air Marin', 'ALD|ALDIANA', 'ALDX|Aldiana dynamisch',
  'ALDI|Aldiana', 'ALL|Alltours-x',
  // Alltours
  'ALLT|Alltours', 'BYE|byebye', 'BYEX|byebye-dynamisch', 'AMER|AMEROPA',
  // Anex Gruppe
  'ANEX|ANEX Tour', 'BU|BUCHER Reisen', 'NEC|Neckermann Reisen', 'OGE|ÖGER TOURS',
  'XANE|ANEX Tour dynamisch', 'XBU|GoBUCHER!', 'XNEC|Neckermann Reisen dynamisch', 'XOGE|ÖGER TOURS dynamisch',
  // Anton Götten
  'CED|Anton Götten',
  // A-ROSA
  'AROS|A-ROSA Flussschiff',
  // Austrian Airlines
  'BAV|Bavaria Fernreisen',
  // Bavaria / Belvilla
  'BELV|Belvilla',
  // Bentour
  'BCH|Bentour Reisen',
  // Berge & Meer / Capital Holidays
  'CPH|Capital Holidays', 'CEPA|Center Parcs',
  // Christophorus
  'CHRI|Christophorus Reiseveran.',
  // cleverreisen
  'CLEV|cleverreisen',
  // Club Med
  'CMD|Club Med', 'CFI|Condor Fluglinie',
  // Coop-ITS / Conneton
  'ITSC|Coop-ITS-Travel', 'CONN|Conneton Airlines',
  // Coral
  'COR|Coral Travel', 'COS|Coral Travel Schweiz', 'FER|FERIEN Touristik',
  // Costa
  'CST|Costa Kreuzfahrten',
  // DanCenter
  'DAC|DanCenter', 'DANS|Dansommer',
  // DCS
  'DCST|DCS Touristik', 'DER|DER',
  // Dertour
  'DERT|DERTOUR International', 'ECC|Ecco Reisen', 'DKTO|DKTOURISTIK', 'TIAX|TRAVELIX Last Minute',
  // ETI
  'ETI|ETI', 'EYH|Etihad Holidays', 'EWH|Eurowings-Holidays', 'EWHI|EWH Holidays',
  // FalkTravel
  'FALK|FalkTravel', 'FALD|Falk Travel Dynamic', 'HOL|First of Holiday',
  // Fit Reisen
  'FIT|Fit Reisen',
  // Flamingo
  'FLT|Flamingo Tours',
  // For You Travel
  'FORK|For You Travel', 'FORC|For You Travel', 'FORF|For You Travel',
  // Freizeitreisen
  'FRI|Freizeitreisen', 'FUHR|Fuhrmann Mundstock',
  // Gebeco
  'GEBE|Gebeco', 'GIMM|Gimmler Reisen',
  // Globalis
  'GER|Globalis Erlebnisreisen', 'GLOB|Globetrotter Reisen',
  // goXplore
  'GOX|goXplore',
  // Grafs
  'GRAF|Grafs Reisen',
  // GRUBER
  'GRUB|GRUBER/Aaretat Reisen', 'HVT|Helvetic Tours',
  // HLX
  'HLX|HLX Touristik', 'HLXC|HolidayCloud',
  // HolidayG
  'HOLG|HolidayG',
  // HolidayTrax
  'TRIX|HolidayTrax',
  // IB Hamburg
  'IVH|IB Hamburg',
  // ID. Riva
  'RIVA|I.D. Riva Tours',
  // Idealtours
  'IDEA|Idealtours', 'INDO|Indochina Travels',
  // InterChalet
  'ICHE|InterChalet', 'IHOM|Interhome',
  // IT
  'ITT|IT-TravelTime', 'XPUR|ITTXPUR',
  // JAHN
  'JAHN|JAHN REISEN', 'XIAH|JAHN REISEN Indi',
  // Kneissl
  'KNEI|Kneissl Touristik', 'KUON|Kuoni Reisen', 'KUONI|Kuoni Reisen',
  // Lifecard
  'LTA|Lifecard Travel Assistance',
  // LMX
  'LMX|LMX Touristik', 'LMXF|LMX Flex', 'LMXI|LMX International', 'LMXIF|LMX International Flex',
  // Lufthansa
  'LHH|Lufthansa Holidays', 'LUXR|Luxair',
  // Marco Polo
  'MPOL|Marco Polo Reisen', 'MPGR|Marco Polo Reisen',
  // Mayfair
  'MFJ|Mayfair Jets',
  // Meiers
  'MVR|MEIERS WELTREISEN',
  // Mondial
  'MON|Mondial',
  // Natura
  'NASP|Natura Spa',
  // Neckabauer
  'NECK|Neckabauer',
  // Nicko Cruises
  'NIC|Nicko Cruises Schifffreisen',
  // Novasol
  'NOVO|NOVASOL', 'CUEN|Novasol', 'NURI|NUR Touristik',
  // OASIS
  'OAST|OASIS Travel',
  // OLIMAR
  'OLI|OLIMAR', 'PHON|Phönix Reisen',
  // Plantours
  'PLAN|Plantours',
  // Prima
  'PRIM|Prima Reisen', 'PTIC|PTI Panoramica',
  // Rhomberg
  'RHOM|Rhomberg Reisen', 'RTA|RTARail Tours',
  // Ruefa
  'RUEF|Ruefa',
  // Schauinsland
  'SLR|schauinsland-reisen', 'SLRD|schauinsland-dynamisch',
  // Seita Med
  'SMED|Seita Med', 'SIX|Sixt', 'SKR|SKR Reisen',
  // Spica
  'SIT|spica.travel',
  // Studiosus
  'STUD|Studiosus Reisen München', 'GRUP|Studiosus Gruppenreisen',
  // SunExpress
  'SUNX|SunExpress',
  // Sunny Cars
  'SCAR|Sunny Cars',
  // Swiss Group
  'SGRO|Swiss Group International',
  // SZ-Reisen
  'SZR|SZ-Reisen',
  // Terra
  'TERR|Terra Reisen',
  // Tischler
  'TSCR|Tischler Reisen',
  // Tour Vital
  'TVR|Tour Vital',
  // Tourenia
  'TOU|Tourenia',
  // Travelers Friend
  'TRAV|Travelers Friend pow. By LMX', 'TREX|trendtours',
  // Triada
  'TRIA|Triada S.A.',
  // Troll
  'TROL|Troll Touristik',
  // tropo
  'TROP|tropo',
  // UKS
  'UKS|UKS Touristik',
  // Uptour
  'UPS|Uptour', 'URL|URLAUBS TOURISTIK', 'ULT|Urlaubstouristik international',
  // Vtours
  'VTO|vtours', 'VTOI|vtours international',
  // WeFly24
  'W24|WeFly24',
  // WINDROSE
  'WFT|WINDROSE Finest Travel',
  // Wörlitz
  'WOER|Wörlitz Touristik',
];

const DEFAULT_AGENTUR_GRUPPE = {
  // 1A Vista
  AVST: '1A Vista',
  // AIDA
  AIDA: 'AIDA', AIR: 'AIDA', ALD: 'AIDA', ALDX: 'AIDA', ALDI: 'AIDA',
  // Alltours-x
  ALL: 'Alltours-x',
  // Alltours
  ALLT: 'Alltours', BYE: 'Alltours', BYEX: 'Alltours', AMER: 'Alltours',
  // Anex Gruppe
  ANEX: 'Anex Gruppe', BU: 'Anex Gruppe', NEC: 'Anex Gruppe', OGE: 'Anex Gruppe',
  XANE: 'Anex Gruppe', XBU: 'Anex Gruppe', XNEC: 'Anex Gruppe', XOGE: 'Anex Gruppe',
  // Anton Götten
  CED: 'Anton Götten',
  // A-ROSA
  AROS: 'A-ROSA',
  // Austrian Airlines / Bavaria
  BAV: 'Bavaria Fernreisen',
  // Belvilla
  BELV: 'Belvilla',
  // Bentour
  BCH: 'Bentour',
  // Capital / Center Parcs
  CPH: 'Capital Holidays', CEPA: 'Center Parcs',
  // Christophorus
  CHRI: 'Christophorus',
  // cleverreisen
  CLEV: 'cleverreisen',
  // Club Med / Condor
  CMD: 'Club Med', CFI: 'Condor',
  // Coop-ITS / Conneton
  ITSC: 'Coop-ITS', CONN: 'Conneton Airlines',
  // Coral
  COR: 'Coral', COS: 'Coral', FER: 'Coral',
  // Costa
  CST: 'Costa',
  // DanCenter / Dansommer
  DAC: 'DanCenter', DANS: 'DanCenter',
  // DCS
  DCST: 'DCS Touristik', DER: 'DCS Touristik',
  // Dertour
  DERT: 'Dertour', ECC: 'Dertour', DKTO: 'Dertour', TIAX: 'Dertour',
  // ETI
  ETI: 'ETI', EYH: 'ETI', EWH: 'ETI', EWHI: 'ETI',
  // FalkTravel
  FALK: 'Falk Travel', FALD: 'Falk Travel', HOL: 'Falk Travel',
  // Fit Reisen
  FIT: 'Fit Reisen',
  // Flamingo
  FLT: 'Flamingo',
  // For You Travel
  FORK: 'For You Travel', FORC: 'For You Travel', FORF: 'For You Travel',
  // Freizeitreisen
  FRI: 'Freizeitreisen', FUHR: 'Freizeitreisen',
  // Gebeco / Gimmler
  GEBE: 'Gebeco', GIMM: 'Gimmler Reisen',
  // Globalis / Globetrotter
  GER: 'Globalis', GLOB: 'Globalis',
  // goXplore
  GOX: 'goXplore',
  // Grafs
  GRAF: 'Grafs Reisen',
  // GRUBER
  GRUB: 'GRUBER', HVT: 'GRUBER',
  // HLX
  HLX: 'HLX', HLXC: 'HLX',
  // HolidayG
  HOLG: 'HolidayG',
  // HolidayTrax
  TRIX: 'HolidayTrax',
  // IB Hamburg
  IVH: 'IB Hamburg',
  // ID. Riva
  RIVA: 'I.D. Riva',
  // Idealtours / Indochina
  IDEA: 'Idealtours', INDO: 'Indochina Travels',
  // InterChalet / Interhome
  ICHE: 'Interhome', IHOM: 'Interhome',
  // IT / ITT
  ITT: 'ITT', XPUR: 'ITT',
  // JAHN
  JAHN: 'JAHN', XIAH: 'JAHN',
  // Kneissl / Kuoni
  KNEI: 'Kneissl', KUON: 'Kuoni', KUONI: 'Kuoni',
  // Lifecard
  LTA: 'Lifecard',
  // LMX
  LMX: 'LMX', LMXF: 'LMX', LMXI: 'LMX', LMXIF: 'LMX',
  // Lufthansa / Luxair
  LHH: 'Lufthansa Holidays', LUXR: 'Lufthansa Holidays',
  // Marco Polo
  MPOL: 'Marco Polo', MPGR: 'Marco Polo',
  // Mayfair
  MFJ: 'Mayfair Jets',
  // Meiers
  MVR: 'Meiers Weltreisen',
  // Mondial
  MON: 'Mondial',
  // Natura
  NASP: 'Natura Spa',
  // Neckabauer
  NECK: 'Neckabauer',
  // Nicko Cruises
  NIC: 'Nicko Cruises',
  // Novasol / NUR
  NOVO: 'Novasol', CUEN: 'Novasol', NURI: 'NUR Touristik',
  // OASIS
  OAST: 'OASIS Travel',
  // OLIMAR / Phönix
  OLI: 'OLIMAR', PHON: 'Phönix Reisen',
  // Plantours
  PLAN: 'Plantours',
  // Prima / PTI
  PRIM: 'Prima Reisen', PTIC: 'PTI',
  // Rhomberg / RTA
  RHOM: 'Rhomberg', RTA: 'Rhomberg',
  // Ruefa
  RUEF: 'Ruefa',
  // Schauinsland
  SLR: 'Schauinsland', SLRD: 'Schauinsland',
  // Seita Med / Sixt / SKR
  SMED: 'Seita Med', SIX: 'Sixt', SKR: 'SKR Reisen',
  // Spica
  SIT: 'Spica',
  // Studiosus
  STUD: 'Studiosus', GRUP: 'Studiosus',
  // SunExpress
  SUNX: 'SunExpress',
  // Sunny Cars
  SCAR: 'Sunny Cars',
  // Swiss Group
  SGRO: 'Swiss Group',
  // SZ-Reisen
  SZR: 'SZ-Reisen',
  // Terra
  TERR: 'Terra Reisen',
  // Tischler
  TSCR: 'Tischler Reisen',
  // Tour Vital
  TVR: 'Tour Vital',
  // Tourenia
  TOU: 'Tourenia',
  // Travelers Friend / trendtours
  TRAV: 'Travelers Friend', TREX: 'Travelers Friend',
  // Triada
  TRIA: 'Triada',
  // Troll
  TROL: 'Troll',
  // tropo
  TROP: 'tropo',
  // UKS
  UKS: 'UKS',
  // Uptour / Urlaubstouristik
  UPS: 'Uptour', URL: 'URLAUBS TOURISTIK', ULT: 'URLAUBS TOURISTIK',
  // Vtours
  VTO: 'Vtours', VTOI: 'Vtours',
  // WeFly24
  W24: 'WeFly24',
  // WINDROSE
  WFT: 'WINDROSE',
  // Wörlitz
  WOER: 'Wörlitz',
};

function App() {
  // --------- Auth ---------
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // userReady: setCurrentUser IPC çağrısı tamamlandıktan sonra true olur
  // Veri yüklemeleri ancak o zaman başlar
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setUserReady(true);
      }
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setUserReady(true);
      } else {
        setUser(null);
        setUserReady(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  // --------- /Auth ---------

  const [expenses, setExpenses] = useState([]);
  const [marketingEvents, setMarketingEvents] = useState([]);
  const [visitReports, setVisitReports] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [skipToForm, setSkipToForm] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '' });

  // Merkezi kategori yönetimi
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [agenturData, setAgenturData] = useState({});

  // userReady olunca kullanıcıya ait localStorage + elektron veri yüklenir
  useEffect(() => {
    if (!userReady || !user) return;
    const catKey = `${user.id}_marketingCategories`;
    const agKey = `${user.id}_agenturProvisionData`;
    const savedCat = localStorage.getItem(catKey);
    if (savedCat) {
      const parsed = JSON.parse(savedCat);
      // Kayıtlı kategorileri DEFAULT_CATEGORIES ile merg et:
      // Eski kodları koru (+yeni isimlerle güncelle), yeni eklenen DEFAULT kodlarını ekle
      const defaultCodes = new Set(DEFAULT_CATEGORIES.map(c => c.split('|')[0]));
      const savedCodes = new Set(parsed.map(c => c.includes('|') ? c.split('|')[0] : c));
      // Sadece DEFAULT'ta olmayan kodları sakla (kullanıcı eklemeleri)
      const extraCats = parsed.filter(c => {
        const code = c.includes('|') ? c.split('|')[0] : c;
        return !defaultCodes.has(code);
      });
      // DEFAULT_CATEGORIES her zaman temel liste, üstüne kullanıcı eklemeleri
      setCategories([...DEFAULT_CATEGORIES, ...extraCats]);
    } else {
      setCategories(DEFAULT_CATEGORIES);
    }
    const savedAg = localStorage.getItem(agKey);
    if (savedAg) {
      const parsed = JSON.parse(savedAg);
      // DEFAULT_AGENTUR_GRUPPE ile grup bilgilerini güncelle (migrasyon)
      const migrated = { ...parsed };
      Object.entries(DEFAULT_AGENTUR_GRUPPE).forEach(([code, gruppe]) => {
        if (migrated[code]) {
          migrated[code] = { ...migrated[code], gruppe };
        }
      });
      setAgenturData(migrated);
    } else {
      setAgenturData({});
    }
    loadExpenses();
    loadMarketingEvents();
    loadVisitReports();
    loadReservations();
    fetchExchangeRates();
  }, [userReady, user?.id]);

  // Merkezi döviz kurları
  const [exchangeRates, setExchangeRates] = useState({
    EUR: 1,
    USD: 0.92,
    GBP: 1.17,
    TRY: 0.029,
    CZK: 0.04
  });

  // Kategorileri kullanıcıya özel localStorage'a kaydet
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`${user.id}_marketingCategories`, JSON.stringify(categories));
  }, [categories, user?.id]);

  // agenturData kullanıcıya özel localStorage'a kaydet
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`${user.id}_agenturProvisionData`, JSON.stringify(agenturData));
  }, [agenturData, user?.id]);

  // categories değişince her kod için DEFAULT_AGENTUR_GRUPPE'dan grubu uygula
  // Sadece gruppe boşsa doldurur — kullanıcının elle düzenlediği grupları korur
  useEffect(() => {
    setAgenturData(prev => {
      const updated = { ...prev };
      let changed = false;
      categories.forEach(cat => {
        const code = cat.includes('|') ? cat.split('|')[0] : cat;
        const defaultGruppe = DEFAULT_AGENTUR_GRUPPE[code] || '';
        if (!updated[code]) {
          // Yeni kod: default değerlerle oluştur
          updated[code] = { gruppe: defaultGruppe, provPct: 10, zusatzprovision: '', zusatzPct: '', berechnung: 'Abreisedatum', tage: '30' };
          changed = true;
        } else if (!updated[code].gruppe && defaultGruppe) {
          // Gruppe boşsa default'tan doldur (kullanıcı düzenlemesi varsa dokunma!)
          updated[code] = { ...updated[code], gruppe: defaultGruppe };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [categories]);
  
  const fetchExchangeRates = async () => {
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,TRY,CZK');
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          setExchangeRates({
            EUR: 1,
            USD: 1 / data.rates.USD,
            GBP: 1 / data.rates.GBP,
            TRY: 1 / data.rates.TRY,
            CZK: 1 / data.rates.CZK
          });
        }
      }
    } catch (error) {
      console.error('Döviz kurları alınamadı:', error);
    }
  };

  const loadExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').order('tarih', { ascending: false });
    setExpenses(data || []);
  };

  const loadMarketingEvents = async () => {
    const { data } = await supabase.from('marketing_events').select('*').order('tarih', { ascending: false });
    setMarketingEvents((data || []).map(r => ({ id: r.id, ...r.data, tarih: r.tarih })));
  };

  const loadVisitReports = async () => {
    const { data } = await supabase.from('visit_reports').select('*').order('date', { ascending: false });
    setVisitReports((data || []).map(r => ({ id: r.id, ...r.data, date: r.date })));
  };

  const loadReservations = async () => {
    const { data } = await supabase.from('reservations').select('*').order('abreise', { ascending: false });
    setReservations((data || []).map(r => ({ id: r.id, ...r.data, vg_nr: r.vg_nr, name: r.name, abreise: r.abreise, reisepreis: r.reisepreis })));
  };

  const addReservation = async (reservation) => {
    const isDuplicate = reservations.some(r => {
      if (reservation.vgNr && r.vg_nr)
        return r.vg_nr.trim().toLowerCase() === reservation.vgNr.trim().toLowerCase();
      return (
        r.name?.trim().toLowerCase() === reservation.name?.trim().toLowerCase() &&
        r.abreise === reservation.abreise &&
        String(r.reisepreis) === String(reservation.reisepreis)
      );
    });
    if (isDuplicate) return null;
    const { data, error } = await supabase.from('reservations').insert({
      user_id: user.id,
      vg_nr: reservation.vgNr || reservation.vg_nr || null,
      name: reservation.name || null,
      abreise: reservation.abreise || null,
      reisepreis: reservation.reisepreis ? parseFloat(reservation.reisepreis) : null,
      data: reservation
    }).select().single();
    if (!error) {
      await loadReservations();
      showToast('✓ Rezervasyon kaydedildi!');
      return data;
    }
    return null;
  };

  const bulkAddReservations = async (newReservations) => {
    if (!newReservations.length) return { added: 0, skipped: 0 };
    let added = 0, skipped = 0;
    const currentList = [...reservations];
    const addedItems = [];
    for (const reservation of newReservations) {
      const isDuplicate = [...currentList, ...addedItems].some(r => {
        if (reservation.vgNr && r.vg_nr)
          return r.vg_nr.trim().toLowerCase() === reservation.vgNr.trim().toLowerCase();
        return (
          r.name?.trim().toLowerCase() === reservation.name?.trim().toLowerCase() &&
          r.abreise === reservation.abreise &&
          String(r.reisepreis) === String(reservation.reisepreis)
        );
      });
      if (isDuplicate) { skipped++; continue; }
      await supabase.from('reservations').insert({
        user_id: user.id,
        vg_nr: reservation.vgNr || reservation.vg_nr || null,
        name: reservation.name || null,
        abreise: reservation.abreise || null,
        reisepreis: reservation.reisepreis ? parseFloat(reservation.reisepreis) : null,
        data: reservation
      });
      addedItems.push(reservation);
      added++;
    }
    await loadReservations();
    return { added, skipped };
  };

  const deleteReservation = async (id) => {
    await supabase.from('reservations').delete().eq('id', id);
    await loadReservations();
    showToast('🗑 Rezervasyon silindi');
  };

  const bulkDeleteReservations = async (ids) => {
    if (!ids.length) return;
    await supabase.from('reservations').delete().in('id', ids);
    await loadReservations();
    showToast(`🗑 ${ids.length} Reservierungen gelöscht`);
  };

  const updateReservation = async (reservation) => {
    await supabase.from('reservations').update({
      vg_nr: reservation.vgNr || reservation.vg_nr || null,
      name: reservation.name || null,
      abreise: reservation.abreise || null,
      reisepreis: reservation.reisepreis ? parseFloat(reservation.reisepreis) : null,
      data: reservation
    }).eq('id', reservation.id);
    await loadReservations();
    showToast('✓ Rezervasyon güncellendi!');
  };

  const addMarketingEvent = async (event) => {
    await supabase.from('marketing_events').insert({
      user_id: user.id,
      tarih: event.tarih || null,
      data: event
    });
    await loadMarketingEvents();
    showToast('✓ Etkinlik kaydedildi!');
  };

  const deleteMarketingEvent = async (id) => {
    await supabase.from('marketing_events').delete().eq('id', id);
    await loadMarketingEvents();
    showToast('🗑 Etkinlik silindi');
  };

  const updateMarketingEvent = async (event) => {
    await supabase.from('marketing_events').update({
      tarih: event.tarih || null,
      data: event
    }).eq('id', event.id);
    await loadMarketingEvents();
    showToast('✓ Etkinlik güncellendi!');
  };

  const addVisitReport = async (report) => {
    await supabase.from('visit_reports').insert({
      user_id: user.id,
      date: report.date || null,
      data: report
    });
    await loadVisitReports();
    showToast('✓ Rapor kaydedildi!');
  };

  const deleteVisitReport = async (id) => {
    await supabase.from('visit_reports').delete().eq('id', id);
    await loadVisitReports();
    showToast('🗑 Rapor silindi');
  };

  const updateVisitReport = async (report) => {
    await supabase.from('visit_reports').update({
      date: report.date || null,
      data: report
    }).eq('id', report.id);
    await loadVisitReports();
    showToast('✓ Rapor güncellendi!');
  };

  const addExpense = async (expense) => {
    const rate = exchangeRates[expense.currency] || 1;
    const eurAmount = expense.eurAmount && expense.eurAmount !== ''
      ? parseFloat(expense.eurAmount)
      : parseFloat(expense.tutar) * rate;
    const row = {
      user_id: user.id,
      tarih: expense.tarih || null,
      fisno: expense.fisno || null,
      aciklama: expense.aciklama || null,
      tutar: parseFloat(expense.tutar) || 0,
      currency: expense.currency || 'EUR',
      kategori: expense.kategori || null,
      otel: expense.otel || null,
      notiz: expense.not || null,
      eur_amount: parseFloat(eurAmount.toFixed(2)),
      exchange_rate: rate,
      has_receipt: false,
      receipt_path: null
    };
    const { data, error } = await supabase.from('expenses').insert(row).select().single();
    if (!error) {
      await loadExpenses();
      showToast('✓ Fiş kaydedildi!');
      return data;
    }
    return null;
  };

  const deleteExpense = async (id) => {
    await supabase.from('expenses').delete().eq('id', id);
    await loadExpenses();
    showToast('🗑 Fiş silindi');
  };

  const updateExpense = async (id, expense) => {
    let expenseToUpdate = { ...expense };
    if (expense.tutar && expense.currency) {
      const rate = exchangeRates[expense.currency] || 1;
      const eurAmount = expense.eurAmount && expense.eurAmount !== ''
        ? parseFloat(expense.eurAmount)
        : parseFloat(expense.tutar) * rate;
      expenseToUpdate.eurAmount = eurAmount.toFixed(2);
      expenseToUpdate.exchangeRate = rate;
    }
    await supabase.from('expenses').update({
      tarih: expenseToUpdate.tarih || null,
      fisno: expenseToUpdate.fisno || null,
      aciklama: expenseToUpdate.aciklama || null,
      tutar: parseFloat(expenseToUpdate.tutar) || 0,
      currency: expenseToUpdate.currency || 'EUR',
      kategori: expenseToUpdate.kategori || null,
      otel: expenseToUpdate.otel || null,
      notiz: expenseToUpdate.not || null,
      eur_amount: expenseToUpdate.eurAmount ? parseFloat(expenseToUpdate.eurAmount) : null,
      exchange_rate: expenseToUpdate.exchangeRate || null
    }).eq('id', id);
    await loadExpenses();
    showToast('✓ Fiş güncellendi!');
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setIsUploadModalOpen(true);
  };

  const handleModalClose = () => {
    setIsUploadModalOpen(false);
    setEditingExpense(null);
    setSkipToForm(false);
  };

  const handleModalSave = async (expenseData) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, expenseData);
    } else {
      const { imageData, ...expenseWithoutImage } = expenseData;
      const newExpense = await addExpense(expenseWithoutImage);
      // Eğer görsel varsa Supabase Storage'a yükle
      if (imageData && newExpense) {
        const base64Data = imageData.replace(/^data:.+;base64,/, '');
        const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const filePath = `${user.id}/${newExpense.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, byteArray, { contentType: 'image/jpeg', upsert: true });
        if (!uploadError) {
          await supabase.from('expenses').update({ has_receipt: true, receipt_path: filePath }).eq('id', newExpense.id);
          await loadExpenses();
        }
      }
    }
    handleModalClose();
  };

  const exportCSV = () => {
    if (!expenses.length) { showToast('⚠️ Dışa aktarılacak veri yok'); return; }
    const header = ['Tarih', 'Fiş No', 'Açıklama', 'Tutar', 'Döviz', 'EUR Karşılığı', 'Kategori', 'Otel', 'Not'];
    const rows = expenses.map(e => [
      e.tarih || '', e.fisno || '', e.aciklama || '',
      e.tutar || '', e.currency || 'EUR', e.eur_amount || '',
      e.kategori || '', e.otel || '', e.notiz || ''
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `belegliste_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('✓ CSV indirildi!');
  };

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const viewTitles = {
    dashboard: 'TripInConnect <span>Dashboard</span>',
    fis: 'Beleg <span>Liste</span>',
    rezervasyon: 'Reservierung <span>Verwaltung</span>',
    musteriler: 'Kunden',
    marketing: 'Marketing <span>Etkinlikleri</span>',
    butce: 'Agentur',
    takvim: 'Etkinlik <span>Takvimi</span>',
    ziyaret: 'Ziyaret <span>Raporları</span>',
    rapor: 'Berichte',
    istatistik: 'İstatistikler <span>& Analizler</span>'
  };

  // Auth yüklenirken boş ekran
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0f12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#334155', fontSize: '13px' }}>Laden...</div>
      </div>
    );
  }

  // Giriş yapılmamışsa Login ekranı
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="layout">
      <Sidebar 
        key={profileRefreshKey}
        currentView={currentView}
        setCurrentView={setCurrentView}
        expenses={expenses}
        onProfileClick={() => setIsProfileModalOpen(true)}
      />
      
      <main className="main">
        <Header 
          title={viewTitles[currentView]}
          onExport={exportCSV}
          onAddExpense={() => setIsUploadModalOpen(true)}
          onImport={() => setIsImportModalOpen(true)}
          onSettings={() => setIsSettingsModalOpen(true)}
          onLogout={handleLogout}
          userEmail={user?.email}
        />
        
        <div className="content">
          {currentView === 'dashboard' && <Dashboard marketingEvents={marketingEvents} reservations={reservations} exchangeRates={exchangeRates} agenturData={agenturData} />}
          {currentView === 'fis' && (
            <ExpenseList 
              expenses={expenses}
              onDelete={deleteExpense}
              onEdit={handleEdit}
              onScanExpense={() => { setSkipToForm(false); setIsUploadModalOpen(true); }}
              onAddExpense={() => { setSkipToForm(true); setIsUploadModalOpen(true); }}              exchangeRates={exchangeRates}            />
          )}
          {currentView === 'butce' && (
            <BudgetView 
              categories={categories}
              setCategories={setCategories}
              agenturData={agenturData}
              setAgenturData={setAgenturData}
              reservations={reservations}
            />
          )}
          {currentView === 'rapor' && (
            <ReportView
              expenses={expenses}
              onExport={exportCSV}
              reservations={reservations}
              agenturData={agenturData}
              categories={categories}
            />
          )}
          {currentView === 'rezervasyon' && (
            <ReservationsView 
              reservations={reservations}
              onAddReservation={addReservation}
              onBulkAddReservations={bulkAddReservations}
              onDelete={deleteReservation}
              onBulkDelete={bulkDeleteReservations}
              onEdit={(reservation) => updateReservation(reservation)}
              exchangeRates={exchangeRates}
              agenturData={agenturData}
              categories={categories}
            />
          )}
          {currentView === 'musteriler' && (
            <CustomersView 
              reservations={reservations}
              exchangeRates={exchangeRates}
            />
          )}
        </div>
      </main>

      {isUploadModalOpen && (
        <UploadModal 
          onClose={handleModalClose}
          onSave={handleModalSave}
          editingExpense={editingExpense}
          showToast={showToast}
          skipToForm={skipToForm}
          exchangeRates={exchangeRates}
        />
      )}

      {isImportModalOpen && (
        <ImportModal 
          onClose={() => setIsImportModalOpen(false)}
          onSave={addExpense}
          showToast={showToast}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsModalOpen(false)}
          showToast={showToast}
          userEmail={user?.email}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal 
          onClose={() => setIsProfileModalOpen(false)}
          showToast={showToast}
          onProfileUpdated={() => setProfileRefreshKey(prev => prev + 1)}
          userEmail={user?.email}
        />
      )}

      <Toast show={toast.show} message={toast.message} />
    </div>
  );
}

export default App;
