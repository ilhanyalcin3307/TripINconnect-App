# TripInConnect — Harcama Takip Uygulaması

Modern, koyu temalı Electron + React + SQLite masaüstü uygulaması. Marketing harcamalarını takip etmek için geliştirilmiştir.

## ✨ Özellikler

- 🧾 **Fiş Yükleme & OCR**: Tesseract.js ile otomatik fiş okuma
- 📊 **Dashboard**: Aylık toplam, kategori dağılımı, trendler
- 📋 **Fiş Listesi**: Kategori filtreleme, detaylı görünüm
- 🏨 **Otel Bazlı Analiz**: Hotel bazında harcama raporları
- 💾 **SQLite Veritabanı**: Yerel, güvenli veri saklama
- 📥 **CSV Export**: Harcamaları dışa aktarma
- 🎨 **Modern Tasarım**: Koyu tema, Cabinet Grotesk font

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya pnpm

### Adımlar

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme modunda çalıştır
npm run dev

# Sadece React'i çalıştır
npm run dev:react

# Electron'u çalıştır
npm start

# Production build
npm run build
npm run build:electron
```

## 📁 Proje Yapısı

```
tripinconnect/
├── electron/
│   ├── main.js          # Electron ana process
│   ├── preload.js       # IPC bridge
│   └── database.js      # SQLite operations
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx
│   │   ├── ExpenseList.jsx
│   │   ├── HotelView.jsx
│   │   ├── ReportView.jsx
│   │   ├── UploadModal.jsx  # OCR + Form
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── Toast.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
└── index.html
```

## 🗄️ Veritabanı

Veriler JSON formatında electron-store ile saklanır:
- **macOS**: `~/Library/Application Support/marketing-desk/config.json`
- **Windows**: `%APPDATA%/marketing-desk/config.json`
- **Linux**: `~/.config/marketing-desk/config.json`

### Veri Yapısı

```json
{
  "expenses": [
    {
      "id": 1710345678901,
      "tarih": "2026-03-13",
      "fisno": "INV-2026-001",
      "aciklama": "Uçak bileti",
      "tutar": 450.00,
      "currency": "EUR",
      "kategori": "seyahat",
      "otel": "Genel",
      "not": "",
      "hasReceipt": 1,
      "receiptPath": null,
      "createdAt": "2026-03-13T10:30:00.000Z"
    }
  ]
}
```

## 🎯 Kullanım

### Fiş Ekleme
1. **"+ Fiş Ekle"** butonuna tıklayın
2. Fiş fotoğrafını yükleyin (Tesseract.js otomatik okur)
3. OCR sonuçlarını kontrol edin ve düzeltin
4. Kaydedin

### Kategoriler
- ✈ **Seyahat**: Uçak, tren, taksi
- 🍽 **Yemek**: Restoran, catering
- 🏨 **Konaklama**: Otel konaklama
- 📢 **Pazarlama**: Fuar, reklam, malzeme
- 📦 **Diğer**: Diğer harcamalar

### Para Birimleri
EUR, TRY, CZK, USD, GBP, CHF desteklenir.

### Otel Seçenekleri
- Selectum (Luxury, Family, Noa, Colours)
- Asteria (Family Belek/Side)
- The Norm (Doora, Kemer)
- Kremlin Palace

## 🔧 Teknolojiler

- **Electron 28**: Desktop framework
- **React 18**: UI library
- **Vite**: Build tool
- **electron-store**: JSON-based data storage
- **Tesseract.js**: OCR engine
- **Cabinet Grotesk**: Custom font

## 📊 Özellik Detayları

### OCR (Tesseract.js)
- Almanca, Türkçe, İngilizce dil desteği
- Otomatik tarih, fiş no, tutar çıkarma
- Manuel düzeltme imkanı

### Dashboard
- Bu ay toplam harcama
- Ortalama fiş tutarı
- En yüksek kategori
- Aylık trend grafiği
- Kategori dağılımı

### Export
- CSV formatında dışa aktarma
- Tüm alanlar dahil
- Excel uyumlu

## 🛠️ Geliştirme

### Environment
Development modunda Vite dev server kullanılır (http://localhost:3000)

### IPC İletişimi
Renderer → Main process güvenli IPC:
- `db:getExpenses`: Tüm harcamaları getir
- `db:addExpense`: Yeni harcama ekle
- `db:deleteExpense`: Harcama sil
- `db:exportCSV`: CSV olarak dışa aktar

### Build
```bash
npm run build          # React build
npm run build:electron # Electron package
```

## 📝 Lisans

Bu proje özel kullanım içindir.

## 👤 Geliştirici

İlhan Yalçın — Marketing Expense Tracker

---

**Not**: İlk çalıştırmada bağımlılıklar yüklenirken zaman alabilir. Tesseract.js dil dosyaları ilk kullanımda indirilir.
