# TripINconnect — Geliştirme Özeti

**Stack:** Electron + React + Vite | **Veri:** Electron userData (JSON) + localStorage

---

## Tamamlanan Özellikler

### Berichte (Raporlar)
- `ReportView.jsx`: "Harcama Raporu" bloğu kaldırıldı
- Zahlungsplan'a 100 satırlık sayfalama eklendi (`zpPage`, `ZP_PAGE_SIZE=100`, `zpPagedEntries`)

### Dashboard
- Tüm `marketingEvents` referansları kaldırıldı (`PROGRAM_EMOJI`, `PROGRAM_COLORS`, ilgili useMemo'lar)
- Takvime ödeme noktaları eklendi: yeşil=Anzahlung, turuncu=Restzahlung, mor=Provision
- Takvim hücrelerine tıklayınca gün detayı paneli açılıyor
- Provision (Month) KPI kartındaki "Fällig" badge'i kaldırıldı

### Agentur / BudgetView
- `saveEdit` ve `saveAdd`: `kasseTyp`, `dkiModel`, `rbiModel`, `rbiBerechnung`, `restzahlung`, `anzahlungPct` artık kaydediliyor
- `openEditModal`: boş değerler normalize ediliyor (fallback'ler eklendi)
- Berechnung sütunu: DKI ve RBI için tam 3 parçalı format (`Tage · Model · Datum`)

### Header
- `↺` yenile butonu eklendi (`window.location.reload()`)
- Abmelden butonuna onay diyaloğu eklendi

### Rezervasyon İşlemleri
- `addReservation`: `vgNr` veya `name+abreise+reisepreis` kombinasyonuyla duplicate önleme
- `bulkAddReservations`: Excel import'ta toplu duplicate kontrolü, `{added, skipped}` dönüyor
- `handleConfirmImport`: async yapıldı, skip sayısını gösteriyor
- Excel kolon eşleştirme (`autoMatchColumns`) genişletildi: check-in/out, buchungsnr, guest, hotel vb.

### Einstellungen (Settings)
- "🔌 Buchungssystem" bölümü eklendi:
  - Sistem seçimi: myJACK / NEO / Manuel
  - API Key giriş alanı (password tipi)
  - Verbinden butonu + bağlantı durumu göstergesi (🟢/🔴)
  - Son senkronizasyon tarihi
  - Manuel modda açıklama metni

### Kunden (Müşteriler)

#### Müşteri Kartları
- Etiketler (`customerTags`) → `customerProfiles` (localStorage) yapısına taşındı
- Etiketler kartlarda tek sıra, sadece emoji olarak küçültüldü (hover'da tooltip)
- Birden fazla etiket aynı anda seçilebilir (AND filtresi)
- Her karta otomatik hesaplanan 3 chip eklendi:
  - **Ø Budget** (yeşil): ortalama reisepreis
  - **📍 Top Ziel** (mavi): en çok gidilen destinasyon
  - **🗓 Reisezeit** (mor): en çok tatil yapılan ay

#### Etiket Filtresi
- Arama kutusunun altına etiket chip filtreleri eklendi
- Birden fazla etiket seçilebilir, seçilince sadece o etiketlere sahip müşteriler listelenir
- "✕ Zurücksetzen" ile tüm filtreler temizleniyor
- Müşteri sayısı dinamik olarak güncelleniyor

#### Müşteri Detay Modalı
- Her müşteri kartına / liste satırına tıklayınca modal açılıyor
- **Temel Bilgiler (2 sütun):** Geburtsdatum, Telefon, E-Mail, Adresse, Reisepass-Nr., Pass gültig bis
- **E-Mail** yanında ✉️ ikonu → `mailto:` linki (sadece dolu ise)
- **Telefon** yanında WhatsApp ikonu → `wa.me/` linki (sadece dolu ise)
- **Notizen:** serbest metin alanı
- **Etiketten:** 6 etiket (VIP, Premium, Budget, Standart, Stammkunde, Blacklist)
- **Rezervasyonlar:** müşteriye ait tüm rezervasyonlar tablo olarak (tarihsel sıra, Status sütunu yok)
- Kaydet → `localStorage`'a yazılır, uygulama yenilenince de korunur

---

## Teknik Notlar

- Müşteri profilleri `localStorage` key: `tripinconnect_customerProfiles`
- Rezervasyon verileri: Electron `userData` klasöründe JSON dosyaları
- `currency` alanı tabloda sütun yok, ancak Dashboard döviz dönüşümünde kullanılıyor
- `kundenNr` alanı sadece formda var, hiçbir yerde gösterilmiyor
- `status` alanı tabloda yok, Dashboard'da iptal filtresi olarak kullanılıyor
- Gizli ama mevcut sütunlar: `kdOffen`, `restAnVA`, `reisebeschreibung`

---

## Son Build Durumu
✅ Tüm değişiklikler başarıyla build edildi (`npm run build`)  
✅ GitHub'a push edildi
