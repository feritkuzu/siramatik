# Sıramatik Sistemi - Donanım Kurulum ve Kullanım Kılavuzu

## İçindekiler

1. [Sistem Genel Bakış](#sistem-genel-bakış)
2. [Donanım Gereksinimleri](#donanım-gereksinimleri)
3. [Yazılım Kurulumu](#yazılım-kurulumu)
4. [Ağ Yapılandırması](#ağ-yapılandırması)
5. [Sistem Başlatma](#sistem-başlatma)
6. [Kullanım Talimatları](#kullanım-talimatları)
7. [Sorun Giderme](#sorun-giderme)

---

## Sistem Genel Bakış

**Sıramatik**, müşteri sıra yönetim sistemidir. Sistem 4 ana bileşenden oluşur:

| Bileşen | Amaç | Konum |
|---------|------|-------|
| **Kiosk Ekranı** | Müşteriler sıra alır | Giriş alanı |
| **Ana Monitör** | Çağrılan numaraları gösterir | Bekleme salonu |
| **Banko Paneli** | Görevliler müşteri çağırır | Her banko masası |
| **Admin Paneli** | Sistem yönetimi | Yönetim ofisi |

---

## Donanım Gereksinimleri

### Kiosk Ekranı

```
Donanım Özellikleri:
- Ekran: 24-27" dokunmatik LCD (1920x1080 minimum)
- İşlemci: Intel i5 veya eşdeğeri
- RAM: 8 GB minimum
- Depolama: 256 GB SSD
- İşletim Sistemi: Windows 10/11 veya Linux
- Ağ: Ethernet (RJ45) veya WiFi
- Yazıcı: Termal yazıcı (ESC/POS uyumlu)
```

**Yazıcı Bağlantısı:**
- USB: Doğrudan bağlantı
- Network: Yazıcı IP adresi 192.168.1.100 (örnek)
- Bluetooth: Kablosuz bağlantı

### Ana Monitör Ekranı

```
Donanım Özellikleri:
- Ekran: 43-55" 4K LCD (3840x2160 önerilen)
- İşlemci: Intel i7 veya eşdeğeri
- RAM: 16 GB minimum
- Depolama: 512 GB SSD
- İşletim Sistemi: Windows 10/11 veya Linux
- Ağ: Ethernet (RJ45)
- Ses: Stereo hoparlörler (2x 10W minimum)
```

### Banko Paneli Bilgisayarları

```
Donanım Özellikleri (Her Banko İçin):
- Ekran: 21-24" LCD (1920x1080)
- İşlemci: Intel i5 veya eşdeğeri
- RAM: 8 GB minimum
- Depolama: 256 GB SSD
- İşletim Sistemi: Windows 10/11 veya Linux
- Ağ: Ethernet (RJ45)
```

### Admin Paneli Bilgisayarı

```
Donanım Özellikleri:
- Ekran: 24-27" LCD (1920x1080)
- İşlemci: Intel i5 veya eşdeğeri
- RAM: 8 GB minimum
- Depolama: 256 GB SSD
- İşletim Sistemi: Windows 10/11 veya Linux
- Ağ: Ethernet (RJ45)
```

### Ağ Altyapısı

```
Gerekli Bileşenler:
- Ağ Anahtarı (Switch): 24 port, Gigabit Ethernet
- Yönlendirici (Router): Gigabit, WiFi 5/6 (opsiyonel)
- Kablolama: Cat6 Ethernet kablosu
- Sunucu: Manus bulut sunucusu (otomatik)
```

**Ağ Topolojisi:**

```
                    ┌─────────────────┐
                    │  Manus Bulut    │
                    │   Sunucusu      │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  İnternet (SSL) │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Ağ Anahtarı    │
                    │   (Switch)      │
        ┌───────────┼────────┬────────┼───────────┐
        │           │        │        │           │
    ┌───▼──┐   ┌───▼──┐ ┌──▼───┐ ┌──▼───┐   ┌──▼───┐
    │Kiosk │   │Monitör│ │Banko │ │Banko │...│Admin │
    │      │   │       │ │ PC1  │ │ PC2  │   │Panel │
    └──────┘   └───────┘ └──────┘ └──────┘   └──────┘
```

---

## Yazılım Kurulumu

### 1. Sunucu Kurulumu (Yönetici Tarafından)

```bash
# Proje dosyalarını indirin
git clone https://github.com/yourorg/siramatik.git
cd siramatik

# Bağımlılıkları yükleyin
pnpm install

# Veritabanını başlatın
pnpm drizzle-kit migrate

# Sunucuyu başlatın
pnpm build
pnpm start
```

### 2. İstemci Kurulumu (Her Bilgisayarda)

**Windows:**

```powershell
# Chrome veya Edge tarayıcısını açın
# Aşağıdaki URL'ye gidin:
https://your-server-domain.com

# Yer imlerine ekleyin (Ctrl+D)
```

**Linux:**

```bash
# Firefox veya Chrome yükleyin
sudo apt-get install chromium-browser

# Uygulama URL'sini açın
chromium-browser https://your-server-domain.com
```

### 3. Termal Yazıcı Kurulumu

**Windows:**

```
1. Yazıcıyı bilgisayara bağlayın (USB)
2. Yazıcı sürücüsünü yükleyin
3. Yazıcıyı varsayılan olarak ayarlayın
4. Admin Panelinden "Yazıcı Testi" yapın
```

**Linux:**

```bash
# CUPS yazıcı hizmetini yükleyin
sudo apt-get install cups cups-client

# Yazıcıyı ekleyin
sudo lpadmin -p siramatik-printer -E -v usb://... -m everywhere

# Varsayılan olarak ayarlayın
sudo lpadmin -d siramatik-printer
```

---

## Ağ Yapılandırması

### IP Adresleri (Önerilen)

```
Sunucu:          192.168.1.10
Kiosk:           192.168.1.20
Ana Monitör:     192.168.1.30
Banko PC 1:      192.168.1.41
Banko PC 2:      192.168.1.42
Banko PC 3:      192.168.1.43
...
Banko PC 10:     192.168.1.50
Admin Panel:     192.168.1.60
Yazıcı:          192.168.1.100
```

### Statik IP Ayarı (Windows)

```
1. Ağ Ayarları → Gelişmiş ağ ayarları
2. Ethernet → Özellikler
3. IPv4 → Özellikler
4. "Aşağıdaki IP adresini kullan" seçin
5. IP Adresi: 192.168.1.XX
6. Alt Ağ Maskesi: 255.255.255.0
7. Varsayılan Ağ Geçidi: 192.168.1.1
8. DNS Sunucusu: 8.8.8.8
```

### Statik IP Ayarı (Linux)

```bash
# /etc/netplan/00-installer-config.yaml dosyasını düzenleyin
sudo nano /etc/netplan/00-installer-config.yaml

# Aşağıdaki içeriği ekleyin:
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses: [192.168.1.XX/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]

# Ayarları uygulayın
sudo netplan apply
```

---

## Sistem Başlatma

### 1. Başlangıç Kontrol Listesi

- [ ] Tüm bilgisayarlar açık
- [ ] Ağ bağlantıları kontrol edildi
- [ ] Sunucu çalışıyor
- [ ] Termal yazıcı açık ve bağlı
- [ ] Ses sistemi çalışıyor

### 2. Admin Panelinden Sistem Başlatma

```
1. Admin Paneline giriş yapın
2. "Banko Sayısı" ayarını yapın (2-10 arası)
3. "Sistem Başlat" butonuna basın
4. "Yazıcı Testi" yapın
5. Tüm ekranların bağlı olduğunu doğrulayın
```

### 3. Kiosk Ekranını Tam Ekran Yapma

**Windows:**

```
1. F11 tuşuna basın (Tam ekran)
2. Veya Ctrl+Shift+F
```

**Linux:**

```bash
# Otomatik başlatma için .desktop dosyası oluşturun
sudo nano /etc/xdg/autostart/siramatik-kiosk.desktop

[Desktop Entry]
Type=Application
Name=Siramatik Kiosk
Exec=chromium-browser --kiosk https://your-server/kiosk
```

---

## Kullanım Talimatları

### Müşteri (Kiosk Ekranı)

```
1. Kiosk ekranına yaklaşın
2. "SIRA AL" butonuna dokunun
3. Sıra numaranızı not edin
4. Termal bilet alın
5. Ana ekranda numaranız çağrılana kadar bekleyin
```

### Banko Görevlisi (Banko Paneli)

```
1. Banko Paneline giriş yapın
2. Bankonuzu seçin (Banko 1, Banko 2, vb.)
3. "SİRADAKİNİ ÇAĞIR" butonuna basın
4. Müşteri numarası ana ekranda görünecek
5. Müşteri gelince "İŞLEM TAMAMLA" butonuna basın
```

### Yönetici (Admin Paneli)

```
1. Admin Paneline giriş yapın
2. Sistem durumunu izleyin
3. Banko sayısını ayarlayın (gerekirse)
4. Bankoları açıp kapatın
5. İstatistikleri görüntüleyin
6. Yazıcı testleri yapın
```

---

## Sorun Giderme

### Bağlantı Sorunları

**Sorun:** "Sunucuya bağlanılamıyor"

```
Çözüm:
1. İnternet bağlantısını kontrol edin
2. Firewall ayarlarını kontrol edin
3. Sunucu URL'sini doğrulayın
4. DNS ayarlarını kontrol edin
5. Tarayıcı önbelleğini temizleyin (Ctrl+Shift+Del)
```

### Yazıcı Sorunları

**Sorun:** "Yazıcı yanıt vermiyor"

```
Çözüm:
1. Yazıcı açık ve bağlı mı kontrol edin
2. Yazıcı sürücüsünü yeniden yükleyin
3. Admin Panelinden "Yazıcı Testi" yapın
4. Yazıcı IP adresini doğrulayın
5. Yazıcı kağıdı ve mürekkebi kontrol edin
```

### Ses Sorunları

**Sorun:** "Bildirim sesi duyulmuyor"

```
Çözüm:
1. Ses sistemini açın
2. Ses seviyesini kontrol edin
3. Tarayıcı ses izinlerini kontrol edin
4. Hoparlörleri kontrol edin
5. Ses sürücüsünü güncelleyin
```

### Performans Sorunları

**Sorun:** "Sistem yavaş çalışıyor"

```
Çözüm:
1. Ağ bağlantı hızını kontrol edin
2. Bilgisayar RAM kullanımını kontrol edin
3. Disk alanını kontrol edin
4. Tarayıcı sekmelerini kapatın
5. Sistem yeniden başlatın
```

---

## Teknik Destek

**E-posta:** support@siramatik.com  
**Telefon:** +90 (XXX) XXX XX XX  
**Web:** https://siramatik.com/support

---

## Güvenlik Önerileri

```
1. Tüm parolalar güçlü olmalı (en az 12 karakter)
2. Düzenli yedeklemeler yapın
3. Yazılımı güncel tutun
4. Firewall'u etkinleştirin
5. VPN kullanın (opsiyonel)
6. Sistem loglarını düzenli kontrol edin
```

---

## Bakım ve Destek

### Haftalık Bakım

- [ ] Sistem loglarını kontrol edin
- [ ] İstatistikleri gözden geçirin
- [ ] Yazıcı durumunu kontrol edin
- [ ] Ağ bağlantısını test edin

### Aylık Bakım

- [ ] Veritabanı yedeklemesi yapın
- [ ] Yazılım güncellemelerini kontrol edin
- [ ] Sistem performansını analiz edin
- [ ] Donanım durumunu kontrol edin

### Yıllık Bakım

- [ ] Tam sistem denetimi
- [ ] Donanım yükseltmesi (gerekirse)
- [ ] Yazılım güvenlik denetimi
- [ ] Felakete karşı hazırlık planı

---

**Sürüm:** 1.0  
**Güncelleme Tarihi:** 07.05.2026  
**Hazırlayan:** Sıramatik Geliştirme Ekibi
