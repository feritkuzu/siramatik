# Windows'ta Environment Variables Ayarlama

## Hızlı Kurulum

### Adım 1: .env Dosyası Oluştur

`C:\wamp64\www\siramatik` klasörüne `.env` dosyası oluşturun ve aşağıdaki içeriği yapıştırın:

```env
# Development Mode
NODE_ENV=development

# Port
PORT=3000

# Manus OAuth
VITE_APP_ID=6WnCokWgb4rfLgjGA27M8D
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Manus APIs
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key

# Owner Info
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Admin

# Frontend Config
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_APP_TITLE=Sıramatik Sistemi
```

### Adım 2: Dosyayı Kaydet

- **Dosya adı:** `.env` (nokta ile başlayan)
- **Konumu:** `C:\wamp64\www\siramatik\.env`
- **Kodlama:** UTF-8

### Adım 3: Projeyi Başlat

```powershell
cd C:\wamp64\www\siramatik
pnpm run dev
```

---

## Detaylı Açıklamalar

### VITE_APP_ID
Manus uygulamanızın ID'si. Değiştirmeyin.
```
VITE_APP_ID=6WnCokWgb4rfLgjGA27M8D
```

### OAUTH_SERVER_URL
Manus OAuth sunucusu. Değiştirmeyin.
```
OAUTH_SERVER_URL=https://api.manus.im
```

### JWT_SECRET
Oturum yönetimi için gizli anahtar. **Production'da güçlü bir şifre kullanın!**
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### PORT
Sunucunun çalışacağı port.
```
PORT=3000
```

---

## Dosya Oluşturma Yöntemleri

### Yöntem 1: Notepad (En Kolay)

1. Notepad'i açın (`Win + R` → `notepad`)
2. Yukarıdaki `.env` içeriğini yapıştırın
3. `Dosya → Farklı Kaydet`
4. **Dosya adı:** `.env`
5. **Dosya türü:** Tüm Dosyalar (*.*)
6. **Konumu:** `C:\wamp64\www\siramatik`
7. **Kodlama:** UTF-8
8. Kaydet

### Yöntem 2: PowerShell

```powershell
cd C:\wamp64\www\siramatik

# .env dosyası oluştur
@"
NODE_ENV=development
PORT=3000
VITE_APP_ID=6WnCokWgb4rfLgjGA27M8D
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Admin
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_APP_TITLE=Sıramatik Sistemi
"@ | Out-File -Encoding UTF8 .env
```

### Yöntem 3: Hazır Dosya Kopyala

Sandbox'tan `.env.windows` dosyasını kopyalayın:

```powershell
# Sandbox'tan indir
Copy-Item ".env.windows" ".env"
```

---

## Sorun Giderme

### "OAUTH_SERVER_URL is not configured" hatası

`.env` dosyasının doğru konumda olduğundan emin olun:
- ✅ Doğru: `C:\wamp64\www\siramatik\.env`
- ❌ Yanlış: `C:\wamp64\www\.env`
- ❌ Yanlış: `C:\wamp64\www\siramatik\server\.env`

### Dosya gösterilmiyor

Windows Explorer'da:
1. `Görünüm` menüsüne gidin
2. `Gizli dosyaları göster` seçeneğini işaretleyin
3. `.env` dosyası görünecek

### Projeyi yeniden başlat

`.env` dosyasını oluşturduktan sonra:

```powershell
# Eski prosesleri kapat
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Projeyi başlat
pnpm run dev
```

---

## Kontrol Listesi

- [ ] `.env` dosyası oluşturuldu
- [ ] `C:\wamp64\www\siramatik\.env` konumunda
- [ ] UTF-8 kodlaması
- [ ] `OAUTH_SERVER_URL=https://api.manus.im` satırı var
- [ ] `NODE_ENV=development` satırı var
- [ ] `PORT=3000` satırı var
- [ ] Dosya kaydedildi
- [ ] `pnpm run dev` komutu çalıştırıldı
- [ ] `[OAuth] Initialized with baseURL: https://api.manus.im` mesajı görüldü

---

## Hızlı Referans

```powershell
# .env dosyasını düzenle
notepad C:\wamp64\www\siramatik\.env

# Projeyi başlat
cd C:\wamp64\www\siramatik
pnpm run dev

# Tarayıcıda aç
http://localhost:3000
```
