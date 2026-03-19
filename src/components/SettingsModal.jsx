import React, { useState, useEffect } from 'react';

function SettingsModal({ onClose, showToast, userEmail }) {
  const [storageFolder, setStorageFolder] = useState('');
  const [workspaceName, setWorkspaceName] = useState('workspace_1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  
  // Backup states
  const [backupFolder, setBackupFolder] = useState('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings();
      setStorageFolder(settings.storageFolder || '');
      setWorkspaceName(settings.workspaceName || 'workspace_1');
      setBackupFolder(settings.backupFolder || '');
      setAutoBackupEnabled(settings.autoBackupEnabled !== false); // Default true
      
      // Load backup list if backup folder is set
      if (settings.backupFolder) {
        loadBackups();
      }
    }
    setLoading(false);
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      if (window.electronAPI) {
        const backupList = await window.electronAPI.listBackups();
        setBackups(backupList);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
    }
    setLoadingBackups(false);
  };

  const handleSelectBackupFolder = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.selectFolder();
      if (result.success && result.path) {
        setBackupFolder(result.path);
        showToast('✓ Sicherungsordner ausgewählt');
      }
    }
  };

  const handleSelectFolder = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.selectFolder();
      if (result.success && result.path) {
        setStorageFolder(result.path);
        showToast('✓ Ordner ausgewählt');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.updateSettings({ 
          storageFolder,
          userName: userEmail || '',
          workspaceName,
          backupFolder,
          autoBackupEnabled
        });
        showToast('✓ Einstellungen gespeichert');
        setTimeout(() => onClose(), 500);
      }
    } catch (error) {
      showToast('⚠️ Einstellungen konnten nicht gespeichert werden');
    }
    setSaving(false);
  };

  const handleCreateBackup = async () => {
    if (!backupFolder) {
      showToast('⚠️ Bitte wählen Sie zuerst einen Sicherungsordner aus');
      return;
    }

    setCreatingBackup(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.createBackup();
        
        if (result.success) {
          showToast(result.message);
          loadBackups(); // Refresh backup list
        } else {
          showToast(`⚠️ ${result.message}`);
        }
      }
    } catch (error) {
      showToast('⚠️ Sicherungsfehler: ' + error.message);
    }
    setCreatingBackup(false);
  };

  const handleRestoreBackup = async (filename) => {
    const confirmed = confirm(
      `⚠️ ACHTUNG!\n\n` +
      `Dieser Vorgang ersetzt alle aktuellen Daten (Reservierungen und Belege) mit der ausgewählten Sicherung.\n\n` +
      `Sicherung: ${filename}\n\n` +
      `Möchten Sie fortfahren?`
    );

    if (!confirmed) return;

    setRestoringBackup(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.restoreBackup(filename);
        
        if (result.success) {
          showToast(result.message);
          // Reload app to reflect restored data
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showToast(`⚠️ ${result.message}`);
        }
      }
    } catch (error) {
      showToast('⚠️ Wiederherstellungsfehler: ' + error.message);
    }
    setRestoringBackup(false);
  };

  const handleMigrate = async () => {
    if (!storageFolder) {
      showToast('⚠️ Bitte wählen Sie zuerst einen Ordner aus');
      return;
    }

    const confirmed = confirm(
      '📦 Alle aktuellen Daten (Ausgaben, Events, Besuchsberichte) werden in den ausgewählten Ordner verschoben.\n\n' +
      `Ziel: ${storageFolder}\n\n` +
      'Möchten Sie fortfahren?'
    );

    if (!confirmed) return;

    setMigrating(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.migrateToCustomStorage();
        
        if (result.success) {
          showToast(result.message);
          // Daten neu laden
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showToast(`⚠️ ${result.message}`);
        }
      }
    } catch (error) {
      showToast('⚠️ Migrationsfehler: ' + error.message);
    }
    setMigrating(false);
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

              {/* Datenspeicher-Ordner */}
              <div className="settings-section">
                <div className="settings-label">
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>📁 Datenspeicher-Ordner</span>
                </div>
                <div className="settings-description">
                  Wählen Sie den Ordner, in dem alle Daten (Belege, Marketing-Events, Besuchsberichte, Belegbilder) gespeichert werden.
                  Standard: Anwendungsdatenordner. Im ausgewählten Ordner werden <code>expenses.json</code>, <code>marketingEvents.json</code>, <code>visitReports.json</code> erstellt.
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ 
                    flex: 1,
                    padding: '12px 16px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: storageFolder ? 'var(--text)' : 'var(--text3)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {storageFolder || 'Standardordner wird verwendet...'}
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSelectFolder}
                    style={{ flexShrink: 0 }}
                  >
                    📂 Ordner wählen
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>
                  💡 Dateistruktur: <code>/ordner/expenses.json</code>, <code>/ordner/marketingEvents.json</code>, <code>/ordner/visitReports.json</code>, <code>/ordner/receipts/jahr/monat/</code>
                </div>

                {storageFolder && (
                  <div style={{ 
                    marginTop: '16px',
                    padding: '16px',
                    background: 'rgba(0,229,160,0.08)',
                    border: '1px solid rgba(0,229,160,0.2)',
                    borderRadius: '10px'
                  }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      color: 'var(--accent)',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      📦 Datenmigration
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px', lineHeight: '1.5' }}>
                      Verschieben Sie Ihre aktuellen Daten aus dem Electron-Store in den ausgewählten Ordner.
                      Alle Ausgaben, Marketing-Events und Besuchsberichte werden in JSON-Dateien exportiert.
                    </div>
                    <button 
                      className="btn btn-accent" 
                      onClick={handleMigrate}
                      disabled={migrating}
                      style={{ width: '100%' }}
                    >
                      {migrating ? '🔄 Wird migriert...' : '🚀 Daten migrieren'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }}></div>

              {/* Backup System */}
              <div className="settings-section">
                <div className="settings-label">
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>🔄 Automatische Sicherung</span>
                </div>
                <div className="settings-description">
                  Sichern Sie Ihre Reservierungen und Belege automatisch. 
                  Bei aktivierter täglicher Sicherung werden beim ersten Öffnen des Tages die letzten 7 Tage gespeichert.
                </div>

                {/* Backup Folder Selection */}
                <div style={{ marginTop: '16px' }}>
                  <label className="form-label">Sicherungsordner</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ 
                      flex: 1,
                      padding: '12px 16px',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: backupFolder ? 'var(--text)' : 'var(--text3)',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {backupFolder || 'Kein Sicherungsordner ausgewählt...'}
                    </div>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSelectBackupFolder}
                      style={{ flexShrink: 0 }}
                    >
                      📂 Auswählen
                    </button>
                  </div>
                </div>

                {/* Auto Backup Toggle */}
                <div style={{ 
                  marginTop: '16px',
                  padding: '14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      Tägliche Automatische Sicherung
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                      Beim ersten Öffnen des Tages wird automatisch eine Sicherung erstellt (letzte 7 Tage werden aufbewahrt)
                    </div>
                  </div>
                  <label style={{ 
                    position: 'relative', 
                    display: 'inline-block',
                    width: '48px',
                    height: '26px',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={autoBackupEnabled}
                      onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: autoBackupEnabled ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '13px',
                      transition: '0.3s',
                      cursor: 'pointer'
                    }}>
                      <span style={{
                        position: 'absolute',
                        height: '20px',
                        width: '20px',
                        left: autoBackupEnabled ? '25px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>

                {/* Manual Backup Actions */}
                {backupFolder && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn btn-accent" 
                      onClick={handleCreateBackup}
                      disabled={creatingBackup}
                      style={{ flex: 1 }}
                    >
                      {creatingBackup ? '⏳ Wird gesichert...' : '💾 Jetzt Sichern'}
                    </button>
                  </div>
                )}

                {/* Backup List */}
                {backupFolder && backups.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      color: 'var(--text2)',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      📈 Vorhandene Sicherungen ({backups.length})
                    </div>
                    <div style={{ 
                      maxHeight: '240px',
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--bg2)'
                    }}>
                      {backups.map((backup, index) => (
                        <div 
                          key={backup.filename}
                          style={{
                            padding: '12px 14px',
                            borderBottom: index < backups.length - 1 ? '1px solid var(--border)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontSize: '12px', 
                              fontWeight: '600',
                              color: 'var(--text)',
                              marginBottom: '4px'
                            }}>
                              {backup.dateFormatted}
                            </div>
                            <div style={{ 
                              fontSize: '11px', 
                              color: 'var(--text3)',
                              fontFamily: 'monospace'
                            }}>
                              {backup.filename} • {backup.size} MB
                            </div>
                          </div>
                          <button 
                            className="btn btn-outline"
                            onClick={() => handleRestoreBackup(backup.filename)}
                            disabled={restoringBackup}
                            style={{ 
                              padding: '6px 12px',
                              fontSize: '11px',
                              flexShrink: 0
                            }}
                          >
                            {restoringBackup ? '⏳' : '↩️ Wiederherstellen'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'var(--text3)', 
                      marginTop: '8px',
                      textAlign: 'center'
                    }}>
                      💡 Sicherungen älter als 7 Tage werden automatisch gelöscht
                    </div>
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
