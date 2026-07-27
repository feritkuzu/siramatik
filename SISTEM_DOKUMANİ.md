# Siramatik Sıra Yönetim Sistemi — Sistem Dokümanı

## 1. SİSTEME GENEL BAKIŞ

Siramatik, banka/kuyruk yönetimi için web tabanlı bir sistemdir.
Müşteriler kiosktan sıra alır, banko görevlileri sırayı çağırır, ekranda sıralar gösterilir.

### Ana Sayfalar
| Sayfa | URL | Açıklama |
|-------|-----|----------|
| **Kiosk** | `/kiosk` | Müşteri sıra alır (normal + öncelikli) |
| **Banko Paneli** | `/bank` | Görevli sıra çağırır, işlem yapar |
| **Admin Paneli** | `/admin` | Tüm yönetim ayarları |
| **Display Ekran** | `/display` | Bekleyen + çağrılan sıraları gösterir |
| **Raporlar** | `/reports` | İstatistikler ve grafikler |

### Teknoloji Yığını
- **Server**: Node.js + Express + tRPC + Socket.IO + sql.js (in-memory SQLite)
- **Client**: React 19 + Vite + Tailwind CSS 4 + shadcn/ui + tRPC React Query
- **Display (sesli)**: Electron + Web Speech API + Web Audio API (MP3)
- **Database**: sql.js (SQLite WASM, 1s debounce ile diske yazılır)
- **Build**: esbuild (server) + Vite (client)

---

## 2. KLASÖR YAPISI

```
siramatik/
├── server/                    # Sunucu kaynak kodu
│   ├── _core/                 # Ana sunucu modülleri
│   │   ├── index.ts           # Express sunucu başlatma, middleware, tRPC, Socket.IO
│   │   ├── socket.ts          # Socket.IO olay yönetimi
│   │   ├── trpc.ts            # tRPC yönlendirici ve middleware (public/protected/admin)
│   │   ├── context.ts         # tRPC context (auth + db)
│   │   ├── vite.ts            # Statik dosya sunma + Vite dev/prod ayrımı
│   │   ├── env.ts             # Ortam değişkenleri
│   │   ├── discovery.ts       # UDP broadcast ile sunucu keşfi (port 31234)
│   │   ├── notification.ts    # Push bildirimler (opsiyonel)
│   │   ├── oauth.ts           # OAuth rotaları (eski Manus, şu an kullanılmıyor)
│   │   ├── sdk.ts             # OAuth SDK (eski Manus, kullanılmıyor)
│   │   ├── analytics.ts       # Analytics (kullanılmıyor)
│   │   ├── export.ts          # CSV/PDF export
│   │   ├── printer.ts         # ESC/POS yazıcı
│   │   ├── printer-usb.ts     # USB termal yazıcı
│   │   ├── native-printer.ts  # Windows GDI yazıcı
│   │   ├── windows-printer.ts # Windows yazıcı (alternatif)
│   │   ├── windows-print-api.ts
│   │   ├── windows-direct-print.ts
│   │   ├── windows-printer-detect.ts
│   │   ├── email.ts           # E-posta (opsiyonel)
│   │   ├── cookies.ts         # Çerez yönetimi
│   │   ├── systemRouter.ts    # tRPC system rotaları (health, notifyOwner)
│   │   └── types/             # Tip tanımlamaları
│   ├── routers.ts              # TÜM tRPC prosedürleri (queue, bank, admin)
│   ├── db.ts                   # Veritabanı işlemleri (2473 satır)
│   └── *.test.ts               # Test dosyaları
├── client/                     # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminPanel.tsx      # Admin paneli (1353 satır)
│   │   │   ├── BankPanel.tsx       # Banko paneli (584 satır)
│   │   │   ├── DisplayScreen.tsx   # Display ekran (625 satır)
│   │   │   ├── Kiosk.tsx           # Kiosk ekranı
│   │   │   ├── Home.tsx            # Ana sayfa
│   │   │   ├── ReportingDashboard.tsx
│   │   │   └── NotFound.tsx
│   │   ├── components/             # Paylaşılan UI bileşenleri (shadcn/ui)
│   │   ├── hooks/                  # React hook'ları
│   │   ├── contexts/               # React context'leri
│   │   ├── lib/                    # Yardımcı fonksiyonlar
│   │   ├── App.tsx                 # Router yapılandırması
│   │   └── main.tsx                # Giriş noktası
│   └── index.html
├── electron/                   # Electron masaüstü uygulaması
│   └── main.cjs               # Electron main process (320 satır)
├── installer/                  # Kurulum dosyaları
│   ├── ServerInstaller.cs      # WinForms GUI kurulum (404 satır)
│   ├── make-setup.ps1          # Self-extracting .exe oluşturucu
│   ├── server-setup.bat        # Sunucu kurulum scripti
│   └── bank-setup.bat          # Banko kurulum scripti
├── dist/                       # Build çıktıları
│   ├── index.js                # Derlenmiş sunucu (esbuild)
│   ├── public/                 # Derlenmiş client (Vite build)
│   └── setup/                  # Kurulum .exe'leri
├── release/                    # Medya dosyaları
│   └── Media/Notification/     # MP3 bildirim sesleri
├── shared/                     # Paylaşılan sabitler
│   └── const.ts
├── siramatik.db                # SQLite veritabanı (otomatik oluşur)
├── package.json                # Bağımlılıklar ve script'ler
├── vite.config.ts              # Vite yapılandırması
└── .env                        # Ortam değişkenleri (PORT, NODE_ENV, JWT_SECRET)
```

---

## 3. VERİTABANI ŞEMASI

### `system_config` (tek satır, id=1)
Sistem yapılandırmasının tamamı bu tabloda saklanır.

| Sütun | Tip | Varsayılan | Açıklama |
|-------|-----|-----------|----------|
| id | INTEGER | 1 | PK |
| total_banks | INTEGER | 5 | Banko sayısı |
| current_queue_number | INTEGER | 0 | Son sıra numarası |
| is_system_active | INTEGER | 0 | Sistem açık/kapalı |
| system_name | TEXT | "SIRAMATİK" | Sistem adı |
| queue_prefix | TEXT | "" | Sıra öneki (A, B, vs.) |
| max_queue_number | INTEGER | 0 | Max sıra (0=sınırsız) |
| business_hours_start | TEXT | "09:00" | Açılış saati |
| business_hours_end | TEXT | "18:00" | Kapanış saati |
| working_days | TEXT | "1,2,3,4,5" | Çalışma günleri (1=Pzt...7=Paz) |
| kiosk_mode | TEXT | "touch" | Dokunmatik/fare modu |
| kiosk_message | TEXT | "" | Kiosk alt mesajı |
| weather_city | TEXT | "" | Hava durumu şehri |
| announcements | TEXT | "" | Duyuru metni (ticker) |
| ticker_speed | INTEGER | 8 | Duyuru hızı (ms) |
| ticker_font_size | INTEGER | 22 | Duyuru font boyutu |
| theme_bg | TEXT | "#000000" | Arka plan rengi |
| theme_text | TEXT | "#ffffff" | Yazı rengi |
| theme_header | TEXT | "#ff006e" | Başlık rengi |
| theme_subheader | TEXT | "#00d9ff" | Alt başlık rengi |
| theme_font | TEXT | "Courier New..." | Font ailesi |
| theme_border | TEXT | "#1b98a0" | Kenarlık rengi |
| theme_font_size | INTEGER | 16 | Font boyutu (10-60px) |
| serial_btn1_action | TEXT | "simple_ticket" | Arduino BTN1 aksiyonu |
| serial_btn2_action | TEXT | "priority_elderly" | Arduino BTN2 aksiyonu |
| superadmin_passcode | TEXT | "1234" | Superadmin şifresi |
| queue_date | TEXT | "" | Son sıfırlama tarihi (YYYY-MM-DD) |

### `banks`
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER | PK |
| bank_number | INTEGER | Banko numarası |
| is_active | INTEGER | Banko aktif mi |
| is_occupied | INTEGER | Banko dolu mu |
| current_queue_entry_id | INTEGER | Mevcut işlemdeki sıra ID |
| total_served | INTEGER | Toplam işlem sayısı |
| ip_address | TEXT | Banko PC IP adresi |
| mac_address | TEXT | Banko PC MAC adresi |
| assigned_operator_id | INTEGER | Atanmış operatör ID |
| created_at / updated_at | INTEGER | Zaman damgası |

### `queue_entries`
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER | PK |
| ticket_number | INTEGER | Sıra numarası |
| phone_number | TEXT | Telefon (opsiyonel) |
| priority_type | TEXT | "none"/"elderly"/"disabled"/"pregnant" |
| is_priority | INTEGER | Öncelikli mi (1/0) |
| status | TEXT | "waiting"/"called"/"in_progress"/"completed"/"no_show"/"cancelled" |
| bank_id | INTEGER | Hangi bankoda |
| operator_id | INTEGER | Hangi operatörde |
| called_at / started_at / completed_at | INTEGER | Zaman damgaları |
| service_time_ms | INTEGER | İşlem süresi (ms) |
| created_at / updated_at | INTEGER | Oluşturma/güncelleme |

Index'ler: `idx_queue_status`, `idx_queue_created`, `idx_queue_completed`, `idx_queue_bank`, `idx_queue_operator`, `idx_queue_priority`

### `sound_settings` (tek satır, id=1)
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| sound_type | TEXT | Ses tipi ("chime", "bell", "ding", "ring", "alert" vb.) |
| sound_volume | INTEGER | Ses seviyesi (0-100) |
| is_enabled | INTEGER | Ses açık mı |
| voice_enabled | INTEGER | TTS açık mı |
| notification_sound | TEXT | Hangi MP3 dosyası |
| animation_type / animation_speed | TEXT | Animasyon ayarları |

### `label_settings` — Etiket/bilet tasarımı (çoklu)
58 sütun (genişlik, font boyutları, renkler, QR/barkod, logo vb.)

### `printer_settings` (tek satır)
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| windows_printer_name | TEXT | Windows yazıcı adı |
| vendor_id / product_id | INTEGER | USB yazıcı VID/PID |
| printer_type | TEXT | "escpos" / "windows" |

### `bank_operators` — Banko operatörleri
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| name | TEXT | Operatör adı |

---

## 4. tRPC API

Tüm prosedürler `/api/trpc` üzerinden çağrılır.

### `queue.*`
| Prosedür | Tip | Input | Açıklama |
|----------|-----|-------|----------|
| `createTicket` | mutation | `{ phoneNumber?: string }` | Normal sıra oluştur |
| `createPriorityTicket` | mutation | `{ priorityType: "elderly"|"disabled"|"pregnant", phoneNumber? }` | Öncelikli sıra |
| `getWaitingQueue` | query | - | Bekleyen sıralar (öncelik sıralı) |
| `getStats` | query | - | Kuyruk istatistikleri |
| `getRecentTickets` | query | - | Son ticketlar |
| `getQueueCount` | query | - | Bekleyen sayısı |

### `bank.*`
| Prosedür | Tip | Input | Açıklama |
|----------|-----|-------|----------|
| `getAll` | query | - | Tüm bankolar |
| `getMyBank` | query | `{ macAddress: string }` | MAC'e göre banko bul (IP fallback) |
| `assignToBank` | mutation | `{ bankId, entryId }` | Sırayı bankoya ata |
| `callNext` | mutation | `{ bankId, operatorId? }` | Sonraki sırayı çağır |
| `completeService` | mutation | `{ entryId, bankId }` | İşlemi tamamla |
| `cancelTicket` | mutation | `{ entryId }` | Sırayı iptal et |
| `skipNoShow` | mutation | `{ entryId, bankId }` | Müşteri gelmedi (no_show) |
| `requeueEntry` | mutation | `{ entryId, bankId }` | Pas geç, sırayı kuyruk sonuna ekle |
| `searchTicket` | query | `{ ticketNumber }` | Sıra ara |

### `admin.*`
| Prosedür | Tip | Açıklama |
|----------|-----|----------|
| `getConfig` | query | Sistem yapılandırması |
| `initialize` | mutation | Sistemi başlat (banko sayısı ile) |
| `shutdown` | mutation | Sistemi kapat + kuyruğu sıfırla |
| `resetQueue` | mutation | Kuyruğu sıfırla |
| `updateBankCount` | mutation | Banko sayısını güncelle |
| `toggleBankStatus` | mutation | Banko aktif/pasif |
| `updateSystemSettings` | mutation | Tüm sistem ayarlarını güncelle |
| `verifyPasscode` | mutation | Superadmin şifre doğrulama |
| `getConnectedBanks` | query | Bağlı banko listesi (socket üzerinden) |
| `getBankOperators` | query | Tüm operatörler |
| `createBankOperator` / `updateBankOperator` / `deleteBankOperator` | mutation | Operatör CRUD |
| `updateBankIpAddress` / `updateBankMacAddress` | mutation | Banko IP/MAC güncelle |
| `assignBankOperator` | mutation | Operatör ata |
| *Printer:* `getPrinterSettings`, `updatePrinterSettings`, `testPrinter`, `testWindowsPrinterEndpoint`, `listWindowsPrinters`, `listUSBPrinters` | query/mutation | Yazıcı yönetimi |
| *Label:* `getAllLabelSettings`, `getLabelSettings`, `updateLabelSettings`, `createLabelSettings`, `deleteLabelSettings`, `setDefaultLabelSettings` | query/mutation | Etiket tasarımı |

---

## 5. SOCKET.IO OLAYLARI

Bağlantı: `http://localhost:3000` (CORS: localhost:3000, 127.0.0.1:3000, localhost:5173)

### Client → Server
| Olay | Veri | Açıklama |
|------|------|----------|
| `register` | `{ type, bankId? }` | Client tipini kaydet |
| `ticket:created` | `{ ticketNumber, entryId }` | Yeni sıra (kiosk'tan) |
| `customer:called` | `{ ticketNumber, bankId, entryId, ... }` | Sıra çağrıldı (banko'dan) |
| `service:completed` | `{ ticketNumber, bankId, entryId }` | İşlem bitti |
| `bank:statusChanged` | `{ bankId, isOccupied, isActive }` | Banko durumu değişti |
| `system:configUpdated` | `{ totalBanks }` | Yapılandırma güncellendi |
| `system:requestState` | - | Tam durum iste |

### Server → Client
| Olay | Veri | Açıklama |
|------|------|----------|
| `system:state` | `{ config, banks, waitingQueue, stats }` | Tam sistem durumu |
| `customer:called` | `{ ticketNumber, bankId, entryId, ... }` | Sıra çağrıldı |
| `notification:play` | `{ type, ticketNumber, bankId }` | Bildirim sesi çal |
| `service:completed` | `{ ticketNumber, bankId, entryId }` | İşlem bitti |
| `ticket:created` | `{ ticketNumber, entryId }` | Yeni sıra |
| `bank:statusChanged` | `{ bankId, isOccupied, isActive }` | Banko durumu |
| `system:configUpdated` | `{ totalBanks }` | Yapılandırma |
| `system:shutdown` | `{ timestamp }` | Sistem kapandı (tüm sayfalar yeniden yüklenir) |

### ÖNEMLİ UYARI
`notification:play` YALNIZCA `emitCustomerCalled()` fonksiyonu içinde emit edilir.
Banko paneli asla doğrudan `notification:play` emit etmez.
DisplayScreen'de `customer:called` handler'ı hem TTS (Web Speech) hem de MP3 oynatmayı tetikler.

---

## 6. BANKO PC TANIMA (MAC + IP)

1. Electron (veya Node.js) üzerinden gerçek MAC adresi okunur
2. Browser'da ise `localStorage.getItem("bank-machine-id")` ile UUID oluşturulur
3. `trpc.bank.getMyBank.useQuery({ macAddress })` çağrılır
4. Sunucu önce `mac_address` kolonunda arar, bulamazsa `ip_address`'e bakar (fallback)
5. Banko bulunamazsa "TANIMSIZ BANKO" hatası döner

### Kod Akışı (BankPanel.tsx)
```
getMacAddress()  →  trpc.bank.getMyBank({ macAddress })
    →  server/routers.ts: bank.getMyBank
    →  db.ts: findBankByMacAddress(mac)
    →  bulamazsa → findBankByIpAddress(ip)
    →  döndürür: { bank: { id, bankNumber, ... }, isAssigned, operator? }
```

---

## 7. SIRA YÖNETİM MANTIĞI

### Sıra Oluşturma (Kiosk)
1. İş saatleri ve çalışma günü kontrolü
2. `incrementQueueNumber()` → bugünün tarihi farklıysa 0'dan başla
3. `createQueueEntry(ticketNumber, priorityType, phoneNumber)`
4. Windows yazıcıya yazdır (arka planda, try/catch ile)
5. USB termal yazıcıya yazdır (arka planda, try/catch ile)
6. Socket `ticket:created` emit et
7. 5 saniye cooldown (kiosk butonları countdown gösterir)

### Sıra Çağırma (Banko)
1. `callNext(bankId)` → kuyruktan ilk sırayı al
2. Öncelikli sıralar (`is_priority=1`) önce çağrılır (ORDER BY is_priority DESC, created_at ASC)
3. Sırayı bankoya ata (`bank_id` ve `bank.current_queue_entry_id`)
4. `emitCustomerCalled()` → Socket ile `customer:called` + `notification:play` emit et
5. Kiosk ve Display ekranları anında güncellenir

### ÖNEMLİ: Requeue / Pas Geç
- `skipNoShow()` → sıra `no_show` statüsüne alınır, banko serbest bırakılır
- `requeueEntry()` → sıra `waiting` statüsüne döner, `bank_id=null`, `is_priority=0`
  → **Kuyruk SONUNA** eklenir, bankoya otomatik atanmaz
- "BOŞ GEÇİLENLER" listesinde tıklanabilir numaralar gösterilir

### Günlük Sıfırlama
- `queue_date` kolonu her sıra oluşturmada kontrol edilir
- Bugünün tarihi kayıtlı tarihten farklıysa `current_queue_number=0` yapılır
- Yeni günün ilk sırası 1'den başlar

### Otomatik Kapanma
- Sunucu başlarken + her 30 saniyede `checkBusinessHours()` çalışır
- İş saati + çalışma günü kontrolü
- Dışındaysa: `isSystemActive=false`, `resetQueue()`, `system:shutdown` emit
- SADECE otomatik kapatma vardır, otomatik açma YOKTUR (admin manuel açar)

---

## 8. DISPLAY EKRANI (DisplayScreen.tsx)

### Tasarım
- Sol taraf: **BEKLEYENLER** — kuyruktaki sıralar (öncelikliler ⭐ ile işaretli)
- Sağ taraf: **AKTİF BANKOLAR** — bankolar ve mevcut sıraları
- Alt kısım: duyuru ticker'ı

### Ses Sistemi (KRİTİK)
1. `customer:called` alındığında direkt olarak:
   - `speakNotification()` → Web Speech API (TTS, tr-TR)
   - `playNotificationSound()` → MP3 oynatma
2. MP3 dosyaları `release/Media/Notification/` klasöründen `/notification-sounds/` ile sunulur
3. `AudioContext.decodeAudioData()` ile çözülür, `AudioBufferSourceNode` ile oynatılır
4. `voice_enabled` toggle ile TTS açılıp kapatılabilir
5. `soundSettings.notificationSound` ile hangi MP3'in çalınacağı seçilir
6. **Enterprise Chromium Autoplay**: Electron `autoplayPolicy: 'no-user-gesture-required'` ile aşılır

---

## 9. ELEKTRON (electron/main.cjs)

### Display Modu
- `createDisplayWindow()` → extended (non-primary) monitörde açar
- URL: `http://localhost:3000/display` (bank IP restriction middleware'ini atlar)
- CSP: `session.webRequest.onHeadersReceived` ile eklenir
- `app.requestSingleInstanceLock()` → tek instance garantisi
- `second-instance` → mevcut pencereye odaklanır, yeni açmaz

### UDP Discovery (port 31234)
- Sunucu (`discovery.ts`) her 5 saniyede bir UDP broadcast yapar
- Electron istemcisi broadcast'i dinler, sunucu IP'sini otomatik bulur
- `config.json` dosyasına kaydeder (`app.getPath("userData")`)
- Sunucu IP değişirse sessizce günceller

### IPC Kanalları
- `window-minimize`, `window-close` — pencere kontrolü
- `get-config`, `save-config` — sunucu URL yapılandırması

---

## 10. ARDUINO ENTEGRASYONU (ATtiny85)

### Donanım
- ATtiny85 mikrodenetleyici
- BTN1 = pin D2 (INPUT_PULLUP, GND)
- BTN2 = pin D3 (INPUT_PULLUP, GND)
- USB-seri dönüştürücü üzerinden bilgisayara bağlı

### Yazılım
- `attiny85_ticket_button/attiny85_ticket_button.ino`
- Seri porttan "1" veya "2" gönderir
- Banko paneli `Web Serial API` ile bağlanır (`getPorts()`)
- `serial_btn1_action` ve `serial_btn2_action` ayarlarına göre aksiyon alır

### Web Serial API
- Kiosk browser'da `navigator.serial.getPorts()` ile otomatik bağlanır
- İlk kurulumda `requestPort()` ile kullanıcı seçer (user gesture gerekli)
- Sonraki açılışlarda `getPorts()` ile otomatik bağlanır

---

## 11. SES DOSYALARI (MP3)

### Konum
```
release/Media/Notification/
├── chime.mp3
├── bell.mp3
├── ding.mp3
├── ring.mp3
├── alert.mp3
├── notification.mp3
```

### Sunum
- Express static middleware: `app.use("/notification-sounds", express.static(...))`
- `soundSettings.notification_sound` = dosya adı (uzantısız)
- URL: `/notification-sounds/{sound}.mp3`

### Oynatma (Display)
```typescript
const response = await fetch(`/notification-sounds/${sound}.mp3`);
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start();
```

---

## 12. GÜVENLİK

### Bank IP Restriction (index.ts)
- `x-forwarded-for` veya `remoteAddress` alınır
- `banks` tablosundaki IP'lerle karşılaştırılır
- Eşleşen IP → yalnızca `/bank`, `/api/`, `/assets/` sayfalarına erişebilir
- Diğer sayfalar `/bank`'a redirect edilir
- **Display ekranı** `http://localhost:3000` üzerinden erişerek bu restriction'ı atlar

### Superadmin
- Şifre `system_config.superadmin_passcode` kolonunda (plain text)
- Doğrulama: `trpc.admin.verifyPasscode` → başarılıysa token (sessionStorage)
- Token'ı sunucu `Map<string, number>` ile tutar, 1 saat geçerli
- Server restart'ta token'lar silinir (yeniden giriş gerekir)

### CORS
- Socket.IO sadece localhost'a izin verir
- Express middleware ekstra güvenlik katmanı

### CSP (Electron)
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (Vite HMR için unsafe-eval gerekli)
- `style-src 'self' 'unsafe-inline'`
- `connect-src 'self' ws: http://localhost:*`

---

## 13. PERFORMANS

### Veritabanı
- **sql.js** (SQLite WASM) — in-memory, 1s debounce ile diske yazılır
- `saveDb()` setTimeout ile geciktirilir, ardışık yazmalar tek seferde birleşir
- 6 adet index: status, created_at, completed_at, bank_id, operator_id, is_priority

### Polling
- tRPC query'lerde `refetchInterval`:
  - Admin: 5sn (config, banks, connected banks)
  - Banko: 10sn (banks), 15sn (config), 30sn (myBank)
  - Kiosk: 5sn (queue count)
  - Display: socket üzerinden gerçek zamanlı (polling yok / minimum)

### Socket
- `socket.io` ile gerçek zamanlı veri akışı
- Tüm istemciler `system:state` ile broadcast alır
- `reconnection: true, reconnectionAttempts: Infinity` (bağlantı koparsa sürekli dener)
- Bağlantı yeniden kurulunca sayfa yeniden yüklenir (`onconnect` → `location.reload()`)

---

## 14. KURULUM SİSTEMİ

### Self-Extracting .exe (C# + ZIP)
1. C# stub derlenir (WinForms GUI veya console)
2. ZIP arşivi oluşturulur (tüm paket dosyaları)
3. ZIP, stub .exe'nin sonuna eklenir
4. 4-byte footer: ZIP boyutu (Int32, little-endian)
5. .exe çalıştırılınca kendi sonundan ZIP boyutunu okur, çıkartır

### ServerInstaller.cs (WinForms)
- Klasör seçici (FolderBrowserDialog)
- Node.js otomatik algılama + indirme (v22.14.0)
- 3000 port kontrolü (kullanımda hata)
- npm install —production —legacy-peer-deps —ignore-scripts
- **Gerçek zamanlı log**: `TaskCompletionSource` + `Exited` event ile non-blocking UI
- `Application.DoEvents()` — extract/copy döngülerinde UI donmasını önler
- Scheduled task (bilgisayar açılışında otomatik başlatma)
- Desktop shortcut
- Windows Firewall rule (port 3000)
- `.env` dosyası otomatik oluşturma (JWT_SECRET ile)

### Kurulum Dizini Yapısı
```
C:\Siramatik\Server\
├── server\index.js        # Derlenmiş sunucu
├── client\                # Derlenmiş client (Vite build)
├── shared\                # Paylaşılan modüller
├── release\               # Medya (notification sesleri)
├── node_modules\          # Bağımlılıklar
├── siramatik.db           # Veritabanı
├── package.json
├── .env                   # Ortam değişkenleri
├── baslat.bat             # Başlatma scripti
└── setup.bat              # Kurulum scripti (çalıştırıldıktan sonra silinebilir)
```

### Bank Display Kurulumu
- Console stub .exe (13 KB)
- Electron binary'sini otomatik indirir (~65 MB)
- `http://localhost:3000` adresine bağlanır
- Extended monitörde display ekranını açar

---

## 15. ORTAM DEĞİŞKENLERİ (.env)

```env
PORT=3000                    # Sunucu portu (3000-3019 arası dener)
NODE_ENV=production          # development/production
JWT_SECRET=<random>          # Session şifreleme anahtarı
# Aşağıdakiler zorunlu DEĞİL (eski/opsiyonel):
# OAUTH_SERVER_URL=
# DATABASE_URL=
# VITE_APP_ID=
```

### production vs development
- `NODE_ENV=production`: Static dosyaları `dist/public/` veya `../client/`'den sunar
- `NODE_ENV=development`: Vite HMR sunucusu kullanır (port 5173)
- Geliştirmede: `npm run dev` (tsx watch ile hot reload)
- Üretimde: `node dist/index.js` (esbuild ile derlenmiş)

---

## 16. VITE.TS — STATİK DOSYA SUNMA

```typescript
// 1. Önce import.meta.dirname + "/public" dener
// 2. Bulamazsa import.meta.dirname + "/../client" dener (kurulum yapısı)
export function serveStatic(app: Express) {
  let distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(import.meta.dirname, "..", "client");
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
```

---

## 17. YAZICI DESTEĞİ

### Üç farklı yazıcı modülü:
| Modül | Bağımlılık | Teknoloji |
|-------|-----------|-----------|
| `printer.ts` | escpos | Node.js ESC/POS doğrudan |
| `printer-usb.ts` | usb | USB üzerinden termal yazıcı |
| `native-printer.ts` | @grandchef/node-printer | Windows GDI yazıcı |

### Yazdırma Akışı (Ticket oluşturunca):
1. `trpc.queue.createTicket` → server/routers.ts
2. Windows yazıcıya dene: `windowsPrinterName` varsa `printToWindowsPrinter()`
3. USB yazıcıya dene: `initializeUSBPrinter()` + `printUSBTicket()`
4. İkisi de try/catch ile sarılır, hata sessizce loglanır

---

## 18. TEMA SİSTEMİ

### Özellikler
- 7 hazır tema: Cyberpunk, Okyanus, Klasik, Orman, Günbatımı, Gece Mavisi, Lavanta
- Özel renk seçimi: arka plan, yazı, başlık, alt başlık, kenarlık
- Font seçimi: `Courier New, Arial, Georgia, Tahoma, Segoe UI, Verdana`
- Font boyutu: 10-60px arası slider
- Tüm ayarlar `system_config` tablosunda
- `ThemeContext.tsx` ile client tarafında CSS değişkenleri olarak uygulanır

---

## 19. RAPORLAR / İSTATİSTİK

- `ReportingDashboard.tsx` — tüm istatistik ve grafik sayfası
- `trpc.admin.getQueueStats` ile veri alınır
- `trpc.admin.exportCSV` / `exportPDF` ile dışa aktarım
- Grafikler: günlük/saatlik işlem sayısı, banko bazında performans, öncelik dağılımı

---

## 20. BİLİNMESİ GEREKEN KRİTİK NOKTALAR

### Ses (Autoplay)
- Enterprise Chromium'da `AutoplayAllowed=0` tüm otomatik sesi engeller
- Electron `autoplayPolicy: 'no-user-gesture-required'` ile aşılır
- Display paneli asla browser'da değil, Electron'da açılmalıdır

### Bank IP Restriction
- Display `/display` sayfası bank IP'sinden açılırsa `/bank`'a yönlendirilir
- Çözüm: `http://localhost:3000/display` kullanın (Electron'da otomatik)

### useSocket Çift Abonelik (DÜZELTİLDİ)
- Eski kodda `on()` içinde `Object.keys(handlersRef.current).forEach(...)` tüm handler'ları dinliyordu
- Bu catch-all listener KALDIRILDI
- Her handler sadece `socket.on(eventName, ...)` ile dinlenir

### notification:play Çift Emisyon (DÜZELTİLDİ)
- Banko paneli `customer:called` emit eder, server socket handler'ı `emitCustomerCalled()` çağırır
- `emitCustomerCalled()` ZATEN `notification:play` emit eder
- Banko paneli asla doğrudan `notification:play` emit etmemelidir

### sql.js Sınırlaması
- In-memory SQLite, tüm veri RAM'de tutulur
- Büyük veri setlerinde sorun çıkarabilir
- `saveDb()` 1s debounce ile diske yazar, sık yazmalarda veri kaybı riski minimal
- better-sqlite3'e geçiş planlanmış ancak ertelenmiştir

### Superadmin Token
- Server'da `Map<string, number>` ile RAM'de tutulur
- Server restart'ta tüm token'lar silinir → yeniden giriş gerekir

### OAuth (Eski Manus)
- `/server/_core/sdk.ts` ve `oauth.ts` — eski Manus OAuth sistemi
- Şu an kullanılmıyor, `OAUTH_SERVER_URL` set edilmezse hata loglanır ama çalışmayı engellemez
- Silinmesi güvenlidir ancak `routers.ts` ve `index.ts`'de import'ları var

### .env Dosyası
- Kurulumda otomatik oluşturulur (JWT_SECRET ile)
- Yoksa OAuth uyarısı + JWT çalışmaz
- `server-setup.bat` ve `ServerInstaller.cs` her ikisi de `.env` oluşturur

### Node.js Gereksinimi
- v18+ gerekli, v22.14.0 önerilir
- `--legacy-peer-deps` npm install'da gerekebilir
- `--ignore-scripts` native modül derleme hatalarını önler (lazy try/catch ile)

---

## 21. TEST ETME

```bash
# Tüm testler
npm test

# Server build (production)
npm run build

# Development
npm run dev

# Production
npm start
```

Test dosyaları: `server/*.test.ts` (vitest ile çalışır)

---

## 22. GELİŞTİRİCİ NOTLARI

### Yeni bir sayfa eklemek
1. `client/src/pages/`'de .tsx dosyası oluştur
2. `client/src/App.tsx`'de route ekle (`<Route path="/yeni" component={YeniSayfa} />`)
3. Gerekirse tRPC prosedürü ekle (`server/routers.ts`)

### Yeni bir tRPC prosedürü
1. `server/routers.ts`'de uygun router altına ekle
2. Input validation için `z.object({...})` kullan
3. `publicProcedure` / `adminProcedure` seçimini doğru yap
4. Client'ta `trpc.router.procedure.useQuery()` veya `useMutation()` ile çağır

### Yeni bir veritabanı kolonu
1. `server/db.ts`'de `runMigrations()` içine ALTER TABLE ekle
2. Mevcut `system_config` için kolon adını `sysColNames.includes(...)` ile kontrol et
3. executeUpdate() ile ALTER TABLE çalıştır

### Yeni bir Socket.IO olayı
1. `server/_core/socket.ts`'de `socket.on("olay:adı", handler)` ekle
2. Client'ta `useSocket()` hook'u ile `socket.on("olay:adı", handler)` bağla
3. Server'dan emit etmek için `io.emit("olay:adı", data)` kullan
