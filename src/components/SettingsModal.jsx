import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function SettingsModal({ onClose, showToast, userEmail }) {
  const [githubToken, setGithubToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Buchungssystem states
  const [buchungssystem, setBuchungssystem] = useState('myJACK');
  const [apiKey, setApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
      if (data?.github_token) setGithubToken(data.github_token);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_settings').upsert({
          user_id: user.id,
          user_email: userEmail || '',
          github_token: githubToken,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        showToast('✓ Einstellungen gespeichert');
        setTimeout(() => onClose(), 500);
      }
    } catch (error) {
      showToast('⚠️ Einstellungen konnten nicht gespeichert werden');
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div className="modal-title">⚙️ Einstellungen</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)' }}>
              Wird geladen...
            </div>
          ) : (
            <>
              {/* Benutzerdaten */}
              <div className="settings-section">
                <div className="settings-label">
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>👤 Benutzerdaten</span>
                </div>
                <div className="settings-description">
                  Diese Informationen werden automatisch zu allen Ihren Einträgen hinzugefügt.
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Benutzername</label>
                  <input
                    className="form-input"
                    type="text"
                    value={userEmail || ''}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--surface2)' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                    Erscheint im Feld „created_by“ aller Einträge.
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Firma / Workspace-Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={workspaceName}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--surface2)' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                    Erscheint im Feld „workspace_id“ aller Einträge.
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }}></div>

              {/* KI-Integration */}
              <div className="settings-section">
                <div className="settings-label">
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>🤖 KI-Integration</span>
                </div>
                <div className="settings-description">
                  GitHub Models API Token für die KI-Beleganalyse (GitHub Models GPT-4o).
                </div>
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">GitHub Token</label>
                  <input
                    className="form-input"
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    autoComplete="off"
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                    GitHub → Settings → Developer settings → Personal access tokens
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }}></div>

              {/* Buchungssystem */}
              <div className="settings-section">
                <div className="settings-label">
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>🔌 Buchungssystem</span>
                </div>
                <div className="settings-description">
                  Verbinden Sie TripINconnect mit Ihrem Buchungssystem, um Reservierungen zu synchronisieren.
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">System</label>
                  <select
                    className="form-input"
                    value={buchungssystem}
                    onChange={(e) => { setBuchungssystem(e.target.value); setConnectionStatus('disconnected'); setLastSync(null); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="myJACK">myJACK</option>
                    <option value="NEO">NEO</option>
                    <option value="Manuel">Manuel</option>
                  </select>
                </div>

                {buchungssystem !== 'Manuel' && (
                  <>
                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label className="form-label">API-Schlüssel</label>
                      <input
                        className="form-input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="API-Schlüssel eingeben…"
                        autoComplete="off"
                      />
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => showToast('⚠️ API-Verbindung noch nicht implementiert')}
                        disabled={!apiKey.trim()}
                        style={{ flexShrink: 0 }}
                      >
                        🔗 Verbinden
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: connectionStatus === 'connected' ? '#22c55e' : '#ef4444',
                          flexShrink: 0
                        }} />
                        <span style={{ fontSize: '13px', color: 'var(--text2)' }}>
                          {connectionStatus === 'connected' ? 'Verbunden' : 'Getrennt'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '10px' }}>
                      Letzte Synchronisierung:{' '}
                      <span style={{ color: 'var(--text2)' }}>
                        {lastSync ? new Date(lastSync).toLocaleString('de-DE') : '—'}
                      </span>
                    </div>
                  </>
                )}

                {buchungssystem === 'Manuel' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text3)',
                    lineHeight: '1.5'
                  }}>
                    Im manuellen Modus werden Reservierungen ausschließlich über den Import oder manuellen Eintrag erfasst. Keine API-Verbindung erforderlich.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button 
                  className="btn btn-accent" 
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {saving ? 'Wird gespeichert...' : '💾 Speichern'}
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={onClose}
                  disabled={saving}
                >
                  Abbrechen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
