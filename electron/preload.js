const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  setCurrentUser: (userId, userEmail) => ipcRenderer.invoke('auth:setUser', userId, userEmail),

  // Database operations
  getExpenses: () => ipcRenderer.invoke('db:getExpenses'),
  addExpense: (expense) => ipcRenderer.invoke('db:addExpense', expense),
  deleteExpense: (id) => ipcRenderer.invoke('db:deleteExpense', id),
  updateExpense: (id, expense) => ipcRenderer.invoke('db:updateExpense', id, expense),
  exportCSV: () => ipcRenderer.invoke('db:exportCSV'),
  
  // Marketing Events
  getMarketingEvents: () => ipcRenderer.invoke('db:getMarketingEvents'),
  addMarketingEvent: (event) => ipcRenderer.invoke('db:addMarketingEvent', event),
  deleteMarketingEvent: (id) => ipcRenderer.invoke('db:deleteMarketingEvent', id),
  updateMarketingEvent: (id, event) => ipcRenderer.invoke('db:updateMarketingEvent', id, event),
  
  // Visit Reports
  getVisitReports: () => ipcRenderer.invoke('db:getVisitReports'),
  addVisitReport: (report) => ipcRenderer.invoke('db:addVisitReport', report),
  deleteVisitReport: (id) => ipcRenderer.invoke('db:deleteVisitReport', id),
  updateVisitReport: (id, report) => ipcRenderer.invoke('db:updateVisitReport', id, report),
  
  // Reservations
  getReservations: () => ipcRenderer.invoke('db:getReservations'),
  addReservation: (reservation) => ipcRenderer.invoke('db:addReservation', reservation),
  deleteReservation: (id) => ipcRenderer.invoke('db:deleteReservation', id),
  updateReservation: (id, reservation) => ipcRenderer.invoke('db:updateReservation', id, reservation),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('db:getSettings'),
  updateSettings: (settings) => ipcRenderer.invoke('db:updateSettings', settings),
  migrateToCustomStorage: () => ipcRenderer.invoke('db:migrateToCustomStorage'),
  migrateLegacyData: () => ipcRenderer.invoke('db:migrateLegacyData'),
  
  // Backup System
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (filename) => ipcRenderer.invoke('backup:restore', filename),
  getBackupFolder: () => ipcRenderer.invoke('backup:getFolder'),
  
  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // Receipt operations
  saveReceipt: (imageData, expenseId, receiptDate) => ipcRenderer.invoke('receipt:save', { imageData, expenseId, receiptDate }),
  getReceipt: (filePath) => ipcRenderer.invoke('receipt:get', filePath),
  
  // Claude AI
  analyzeClaude: (text, apiKey) => ipcRenderer.invoke('ai:analyzeClaude', text, apiKey),
  
  // GitHub Models AI
  analyzeGithub: (text, githubToken) => ipcRenderer.invoke('ai:analyzeGithub', text, githubToken),
  
  // Exchange rates
  getExchangeRates: () => ipcRenderer.invoke('exchange:getRates'),
  
  // Open external URL
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  
  // Share PDF
  sharePDF: (pdfData, fileName) => ipcRenderer.invoke('share:pdf', { pdfData, fileName })
});
