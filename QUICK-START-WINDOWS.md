# Sıramatik - Windows Hızlı Başlangıç

## 5 Dakika'da Başla

### Adım 1: Ön Koşulları Kontrol Et
```bash
node --version    # v18+ olmalı
npm --version     # 9+ olmalı
```

Eğer yüklü değilse: https://nodejs.org/

### Adım 2: Projeyi Aç
```bash
cd C:\wamp64\www\siramatik
```

### Adım 3: Kurulum Scriptini Çalıştır

#### Seçenek A: Batch Script (Önerilen)
```bash
setup-windows.bat
```

#### Seçenek B: PowerShell
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup-windows.ps1
```

#### Seçenek C: Manuel
```bash
pnpm install
pnpm run dev
```

### Adım 4: Tarayıcıda Aç
```
http://localhost:3000
```

## Yazıcı Ayarı (5 Dakika)

1. **Admin Panel'e Git**
   - URL: `http://localhost:3000/admin`

2. **Yazıcıları Listele**
   - "YAZICI AYARLARI" bölümüne git
   - "YAZICILAR LİSTESİNİ YENILE" butonuna tıkla

3. **Yazıcı Seç**
   - Dropdown'dan yazıcını seç
   - "SEÇİLİ YAZICIYI KAYDET" butonuna tıkla

4. **Test Yap**
   - "TEST YAZDIRMASI YAP" butonuna tıkla
   - Yazıcı test ticket yazdırmalı

## Sistem Özellikleri

### Kiosk Ekranı (`/kiosk`)
- Müşteri tarafından görülen sıra numarası ekranı
- Otomatik yenilenir
- Full screen mode'da çalışır

### Ana Ekran (`/`)
- Sistem durumu gösterir
- Hızlı erişim butonları
- Sıra yönetimi

### Admin Panel (`/admin`)
- Banko kontrolü
- Yazıcı ayarları
- İstatistikler
- Sistem konfigürasyonu

## Sorun Giderme

### "Port 3000 zaten kullanımda" hatası
```bash
# Port 3001'de başlat
set PORT=3001
pnpm run dev
```

### Yazıcılar görünmüyor
1. Windows Yazıcı Ayarları'nı kontrol et
2. Admin Panel'de "YAZICILAR LİSTESİNİ YENILE" tıkla
3. F12 ile console'u aç ve hata mesajını kontrol et

### Veritabanı hatası
```bash
pnpm drizzle-kit generate
```

## Komutlar

```bash
pnpm run dev       # Development server
pnpm test          # Testleri çalıştır
pnpm build         # Production build
pnpm start         # Production server
```

## Dosyalar

- `setup-windows.bat` - Batch kurulum scripti
- `setup-windows.ps1` - PowerShell kurulum scripti
- `WINDOWS-SETUP.md` - Detaylı kurulum kılavuzu
- `.env.example` - Environment variables örneği

## Yazıcı Uyumluluğu

✅ **Desteklenen:**
- ESC/POS yazıcılar (Zjiang, Sunmi, vb.)
- Windows sistem yazıcıları
- PDF yazıcı
- Thermal yazıcılar

❌ **Desteklenmeyen:**
- Ağ yazıcıları (şimdilik)
- Bluetooth yazıcıları (şimdilik)

## Sonraki Adımlar

1. ✅ Sistemi başlat
2. ✅ Yazıcı ayarla
3. ✅ Kiosk ekranını test et
4. ✅ Admin Panel'i test et
5. ✅ Sıra yönetimini test et

---

**Yardım gerekirse:** Admin Panel'deki "?" butonuna tıkla veya browser console'u kontrol et (F12)
