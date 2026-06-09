# Sıramatik Sistemi - Windows Kurulum Kılavuzu

## Sistem Gereksinimleri

- **Node.js**: v18 veya daha yeni (https://nodejs.org/)
- **pnpm**: v8 veya daha yeni
- **Windows**: Windows 10 veya daha yeni
- **Port**: 3000 (dev server), 3001 (API)
- **Veritabanı**: MySQL/TiDB (opsiyonel - development için SQLite kullanılabilir)

## Kurulum Adımları

### 1. Ön Koşullar

#### Node.js Kurulumu
1. https://nodejs.org/ adresinden LTS sürümünü indir
2. Kurulum sihirbazını takip et
3. Terminal/PowerShell'de doğrula:
```bash
node --version
npm --version
```

#### pnpm Kurulumu
```bash
npm install -g pnpm
pnpm --version
```

### 2. Projeyi Hazırla

1. Proje klasörüne git:
```bash
cd C:\wamp64\www\siramatik
```

2. Bağımlılıkları yükle:
```bash
pnpm install
```

### 3. Veritabanı Konfigürasyonu

#### Development (Önerilen)
SQLite otomatik olarak kullanılır. Ek kurulum gerekmez.

#### Production (MySQL/TiDB)
`.env` dosyası oluştur:
```
DATABASE_URL=mysql://user:password@localhost:3306/siramatik
JWT_SECRET=your-secret-key-here
```

### 4. Dev Server'ı Başlat

#### Seçenek 1: Batch Script (Önerilen)
```bash
setup-windows.bat
```

#### Seçenek 2: Manuel Başlatma
```bash
pnpm run dev
```

Sistem başarıyla başlatıldıysa:
```
✓ Server running on http://localhost:3000
```

### 5. Tarayıcıda Aç

```
http://localhost:3000
```

## Yazıcı Entegrasyonu

### Windows Native Yazıcılar

Sistem otomatik olarak Windows sistem yazıcılarını algılar:

1. Admin Panel'e git
2. "YAZICI AYARLARI" bölümüne git
3. "YAZICILAR LİSTESİNİ YENILE" butonuna tıkla
4. Yazıcı seç
5. "TEST YAZDIRMASI YAP" ile test et

### Desteklenen Yazıcılar

- **ESC/POS Yazıcılar**: Zjiang ZJ-5890K, Sunmi, vb.
- **Sistem Yazıcıları**: Windows tarafından desteklenen tüm yazıcılar
- **PDF Yazıcı**: Microsoft Print to PDF

## Sorun Giderme

### Port 3000 Zaten Kullanımda
```bash
# Port 3001'de başlat
set PORT=3001
pnpm run dev
```

### Yazıcılar Görünmüyor
1. Windows Yazıcı Ayarları'nı kontrol et
2. Admin Panel'de "YAZICILAR LİSTESİNİ YENILE" butonuna tıkla
3. Browser console'da hata mesajı var mı kontrol et (F12)

### Veritabanı Hatası
```bash
# Migration'ları yeniden çalıştır
pnpm drizzle-kit generate
```

### Node Modülleri Sorunu
```bash
# Temiz kurulum yap
rm -r node_modules pnpm-lock.yaml
pnpm install
```

## Geliştirme Komutları

```bash
# Dev server (hot reload ile)
pnpm run dev

# Testleri çalıştır
pnpm test

# TypeScript kontrol et
pnpm typecheck

# Build et
pnpm build

# Production'da çalıştır
pnpm start
```

## Dosya Yapısı

```
siramatik/
├── client/              # React Frontend
│   ├── src/
│   │   ├── pages/      # Sayfa bileşenleri
│   │   ├── components/ # Reusable bileşenler
│   │   └── lib/        # Utilities
│   └── public/         # Static dosyalar
├── server/             # Express Backend
│   ├── routers.ts      # tRPC endpoints
│   ├── db.ts           # Veritabanı fonksiyonları
│   └── _core/          # Framework kodu
├── drizzle/            # Veritabanı schema
├── package.json        # Bağımlılıklar
└── setup-windows.bat   # Windows kurulum scripti
```

## Önemli Notlar

### Yazıcı Ayarları
- Yazıcı seçimi **Admin Panel**'de yapılır
- Seçilen yazıcı otomatik olarak kaydedilir
- Ticket yazdırması seçili yazıcıya gönderilir

### Veritabanı
- Development: SQLite (otomatik)
- Production: MySQL/TiDB (konfigüre et)

### Port Yönetimi
- Frontend: 3000
- Backend API: 3001
- Vite HMR: 5173

## İletişim & Destek

Sorun yaşarsanız:
1. Browser console'u kontrol et (F12)
2. Terminal output'unu kontrol et
3. `.manus-logs/` klasöründeki log dosyalarını kontrol et

## Sonraki Adımlar

1. **Kiosk Ekranı**: `/kiosk` sayfasını test et
2. **Ana Ekran**: `/` sayfasını test et
3. **Admin Panel**: `/admin` sayfasını test et
4. **Yazıcı Testi**: Admin Panel'de test yazdırması yap

---

**Sıramatik Sistemi v1.0** - Gerçek Zamanlı Sıra Yönetim Sistemi
