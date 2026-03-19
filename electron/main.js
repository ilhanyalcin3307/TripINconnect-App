const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const https = require('https');

let mainWindow; // global tanım

const startURL = process.env.ELECTRON_START_URL || 'http://localhost:5173';

// --------- Fonksiyonlar ---------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1400,
    minHeight: 800,
    backgroundColor: '#0d0f12',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true, // Production'da true kalacak
      // Development modda CSP hatalarını baskıla
      devTools: true
    },
    titleBarStyle: 'hiddenInset',
    frame: true
  });

  // CSP hatalarını console'da filtreleme (development için)
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* https://*.jsdelivr.net https://unpkg.com; connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co https://*.supabase.com wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com;"
          ]
        }
      });
    });
  }

  // Dev mod
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(startURL);
    mainWindow.webContents.openDevTools();
  } else {
    // Prod mod
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --------- App Lifecycle ---------

app.whenReady().then(() => {
  // Initialize database with app reference for userData path
  db.setElectronApp(app);
  // NOT: initDatabase + migrateLegacyData kullanıcı giriş yaptıktan sonra
  // setCurrentUser IPC çağrısında çalıştırılıyor
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --------- Database & IPC ---------

// Auth: kullanıcı giriş yaptığında store'u kullanıcıya özgü hale getir
ipcMain.handle('auth:setUser', async (event, userId, userEmail) => {
  db.setCurrentUser(userId, userEmail);
  db.initDatabase();
  db.migrateLegacyData();
  // Günlük backup da kullanıcı bazında çalışsın
  db.runDailyBackup().then(result => {
    if (result.success && !result.skipped) {
      console.log(`✓ Daily backup completed for user ${userId}`);
    }
  }).catch(err => console.error('Daily backup failed:', err));
  return { success: true };
});

// Database - Expenses
ipcMain.handle('db:getExpenses', async () => {
  return db.getExpenses();
});

ipcMain.handle('db:addExpense', async (event, expense) => {
  return db.addExpense(expense);
});

ipcMain.handle('db:deleteExpense', async (event, id) => {
  return db.deleteExpense(id);
});

ipcMain.handle('db:updateExpense', async (event, id, expense) => {
  return db.updateExpense(id, expense);
});

// Database - Marketing Events
ipcMain.handle('db:getMarketingEvents', async () => {
  return db.getMarketingEvents();
});

ipcMain.handle('db:addMarketingEvent', async (event, marketingEvent) => {
  return db.addMarketingEvent(marketingEvent);
});

ipcMain.handle('db:deleteMarketingEvent', async (event, id) => {
  return db.deleteMarketingEvent(id);
});

ipcMain.handle('db:updateMarketingEvent', async (event, id, marketingEvent) => {
  return db.updateMarketingEvent(id, marketingEvent);
});

// Database - Visit Reports
ipcMain.handle('db:getVisitReports', async () => {
  return db.getVisitReports();
});

ipcMain.handle('db:addVisitReport', async (event, report) => {
  return db.addVisitReport(report);
});

ipcMain.handle('db:deleteVisitReport', async (event, id) => {
  return db.deleteVisitReport(id);
});

ipcMain.handle('db:updateVisitReport', async (event, id, report) => {
  return db.updateVisitReport(id, report);
});

// Database - Reservations
ipcMain.handle('db:getReservations', async () => {
  return db.getReservations();
});

ipcMain.handle('db:addReservation', async (event, reservation) => {
  return db.addReservation(reservation);
});

ipcMain.handle('db:deleteReservation', async (event, id) => {
  return db.deleteReservation(id);
});

ipcMain.handle('db:updateReservation', async (event, id, reservation) => {
  return db.updateReservation(id, reservation);
});

// Database - Settings
ipcMain.handle('db:getSettings', async () => {
  return db.getSettings();
});

ipcMain.handle('db:updateSettings', async (event, settings) => {
  return db.updateSettings(settings);
});

ipcMain.handle('db:migrateToCustomStorage', async () => {
  return db.migrateToCustomStorage();
});

ipcMain.handle('db:migrateLegacyData', async () => {
  return db.migrateLegacyData();
});

// Backup System
ipcMain.handle('backup:create', async () => {
  return await db.createBackup(false); // Manual backup
});

ipcMain.handle('backup:list', async () => {
  return db.listBackups();
});

ipcMain.handle('backup:restore', async (event, filename) => {
  return await db.restoreFromBackup(filename);
});

ipcMain.handle('backup:getFolder', async () => {
  return db.getBackupFolder();
});

// Dialog - Folder Selection
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Veri Depolama Klasörü Seçin',
    buttonLabel: 'Seç'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Receipt Operations
ipcMain.handle('receipt:save', async (event, { imageData, expenseId, receiptDate }) => {
  try {
    const settings = db.getSettings();
    const storageFolder = settings.storageFolder;
    
    if (!storageFolder) {
      return { success: false, error: 'Storage folder not set' };
    }
    
    const receiptsFolder = path.join(storageFolder, 'receipts');
    if (!fs.existsSync(receiptsFolder)) {
      fs.mkdirSync(receiptsFolder, { recursive: true });
    }
    
    // Base64'ten buffer'a çevir
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Dosya adı oluştur
    const fileExtension = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpg';
    const fileName = `receipt_${expenseId}_${Date.now()}.${fileExtension}`;
    const filePath = path.join(receiptsFolder, fileName);
    
    // Dosyayı kaydet
    fs.writeFileSync(filePath, buffer);
    
    return { 
      success: true, 
      path: filePath,
      relativePath: path.join('receipts', fileName)
    };
  } catch (error) {
    console.error('Receipt save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('receipt:get', async (event, filePath) => {
  try {
    const settings = db.getSettings();
    const storageFolder = settings.storageFolder;
    
    if (!storageFolder) {
      return { success: false, error: 'Storage folder not set' };
    }
    
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(storageFolder, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File not found' };
    }
    
    const buffer = fs.readFileSync(fullPath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    
    return { 
      success: true, 
      data: `data:${mimeType};base64,${base64}` 
    };
  } catch (error) {
    console.error('Receipt get error:', error);
    return { success: false, error: error.message };
  }
});

// AI Analysis - Claude
ipcMain.handle('ai:analyzeClaude', async (event, text, apiKey) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Bu fiş metninden şu bilgileri çıkar ve JSON formatında ver:\n- tarih (YYYY-MM-DD)\n- tutar (sadece sayı)\n- aciklama (kısa)\n\nMetin:\n${text}`
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', error => {
      resolve({ success: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
});

// AI Analysis - GitHub Models
ipcMain.handle('ai:analyzeGithub', async (event, text, githubToken) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Bu fiş metninden şu bilgileri çıkar ve JSON formatında ver:\n- tarih (YYYY-MM-DD)\n- tutar (sadece sayı)\n- aciklama (kısa)\n\nMetin:\n${text}`
      }],
      temperature: 0.3,
      max_tokens: 500
    });

    const options = {
      hostname: 'api.github.com',
      path: '/models/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubToken}`,
        'Content-Length': data.length,
        'User-Agent': 'TripInConnect'
      }
    };

    const req = https.request(options, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', error => {
      resolve({ success: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
});

// Shell - Open External URL
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Share PDF
ipcMain.handle('share:pdf', async (event, { pdfData, fileName }) => {
  try {
    const settings = db.getSettings();
    const storageFolder = settings.storageFolder || app.getPath('documents');
    
    const pdfFolder = path.join(storageFolder, 'exports');
    if (!fs.existsSync(pdfFolder)) {
      fs.mkdirSync(pdfFolder, { recursive: true });
    }
    
    const filePath = path.join(pdfFolder, fileName);
    
    // Base64'ten buffer'a çevir
    const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(filePath, buffer);
    
    // Dosyayı Finder'da göster
    shell.showItemInFolder(filePath);
    
    return { success: true, path: filePath };
  } catch (error) {
    console.error('PDF share error:', error);
    return { success: false, error: error.message };
  }
});

// Döviz kuru fetch
ipcMain.handle('exchange:getRates', async () => {
  return new Promise((resolve) => {
    https.get('https://open.er-api.com/v6/latest/EUR', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { 
          const parsed = JSON.parse(data);
          resolve({ success: true, data: parsed });
        }
        catch (e) { 
          resolve({ success: false, error: e.message });
        }
      });
    }).on('error', error => {
      resolve({ success: false, error: error.message });
    });
  });
});
