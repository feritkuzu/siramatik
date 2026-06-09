# Windows'ta Sıramatik Projesini Yeniden Başlatma

## Hızlı Başlangıç (3 adım)

### 1. Eski Prosesleri Durdur
PowerShell'i **Yönetici Olarak** açın ve şu komutu çalıştırın:

```powershell
# Tüm Node.js proseslerini kapat
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Tüm npm/pnpm proseslerini kapat
Get-Process npm -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process pnpm -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 2. Projeye Git
PowerShell veya CMD'de:

```powershell
cd C:\wamp64\www\siramatik
```

### 3. Projeyi Başlat
Aşağıdaki komutlardan birini çalıştırın:

#### Seçenek A: Batch Script (Önerilen)
```powershell
.\setup-windows.bat
```

#### Seçenek B: PowerShell Script
```powershell
.\setup-windows.ps1
```

#### Seçenek C: Manuel Başlatma
```powershell
pnpm install
pnpm run dev
```

---

## Detaylı Adımlar

### Adım 1: Eski Prosesleri Temizle

**Windows Task Manager ile:**
1. `Ctrl + Shift + Esc` tuşlarına basın (Task Manager açılır)
2. "Processes" sekmesine gidin
3. "node.exe" bulun ve seçin
4. "End Task" butonuna tıklayın
5. Tüm node proseslerini kapatın

**PowerShell ile (Yönetici):**
```powershell
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*npm*" -or $_.ProcessName -like "*pnpm*"} | Stop-Process -Force
```

### Adım 2: Port Temizle (Opsiyonel)

Eğer port hala meşgulse:

```powershell
# Port 3000'ı kullanan prosesi bul
netstat -ano | findstr :3000

# Prosesi kapat (PID'yi yukarıdan alın)
taskkill /PID <PID> /F
```

### Adım 3: Projeyi Başlat

```powershell
cd C:\wamp64\www\siramatik
pnpm install
pnpm run dev
```

### Adım 4: Tarayıcıda Aç

Aşağıdaki adreslerden birine gidin:
- `http://localhost:3000`
- `http://localhost:3001` (eğer 3000 meşgulse)
- `http://127.0.0.1:3000`

---

## Sorun Giderme

### "pnpm: command not found" hatası
```powershell
npm install -g pnpm
```

### "Port already in use" hatası
```powershell
# Tüm Node proseslerini kapat
Get-Process node | Stop-Process -Force

# Veya spesifik port:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "node_modules" sorunu
```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
```

### Veritabanı sorunu
```powershell
# Veritabanı dosyasını sil (tüm veriler silinecek!)
Remove-Item -Force db.sqlite

# Projeyi yeniden başlat
pnpm run dev
```

---

## Kontrol Listesi

- [ ] Eski prosesler kapatıldı
- [ ] PowerShell/CMD'de `C:\wamp64\www\siramatik` klasöründe
- [ ] `pnpm run dev` komutu çalıştırılıyor
- [ ] Tarayıcıda `http://localhost:3000` açıldı
- [ ] Ana sayfa yüklendi
- [ ] Login butonuna tıklandı
- [ ] Manus hesabıyla oturum açıldı
- [ ] Admin Panel'e gidildi (`/admin`)

---

## Hızlı Referans

```powershell
# Tüm adımları bir kez çalıştır
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
cd C:\wamp64\www\siramatik
pnpm run dev
```

Tarayıcıda: `http://localhost:3000`
