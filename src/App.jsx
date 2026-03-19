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
  'ANEX|ANEX Tour',
  'XANE|ANEX Tour dynamisch',
  'BU|BUCHER Reisen',
  'XBU|GoBUCHER!',
  'COR|Coral Travel',
  'COS|Coral Travel Schweiz',
  'DER|DERTOUR',
  'DERT|DERTOUR International',
  'ITS|ITS Reisen',
  'ITSX|ITS INDI',
  'NEC|Neckermann Reisen',
  'XNEC|Neckermann Reisen dynamisch',
  'OGE|ÖGER TOURS',
  'XOGE|ÖGER TOURS dynamisch',
  'SLR|schauinsland-reisen',
  'SLRD|schauinsland-dynamisch',
  'ALL|alltours',
  'FER|FERIEN Touristik',
  'LMX|LMX Touristik',
  'VTO|vtours',
  'VTOI|vtours international',
  'SIT|spica.travel',
  'FALK|FalkTravel',
  'BCH|Bentour Reisen',
  'TJAX|TRAVELIX',
  'XPUR|ITT XPUR',
  'BYE|byebye'
];

function App() {
  // --------- Auth ---------
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // userReady: setCurrentUser IPC çağrısı tamamlandıktan sonra true olur
  // Veri yüklemeleri ancak o zaman başlar
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    // Mevcut oturumu kontrol et
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && window.electronAPI) {
        await window.electronAPI.setCurrentUser(session.user.id, session.user.email);
        setUser(session.user);
        setUserReady(true);
      }
      setAuthLoading(false);
    });
    // Oturum değişikliklerini dinle (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user && window.electronAPI) {
        await window.electronAPI.setCurrentUser(session.user.id, session.user.email);
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
      setCategories(parsed.length > 0 && !parsed[0].includes('|') ? DEFAULT_CATEGORIES : parsed);
    } else {
      setCategories(DEFAULT_CATEGORIES);
    }
    const savedAg = localStorage.getItem(agKey);
    setAgenturData(savedAg ? JSON.parse(savedAg) : {});
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

  // categories değişince yeni kodlar için default giriş oluştur
  useEffect(() => {
    setAgenturData(prev => {
      const updated = { ...prev };
      let changed = false;
      categories.forEach(cat => {
        const code = cat.includes('|') ? cat.split('|')[0] : cat;
        if (!updated[code]) {
          updated[code] = { provPct: 10, zusatzprovision: '', zusatzPct: '', berechnung: 'Abreisedatum', tage: '30' };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [categories]);
  
  const fetchExchangeRates = async () => {
    if (window.electronAPI && window.electronAPI.getExchangeRates) {
      try {
        const result = await window.electronAPI.getExchangeRates();
        if (result.success && result.data && result.data.rates) {
          setExchangeRates({
            EUR: 1,
            USD: 1 / result.data.rates.USD,
            GBP: 1 / result.data.rates.GBP,
            TRY: 1 / result.data.rates.TRY,
            CZK: 1 / result.data.rates.CZK
          });
        }
      } catch (error) {
        console.error('Döviz kurları alınamadı:', error);
      }
    }
  };

  const loadExpenses = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.getExpenses();
      setExpenses(data);
    }
  };

  const loadMarketingEvents = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.getMarketingEvents();
      setMarketingEvents(data || []);
    }
  };

  const loadVisitReports = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.getVisitReports();
      setVisitReports(data || []);
    }
  };

  const loadReservations = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.getReservations();
      setReservations(data);
    }
  };

  const addReservation = async (reservation) => {
    if (window.electronAPI) {
      const newReservation = await window.electronAPI.addReservation(reservation);
      await loadReservations();
      showToast('✓ Rezervasyon kaydedildi!');
      return newReservation;
    }
  };

  const deleteReservation = async (id) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteReservation(id);
      await loadReservations();
      showToast('🗑 Rezervasyon silindi');
    }
  };

  const updateReservation = async (reservation) => {
    if (window.electronAPI) {
      await window.electronAPI.updateReservation(reservation.id, reservation);
      await loadReservations();
      showToast('✓ Rezervasyon güncellendi!');
    }
  };

  const addMarketingEvent = async (event) => {
    if (window.electronAPI) {
      await window.electronAPI.addMarketingEvent(event);
      await loadMarketingEvents();
      showToast('✓ Etkinlik kaydedildi!');
    }
  };

  const deleteMarketingEvent = async (id) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteMarketingEvent(id);
      await loadMarketingEvents();
      showToast('🗑 Etkinlik silindi');
    }
  };

  const updateMarketingEvent = async (event) => {
    if (window.electronAPI) {
      await window.electronAPI.updateMarketingEvent(event.id, event);
      await loadMarketingEvents();
      showToast('✓ Etkinlik güncellendi!');
    }
  };

  const addVisitReport = async (report) => {
    if (window.electronAPI) {
      await window.electronAPI.addVisitReport(report);
      await loadVisitReports();
      showToast('✓ Rapor kaydedildi!');
    }
  };

  const deleteVisitReport = async (id) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteVisitReport(id);
      await loadVisitReports();
      showToast('🗑 Rapor silindi');
    }
  };

  const updateVisitReport = async (report) => {
    if (window.electronAPI) {
      await window.electronAPI.updateVisitReport(report.id, report);
      await loadVisitReports();
      showToast('✓ Rapor güncellendi!');
    }
  };

  const addExpense = async (expense) => {
    if (window.electronAPI) {
      // EUR karşılığını hesapla (eğer manuel girilmediyse)
      const rate = exchangeRates[expense.currency] || 1;
      
      // Kullanıcı manuel eurAmount girdiyse onu kullan, yoksa otomatik hesapla
      const eurAmount = expense.eurAmount && expense.eurAmount !== '' 
        ? parseFloat(expense.eurAmount) 
        : parseFloat(expense.tutar) * rate;
      
      const expenseWithEur = {
        ...expense,
        eurAmount: eurAmount.toFixed(2),
        exchangeRate: rate // Kullanılan kur da kaydedilsin
      };
      
      const newExpense = await window.electronAPI.addExpense(expenseWithEur);
      await loadExpenses();
      showToast('✓ Fiş kaydedildi!');
      return newExpense;
    }
  };

  const deleteExpense = async (id) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteExpense(id);
      await loadExpenses();
      showToast('🗑 Fiş silindi');
    }
  };

  const updateExpense = async (id, expense) => {
    if (window.electronAPI) {
      // Eğer tutar veya para birimi değiştiyse EUR karşılığını yeniden hesapla
      let expenseToUpdate = { ...expense };
      
      if (expense.tutar && expense.currency) {
        const rate = exchangeRates[expense.currency] || 1;
        
        // Kullanıcı manuel eurAmount girdiyse onu kullan, yoksa otomatik hesapla
        const eurAmount = expense.eurAmount && expense.eurAmount !== '' 
          ? parseFloat(expense.eurAmount) 
          : parseFloat(expense.tutar) * rate;
        
        expenseToUpdate.eurAmount = eurAmount.toFixed(2);
        expenseToUpdate.exchangeRate = rate;
      }
      
      await window.electronAPI.updateExpense(id, expenseToUpdate);
      await loadExpenses();
      showToast('✓ Fiş güncellendi!');
    }
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
      // Düzenleme modu
      await updateExpense(editingExpense.id, expenseData);
    } else {
      // Yeni ekleme
      // Önce görseli ayır
      const { imageData, ...expenseWithoutImage } = expenseData;
      
      // Expense'i kaydet
      const newExpense = await addExpense(expenseWithoutImage);
      
      // Eğer görsel varsa, kaydet (tarihle birlikte)
      if (imageData && newExpense && window.electronAPI) {
        const saveResult = await window.electronAPI.saveReceipt(
          imageData, 
          newExpense.id, 
          expenseWithoutImage.tarih // Fiş tarihi ile klasörle
        );
        
        if (saveResult.success) {
          // Receipt path'i güncelle - newExpense'deki tüm verileri koru (eurAmount dahil)
          await window.electronAPI.updateExpense(newExpense.id, {
            ...newExpense,
            receiptPath: saveResult.path,
            hasReceipt: true
          });
          await loadExpenses();
        }
      }
    }
    handleModalClose();
  };

  const exportCSV = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.exportCSV();
      if (result.success) {
        showToast('✓ CSV başarıyla kaydedildi!');
      } else {
        showToast('⚠️ ' + result.message);
      }
    }
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
          {currentView === 'dashboard' && <Dashboard marketingEvents={marketingEvents} reservations={reservations} exchangeRates={exchangeRates} />}
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
              onDelete={deleteReservation}
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
