const Store = require('electron-store');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const extract = require('extract-zip');

// Electron app reference (set during initialization)
let electronApp = null;

// Aktif kullanıcı ID'si — Supabase UUID
let currentUserId = null;

const STORE_DEFAULTS = {
  expenses: [],
  marketingEvents: [],
  visitReports: [],
  reservations: [],
  settings: {
    aiProvider: 'claude',
    claudeApiKey: '',
    githubToken: '',
    storageFolder: '',
    backupFolder: '',
    autoBackupEnabled: true,
    backupRetentionDays: 7,
    migrationCompleted: false,
    userName: '',
    workspaceName: 'workspace_1',
    userEmail: '',
    licenseKey: '',
    licensePlan: 'free',
    licenseExpiry: null,
    lastLicenseCheck: null,
    sessionToken: ''
  }
};

// Başlangıçta geçici store (login öncesi — sadece app-level settings için)
let store = new Store({ name: 'marketing-desk-app', defaults: STORE_DEFAULTS });

/**
 * Kullanıcı giriş yaptığında çağrılır.
 * Her kullanıcı kendi izole store + userData subdirectory'sini kullanır.
 */
function setCurrentUser(userId, userEmail) {
  if (!userId) return;
  currentUserId = userId;
  const safeName = `mkt-${userId.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 40)}`;
  store = new Store({ name: safeName, defaults: STORE_DEFAULTS });
  console.log(`[DB] User store switched → ${store.path}`);

  // İlk girişte userName + userEmail'i email'den otomatik doldur
  const settings = store.get('settings', {});
  if (!settings.userName && userEmail) {
    const emailPrefix = userEmail.split('@')[0];
    store.set('settings.userName', emailPrefix);
    store.set('settings.userEmail', userEmail);
    console.log(`[DB] Auto-set userName: ${emailPrefix}`);
  }
}

// Set Electron app reference for userData path access
function setElectronApp(app) {
  electronApp = app;
}

// Yardımcı fonksiyonlar

// User-selected folder - ONLY for reading/importing external files
function getImportFolder() {
  const settings = store.get('settings', {});
  return settings.storageFolder || '';
}

// App-owned data paths — kullanıcıya göre izole subdirectory
function getUserDataPath() {
  if (!electronApp) {
    throw new Error('Electron app not initialized. Call setElectronApp() first.');
  }
  const base = electronApp.getPath('userData');
  if (currentUserId) {
    return path.join(base, 'users', currentUserId);
  }
  return base;
}

function getExpensesFilePath() {
  // Expenses stored in userData (app-owned)
  return path.join(getUserDataPath(), 'expenses.json');
}

function getReservationsFilePath() {
  // Reservations stored in userData (app-owned)
  return path.join(getUserDataPath(), 'reservations.json');
}

// Marketing events and visit reports remain in selected folder for now
function getMarketingEventsFilePath() {
  const folder = getImportFolder();
  return folder ? path.join(folder, 'marketingEvents.json') : null;
}

function getVisitReportsFilePath() {
  const folder = getImportFolder();
  return folder ? path.join(folder, 'visitReports.json') : null;
}

// Legacy paths (old location in selected folder)
function getLegacyExpensesFilePath() {
  const folder = getImportFolder();
  return folder ? path.join(folder, 'expenses.json') : null;
}

function getLegacyReservationsFilePath() {
  const folder = getImportFolder();
  return folder ? path.join(folder, 'reservations.json') : null;
}

function readJsonFile(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading JSON file:', error);
  }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing JSON file:', error);
    return false;
  }
}

function initDatabase() {
  // Initialize store
  if (!store.has('expenses')) {
    store.set('expenses', []);
  }
  if (!store.has('marketingEvents')) {
    store.set('marketingEvents', []);
  }
  if (!store.has('visitReports')) {
    store.set('visitReports', []);
  }
  if (!store.has('reservations')) {
    store.set('reservations', []);
  }
  if (!store.has('settings')) {
    store.set('settings', { 
      aiProvider: 'claude',
      claudeApiKey: '',
      githubToken: '',
      storageFolder: '',
      userName: '',
      workspaceName: 'workspace_1',
      userEmail: '',
      migrationCompleted: false
    });
  }
  console.log('Database initialized at:', store.path);
  console.log('UserData path:', electronApp ? getUserDataPath() : 'Not available yet');
}

// Safe migration from legacy storage (selected folder) to userData
function migrateLegacyData() {
  if (!electronApp) {
    console.warn('Cannot migrate: Electron app not initialized');
    return { success: false, message: 'App not initialized' };
  }

  const settings = getSettings();
  
  // Skip if migration already completed
  if (settings.migrationCompleted) {
    console.log('Migration already completed, skipping...');
    return { success: true, message: 'Already migrated', skipped: true };
  }

  let migratedCount = 0;
  const migrations = [];

  try {
    // EXPENSES MIGRATION
    const expensesPath = getExpensesFilePath();
    const legacyExpensesPath = getLegacyExpensesFilePath();
    
    if (!fs.existsSync(expensesPath)) {
      // userData file doesn't exist
      if (legacyExpensesPath && fs.existsSync(legacyExpensesPath)) {
        // Legacy file exists - migrate it
        const legacyData = readJsonFile(legacyExpensesPath, []);
        if (legacyData.length > 0) {
          writeJsonFile(expensesPath, legacyData);
          migratedCount += legacyData.length;
          migrations.push(`✓ Migrated ${legacyData.length} expenses from legacy location`);
          
          // Rename legacy file to .legacy
          fs.renameSync(legacyExpensesPath, legacyExpensesPath + '.legacy');
          migrations.push('  → Legacy expenses.json renamed to expenses.json.legacy');
        }
      }
    } else {
      migrations.push('✓ Expenses already in userData');
      
      // If both exist, keep userData as source of truth
      if (legacyExpensesPath && fs.existsSync(legacyExpensesPath)) {
        // Rename legacy file to prevent confusion
        if (!fs.existsSync(legacyExpensesPath + '.legacy')) {
          fs.renameSync(legacyExpensesPath, legacyExpensesPath + '.legacy');
          migrations.push('  → Legacy expenses.json preserved as expenses.json.legacy (not overwritten)');
        }
      }
    }

    // RESERVATIONS MIGRATION
    const reservationsPath = getReservationsFilePath();
    const legacyReservationsPath = getLegacyReservationsFilePath();
    
    if (!fs.existsSync(reservationsPath)) {
      // userData file doesn't exist
      if (legacyReservationsPath && fs.existsSync(legacyReservationsPath)) {
        // Legacy file exists - migrate it
        const legacyData = readJsonFile(legacyReservationsPath, []);
        if (legacyData.length > 0) {
          writeJsonFile(reservationsPath, legacyData);
          migratedCount += legacyData.length;
          migrations.push(`✓ Migrated ${legacyData.length} reservations from legacy location`);
          
          // Rename legacy file to .legacy
          fs.renameSync(legacyReservationsPath, legacyReservationsPath + '.legacy');
          migrations.push('  → Legacy reservations.json renamed to reservations.json.legacy');
        }
      }
    } else {
      migrations.push('✓ Reservations already in userData');
      
      // If both exist, keep userData as source of truth
      if (legacyReservationsPath && fs.existsSync(legacyReservationsPath)) {
        // Rename legacy file to prevent confusion
        if (!fs.existsSync(legacyReservationsPath + '.legacy')) {
          fs.renameSync(legacyReservationsPath, legacyReservationsPath + '.legacy');
          migrations.push('  → Legacy reservations.json preserved as reservations.json.legacy (not overwritten)');
        }
      }
    }

    // Mark migration as completed
    updateSettings({ migrationCompleted: true });
    migrations.push('✓ Migration completed');

    const result = {
      success: true,
      migratedCount,
      migrations,
      message: migrations.join('\n')
    };
    
    console.log('=== LEGACY DATA MIGRATION ===');
    console.log(result.message);
    console.log('============================');
    
    return result;

  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      error: error.message
    };
  }
}

function getSettings() {
  return store.get('settings', { 
    aiProvider: 'claude',
    claudeApiKey: '',
    githubToken: '',
    storageFolder: '',
    backupFolder: '',
    autoBackupEnabled: true,
    backupRetentionDays: 7,
    userName: '',
    workspaceName: 'workspace_1',
    userEmail: '',
    licenseKey: '',
    licensePlan: 'free',
    licenseExpiry: null,
    lastLicenseCheck: null,
    sessionToken: ''
  });
}

function updateSettings(settings) {
  const current = store.get('settings', {});
  const updated = { ...current, ...settings };
  store.set('settings', updated);
  return updated;
}

function getExpenses() {
  const filePath = getExpensesFilePath();
  
  // Always use userData storage for expenses
  const expenses = readJsonFile(filePath, []);
  
  // Apply data migration for workspace fields
  const migratedExpenses = expenses.map(expense => ({
    ...expense,
    workspace_id: expense.workspace_id || 'workspace_1',
    created_by: expense.created_by || settings.userName || '',
    role: expense.role || 'admin'
  }));
  
  return migratedExpenses.sort((a, b) => {
    if (b.tarih !== a.tarih) {
      return b.tarih.localeCompare(a.tarih);
    }
    return b.id - a.id;
  });
}

function addExpense(expense) {
  const filePath = getExpensesFilePath();
  const settings = getSettings();
  const newExpense = {
    id: Date.now(),
    tarih: expense.tarih,
    fisno: expense.fisno,
    aciklama: expense.aciklama,
    tutar: parseFloat(expense.tutar),
    currency: expense.currency || 'EUR',
    kategori: expense.kategori,
    otel: expense.otel || null,
    not: expense.not || null,
    hasReceipt: expense.hasReceipt ? 1 : 0,
    receiptPath: expense.receiptPath || null,
    workspace_id: settings.workspaceName || 'workspace_1',
    created_by: settings.userName || '',
    role: 'admin',
    createdAt: new Date().toISOString()
  };
  
  // Always write to userData
  const expenses = readJsonFile(filePath, []);
  expenses.push(newExpense);
  writeJsonFile(filePath, expenses);
  
  return newExpense;
}

function deleteExpense(id) {
  const filePath = getExpensesFilePath();
  
  // Always use userData
  const expenses = readJsonFile(filePath, []);
  const filtered = expenses.filter(e => e.id !== id);
  writeJsonFile(filePath, filtered);
  
  return { success: filtered.length < expenses.length };
}

function updateExpense(id, expense) {
  const filePath = getExpensesFilePath();
  
  // Always use userData
  const expenses = readJsonFile(filePath, []);
  const index = expenses.findIndex(e => e.id === id);
  
  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...expense };
    writeJsonFile(filePath, expenses);
    return { success: true };
  }
  
  return { success: false };
}

function getMarketingEvents() {
  const filePath = getMarketingEventsFilePath();
  
  if (filePath) {
    // Custom storage kullan
    const events = readJsonFile(filePath, []);
    // Mevcut verilere migration uygula
    const migratedEvents = events.map(event => ({
      ...event,
      workspace_id: event.workspace_id || 'workspace_1',
      created_by: event.created_by || '',
      role: event.role || 'admin'
    }));
    return migratedEvents.sort((a, b) => {
      if (b.tarih !== a.tarih) {
        return b.tarih.localeCompare(a.tarih);
      }
      return b.id - a.id;
    });
  } else {
    // Electron-store kullan
    const events = store.get('marketingEvents', []);
    // Mevcut verilere migration uygula
    const migratedEvents = events.map(event => ({
      ...event,
      workspace_id: event.workspace_id || 'workspace_1',
      created_by: event.created_by || '',
      role: event.role || 'admin'
    }));
    return migratedEvents.sort((a, b) => {
      if (b.tarih !== a.tarih) {
        return b.tarih.localeCompare(a.tarih);
      }
      return b.id - a.id;
    });
  }
}

function addMarketingEvent(event) {
  const filePath = getMarketingEventsFilePath();
  const settings = getSettings();
  const newEvent = {
    id: Date.now(),
    ...event,
    workspace_id: settings.workspaceName || 'workspace_1',
    created_by: settings.userName || '',
    role: 'admin',
    createdAt: new Date().toISOString()
  };
  
  if (filePath) {
    // Custom storage kullan
    const events = readJsonFile(filePath, []);
    events.push(newEvent);
    writeJsonFile(filePath, events);
  } else {
    // Electron-store kullan
    const events = store.get('marketingEvents', []);
    events.push(newEvent);
    store.set('marketingEvents', events);
  }
  
  return newEvent;
}

function deleteMarketingEvent(id) {
  const filePath = getMarketingEventsFilePath();
  
  if (filePath) {
    // Custom storage kullan
    const events = readJsonFile(filePath, []);
    const filtered = events.filter(e => e.id !== id);
    writeJsonFile(filePath, filtered);
    return { success: filtered.length < events.length };
  } else {
    // Electron-store kullan
    const events = store.get('marketingEvents', []);
    const filtered = events.filter(e => e.id !== id);
    store.set('marketingEvents', filtered);
    return { success: filtered.length < events.length };
  }
}

function updateMarketingEvent(id, event) {
  const filePath = getMarketingEventsFilePath();
  
  if (filePath) {
    // Custom storage kullan
    const events = readJsonFile(filePath, []);
    const index = events.findIndex(e => e.id === id);
    
    if (index !== -1) {
      events[index] = { ...events[index], ...event, id };
      writeJsonFile(filePath, events);
      return { success: true };
    }
    return { success: false };
  } else {
    // Electron-store kullan
    const events = store.get('marketingEvents', []);
    const index = events.findIndex(e => e.id === id);
    
    if (index !== -1) {
      events[index] = { ...events[index], ...event, id };
      store.set('marketingEvents', events);
      return { success: true };
    }
    return { success: false };
  }
}

function getVisitReports() {
  const filePath = getVisitReportsFilePath();
  
  if (filePath) {
    // Custom storage kullan
    const reports = readJsonFile(filePath, []);
    // Mevcut verilere migration uygula
    const migratedReports = reports.map(report => ({
      ...report,
      workspace_id: report.workspace_id || 'workspace_1',
      created_by: report.created_by || '',
      role: report.role || 'admin'
    }));
    return migratedReports.sort((a, b) => {
      if (b.date !== a.date) {
        return b.date.localeCompare(a.date);
      }
      return b.id - a.id;
    });
  } else {
    // Electron-store kullan
    const reports = store.get('visitReports', []);
    // Mevcut verilere migration uygula
    const migratedReports = reports.map(report => ({
      ...report,
      workspace_id: report.workspace_id || 'workspace_1',
      created_by: report.created_by || '',
      role: report.role || 'admin'
    }));
    return migratedReports.sort((a, b) => {
      if (b.date !== a.date) {
        return b.date.localeCompare(a.date);
      }
      return b.id - a.id;
    });
  }
}

function addVisitReport(report) {
  const filePath = getVisitReportsFilePath();
  const settings = getSettings();
  const newReport = {
    id: Date.now(),
    ...report,
    workspace_id: settings.workspaceName || 'workspace_1',
    created_by: settings.userName || '',
    role: 'admin',
    createdAt: new Date().toISOString()
  };
  
  if (filePath) {
    const reports = readJsonFile(filePath, []);
    reports.push(newReport);
    writeJsonFile(filePath, reports);
  } else {
    const reports = store.get('visitReports', []);
    reports.push(newReport);
    store.set('visitReports', reports);
  }
  
  return newReport;
}

function deleteVisitReport(id) {
  const filePath = getVisitReportsFilePath();
  
  if (filePath) {
    // Custom storage kullan
    const reports = readJsonFile(filePath, []);
    const filtered = reports.filter(r => r.id !== id);
    writeJsonFile(filePath, filtered);
    return { success: filtered.length < reports.length };
  } else {
    // Electron-store kullan
    const reports = store.get('visitReports', []);
    const filtered = reports.filter(r => r.id !== id);
    store.set('visitReports', filtered);
    return { success: filtered.length < reports.length };
  }
}

function updateVisitReport(id, report) {
  const filePath = getVisitReportsFilePath();
  
  if (filePath) {
    // Custom storage kullan
    const reports = readJsonFile(filePath, []);
    const index = reports.findIndex(r => r.id === id);
    
    if (index !== -1) {
      reports[index] = { ...reports[index], ...report, id };
      writeJsonFile(filePath, reports);
      return { success: true };
    }
    return { success: false };
  } else {
    // Electron-store kullan
    const reports = store.get('visitReports', []);
    const index = reports.findIndex(r => r.id === id);
    
    if (index !== -1) {
      reports[index] = { ...reports[index], ...report, id };
      store.set('visitReports', reports);
      return { success: true };
    }
    return { success: false };
  }
}

// Rezervasyon fonksiyonları
function getReservations() {
  const filePath = getReservationsFilePath();
  
  // Always use userData storage for reservations
  const reservations = readJsonFile(filePath, []);
  
  // Apply data migration for workspace fields
  const migratedReservations = reservations.map(reservation => ({
    ...reservation,
    workspace_id: reservation.workspace_id || 'workspace_1',
    created_by: reservation.created_by || '',
    role: reservation.role || 'admin'
  }));
  
  return migratedReservations.sort((a, b) => {
    if (b.abreise !== a.abreise) {
      return b.abreise.localeCompare(a.abreise);
    }
    return b.id - a.id;
  });
}

function addReservation(reservation) {
  const filePath = getReservationsFilePath();
  const settings = getSettings();
  const newReservation = {
    id: Date.now(),
    ...reservation,
    workspace_id: settings.workspaceName || 'workspace_1',
    created_by: settings.userName || '',
    role: 'admin',
    createdAt: new Date().toISOString()
  };
  
  const reservations = readJsonFile(filePath, []);
  reservations.push(newReservation);
  writeJsonFile(filePath, reservations);
  
  return newReservation;
}

function deleteReservation(id) {
  const filePath = getReservationsFilePath();
  
  // Always use userData
  const reservations = readJsonFile(filePath, []);
  const filtered = reservations.filter(r => r.id !== id);
  writeJsonFile(filePath, filtered);
  
  return { success: filtered.length < reservations.length };
}

function updateReservation(id, reservation) {
  const filePath = getReservationsFilePath();
  
  // Always use userData
  const reservations = readJsonFile(filePath, []);
  const index = reservations.findIndex(r => r.id === id);
  
  if (index !== -1) {
    reservations[index] = { ...reservations[index], ...reservation, id };
    writeJsonFile(filePath, reservations);
    return { success: true };
  }
  
  return { success: false };
}

// Migration: Electron-store to selected folder (for marketing events and visit reports only)
// Note: Expenses and reservations are now stored in userData, not in the selected folder
function migrateToCustomStorage() {
  const importFolder = getImportFolder();
  
  if (!importFolder) {
    return { 
      success: false, 
      message: 'Import folder ayarlanmamış. Lütfen önce ayarlardan klasör seçin.' 
    };
  }

  try {
    // Klasörü oluştur
    if (!fs.existsSync(importFolder)) {
      fs.mkdirSync(importFolder, { recursive: true });
    }

    let migratedCount = 0;

    // Marketing Events migration (still uses selected folder)
    const eventsFile = getMarketingEventsFilePath();
    if (eventsFile && !fs.existsSync(eventsFile)) {
      const events = store.get('marketingEvents', []);
      if (events.length > 0) {
        writeJsonFile(eventsFile, events);
        migratedCount += events.length;
        console.log(`✓ ${events.length} marketing events migrated`);
      }
    }

    // Visit Reports migration (still uses selected folder)
    const reportsFile = getVisitReportsFilePath();
    if (reportsFile && !fs.existsSync(reportsFile)) {
      const reports = store.get('visitReports', []);
      if (reports.length > 0) {
        writeJsonFile(reportsFile, reports);
        migratedCount += reports.length;
        console.log(`✓ ${reports.length} visit reports migrated`);
      }
    }

    // Note: Expenses and reservations are migrated separately via migrateLegacyData()
    // They are now stored in userData, not in the import folder

    return {
      success: true,
      message: `✓ ${migratedCount} kayıt başarıyla taşındı!`,
      importFolder,
      migratedCount
    };

  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      message: `Migration hatası: ${error.message}`
    };
  }
}

// ========== BACKUP SYSTEM ==========

// Get backup folder path
function getBackupFolder() {
  const settings = getSettings();
  return settings.backupFolder || '';
}

// Create backup filename with timestamp
function getBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '')
    .replace('T', '_');
  return `backup_${timestamp}.zip`;
}

// Create a backup (manual or automatic)
async function createBackup(isAutomatic = false) {
  if (!electronApp) {
    return { success: false, message: 'Electron app not initialized' };
  }

  const backupFolder = getBackupFolder();
  
  if (!backupFolder) {
    return { 
      success: false, 
      message: 'Backup klasörü ayarlanmamış. Lütfen ayarlardan klasör seçin.' 
    };
  }

  try {
    // Ensure backup folder exists
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    const backupFilename = getBackupFilename();
    const backupPath = path.join(backupFolder, backupFilename);

    // Create ZIP archive
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        const type = isAutomatic ? 'otomatik' : 'manuel';
        
        console.log(`✓ Backup created: ${backupFilename} (${sizeInMB} MB) - ${type}`);
        
        // Clean old backups after creating new one
        cleanOldBackups();
        
        resolve({
          success: true,
          message: `✓ Yedek başarıyla alındı! (${sizeInMB} MB)`,
          filename: backupFilename,
          size: sizeInMB,
          type,
          path: backupPath
        });
      });

      archive.on('error', (err) => {
        reject({ success: false, message: `Backup hatası: ${err.message}` });
      });

      archive.pipe(output);

      // Add files to archive
      const expensesPath = getExpensesFilePath();
      const reservationsPath = getReservationsFilePath();
      
      if (fs.existsSync(expensesPath)) {
        archive.file(expensesPath, { name: 'expenses.json' });
      }
      
      if (fs.existsSync(reservationsPath)) {
        archive.file(reservationsPath, { name: 'reservations.json' });
      }

      // Add settings (optional metadata)
      const settings = getSettings();
      archive.append(JSON.stringify(settings, null, 2), { name: 'settings.json' });

      archive.finalize();
    });

  } catch (error) {
    console.error('Backup error:', error);
    return {
      success: false,
      message: `Backup hatası: ${error.message}`
    };
  }
}

// List all available backups
function listBackups() {
  const backupFolder = getBackupFolder();
  
  if (!backupFolder || !fs.existsSync(backupFolder)) {
    return [];
  }

  try {
    const files = fs.readdirSync(backupFolder);
    const backups = files
      .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(backupFolder, file);
        const stats = fs.statSync(filePath);
        
        // Extract date from filename: backup_2026-03-18_09-30-00.zip
        const match = file.match(/backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
        let date = null;
        if (match) {
          const dateStr = `${match[1]}T${match[2].replace(/-/g, ':')}`;
          date = new Date(dateStr);
        }

        return {
          filename: file,
          path: filePath,
          date: date ? date.toISOString() : null,
          dateFormatted: date ? date.toLocaleString('de-DE') : 'Unknown',
          size: (stats.size / 1024 / 1024).toFixed(2), // MB
          createdAt: stats.birthtime.toISOString(),
          type: 'auto' // We can detect this from filename pattern later
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first

    return backups;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

// Restore from backup
async function restoreFromBackup(filename) {
  if (!electronApp) {
    return { success: false, message: 'Electron app not initialized' };
  }

  const backupFolder = getBackupFolder();
  
  if (!backupFolder) {
    return { success: false, message: 'Backup klasörü bulunamadı' };
  }

  const backupPath = path.join(backupFolder, filename);
  
  if (!fs.existsSync(backupPath)) {
    return { success: false, message: 'Backup dosyası bulunamadı' };
  }

  try {
    const tempDir = path.join(getUserDataPath(), 'temp_restore');
    
    // Create temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Extract ZIP
    await extract(backupPath, { dir: tempDir });

    // Restore files
    const expensesBackup = path.join(tempDir, 'expenses.json');
    const reservationsBackup = path.join(tempDir, 'reservations.json');
    
    let restoredCount = 0;

    if (fs.existsSync(expensesBackup)) {
      fs.copyFileSync(expensesBackup, getExpensesFilePath());
      restoredCount++;
    }

    if (fs.existsSync(reservationsBackup)) {
      fs.copyFileSync(reservationsBackup, getReservationsFilePath());
      restoredCount++;
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true });

    return {
      success: true,
      message: `✓ ${restoredCount} dosya başarıyla geri yüklendi!`,
      restoredCount
    };

  } catch (error) {
    console.error('Restore error:', error);
    return {
      success: false,
      message: `Geri yükleme hatası: ${error.message}`
    };
  }
}

// Clean old backups (keep only last N days)
function cleanOldBackups() {
  const backupFolder = getBackupFolder();
  const settings = getSettings();
  const retentionDays = settings.backupRetentionDays || 7;
  
  if (!backupFolder || !fs.existsSync(backupFolder)) {
    return;
  }

  try {
    const files = fs.readdirSync(backupFolder);
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000; // Days to milliseconds

    let deletedCount = 0;

    files.forEach(file => {
      if (!file.startsWith('backup_') || !file.endsWith('.zip')) {
        return;
      }

      const filePath = path.join(backupFolder, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.birthtime.getTime();

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑 Deleted old backup: ${file}`);
      }
    });

    if (deletedCount > 0) {
      console.log(`✓ Cleaned ${deletedCount} old backup(s)`);
    }

  } catch (error) {
    console.error('Error cleaning old backups:', error);
  }
}

// Check if backup should run today (once per day)
function shouldRunDailyBackup() {
  const settings = getSettings();
  
  if (!settings.autoBackupEnabled) {
    return false;
  }

  const lastBackup = settings.lastAutoBackupDate;
  
  if (!lastBackup) {
    return true; // Never ran before
  }

  const lastDate = new Date(lastBackup);
  const today = new Date();
  
  // Check if last backup was on a different day
  return lastDate.toDateString() !== today.toDateString();
}

// Run daily automatic backup
async function runDailyBackup() {
  if (!shouldRunDailyBackup()) {
    console.log('Daily backup already completed today');
    return { success: true, skipped: true };
  }

  const backupFolder = getBackupFolder();
  
  if (!backupFolder) {
    console.log('Backup folder not configured, skipping daily backup');
    return { success: false, message: 'Backup folder not set' };
  }

  console.log('🔄 Running daily automatic backup...');
  
  const result = await createBackup(true); // isAutomatic = true
  
  if (result.success) {
    // Update last backup date
    updateSettings({ lastAutoBackupDate: new Date().toISOString() });
  }

  return result;
}

module.exports = {
  setElectronApp,
  setCurrentUser,
  initDatabase,
  migrateLegacyData,
  getExpenses,
  addExpense,
  deleteExpense,
  updateExpense,
  getMarketingEvents,
  addMarketingEvent,
  deleteMarketingEvent,
  updateMarketingEvent,
  getVisitReports,
  addVisitReport,
  deleteVisitReport,
  updateVisitReport,
  getReservations,
  addReservation,
  deleteReservation,
  updateReservation,
  getSettings,
  updateSettings,
  getImportFolder,
  migrateToCustomStorage,
  // Backup functions
  createBackup,
  listBackups,
  restoreFromBackup,
  runDailyBackup,
  getBackupFolder
};
