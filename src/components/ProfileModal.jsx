import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function ProfileModal({ onClose, showToast, onProfileUpdated, userEmail }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    position: '',
    email: '',
    phone: '',
    iban: '',
    bic: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
    if (data?.profile) {
      setFormData(prev => ({ ...data.profile, email: userEmail || data.profile.email || '' }));
    } else if (userEmail) {
      setFormData(prev => ({ ...prev, email: userEmail }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName) {
      showToast('⚠️ Vor- und Nachname sind erforderlich!');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      user_email: userEmail || '',
      profile: formData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    showToast('✓ Profil gespeichert!');
    if (onProfileUpdated) onProfileUpdated();
    onClose();
  };

  const handleSelectFolder = async () => {
    // Native klasör seçimi web'de mevcut değil
    showToast('ℹ️ Bu özellik web versiyonunda geçerli değil.');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <div className="modal-title">👤 Profil & Einstellungen</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Vorname *</label>
              <input
                type="text"
                className="form-input"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Vorname"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nachname *</label>
              <input
                type="text"
                className="form-input"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Nachname"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Firma</label>
              <input
                type="text"
                className="form-input"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Firmenname"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Pozisyon</label>
              <input
                type="text"
                className="form-input"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="Position / Berufsbezeichnung"
              />
            </div>

            <div className="form-group">
              <label className="form-label">E-Mail</label>
              <input
                type="email"
                className="form-input"
                name="email"
                value={userEmail || formData.email}
                readOnly
                style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--surface2)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input
                type="tel"
                className="form-input"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+43 / +49 / +41 ..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">IBAN</label>
              <input
                type="text"
                className="form-input"
                name="iban"
                value={formData.iban}
                onChange={handleChange}
                placeholder="AT00 0000 0000 0000 0000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">BIC</label>
              <input
                type="text"
                className="form-input"
                name="bic"
                value={formData.bic}
                onChange={handleChange}
                placeholder="XXXXXX00XXX"
              />
            </div>
          </div>

          <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            background: 'rgba(0,229,160,0.1)', 
            border: '1px solid rgba(0,229,160,0.3)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text2)'
          }}>
            💡 <strong>Hinweis:</strong> Diese Informationen werden in Excel-Berichten und in der Anwendung verwendet.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-accent" onClick={handleSave}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
