import React, { useState, useEffect } from 'react';

function Sidebar({ currentView, setCurrentView, expenses, onProfileClick }) {
  const [profile, setProfile] = useState({ firstName: '', lastName: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings();
      if (settings.profile) {
        setProfile(settings.profile);
      }
    }
  };

  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then(s => {
        if (s.userEmail) setUserEmail(s.userEmail);
      });
    }
  }, []);

  const displayName = (profile.firstName && profile.lastName)
    ? `${profile.firstName} ${profile.lastName}`
    : (userEmail ? userEmail.split('@')[0] : '');

  return (
    <aside className="sidebar">
      <div className="logo">
          <div className="logo-text">TripInConnect</div>
        <div className="logo-sub">{displayName}</div>
      </div>
      
      <nav className="nav">
        <div 
          className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          <span className="nav-icon">📊</span> Dashboard
        </div>
        <div 
          className={`nav-item ${currentView === 'rezervasyon' ? 'active' : ''}`}
          onClick={() => setCurrentView('rezervasyon')}
        >
          <span className="nav-icon">🏨</span> Reservierungen
        </div>
        <div 
          className={`nav-item ${currentView === 'musteriler' ? 'active' : ''}`}
          onClick={() => setCurrentView('musteriler')}
        >
          <span className="nav-icon">👥</span> Kunden
        </div>
        <div 
          className={`nav-item ${currentView === 'fis' ? 'active' : ''}`}
          onClick={() => setCurrentView('fis')}
        >
          <span className="nav-icon">🧾</span> Ausgaben
        </div>
        <div 
          className={`nav-item ${currentView === 'butce' ? 'active' : ''}`}
          onClick={() => setCurrentView('butce')}
        >
          <span className="nav-icon">💰</span> Agentur
        </div>
        <div 
          className={`nav-item ${currentView === 'rapor' ? 'active' : ''}`}
          onClick={() => setCurrentView('rapor')}
        >
          <span className="nav-icon">📄</span> Berichte
        </div>
      </nav>
      
      <div className="sidebar-profile">
        <button 
          className="profile-btn" 
          onClick={onProfileClick}
          title="Profil Einstellungen"
        >
          <div className="profile-avatar">
            {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div className="profile-info">
            <div className="profile-name">{displayName}</div>
            <div className="profile-link">Profil bearbeiten</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
