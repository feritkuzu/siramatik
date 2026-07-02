# Sıramatik Sistemi - Detaylı Teknik Analiz Raporu

---

## 1. GENEL BAKIŞ

**Sıramatik**, müşteri sıra yönetim sistemi (queue management system) olup, banka, hastane, devlet dairesi gibi kurumlarda müşterilerin sıra almasını, bankolara yönlendirilmesini ve istatistiklerin tutulmasını sağlayan tam teşekküllü bir web uygulamasıdır.

---

## 2. MİMARİ YAPI

### 2.1 Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| **Backend** | Express.js, Node.js, tRPC 11 |
| **Veritabanı** | SQLite (sql.js ile in-memory + dosyaya yazma) |
| **Gerçek Zamanlı** | Socket.io (WebSocket) |
| **API Katmanı** | tRPC (end-to-end typesafe API) |
| **Masaüstü** | Electron (isteğe bağlı Windows paketleme) |
| **ORM** | Drizzle ORM (şema tanımı için) |
| **State Yönetimi** | TanStack React Query (server state) |
| **Router** | wouter (hafif SPA router) |
| **UI Kütüphanesi** | Radix UI + shadcn/ui bileşenleri |
| **Grafik** | Recharts (raporlama) |
| **Test** | Vitest |

### 2.2 Sistem Bileşenleri (4 Ana Ekran)

```
┌──────────────────────────────────────────────────────────────┐
│                       EXPRESS SERVER                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  tRPC API   │  │  Socket.io   │  │  OAuth + Statik  │    │
│  │  (routers)  │  │  (WS)        │  │  Dosya Servisi   │    │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────┘    │
│         │               │                                     │
│  ┌──────┴───────────────┴────────────────────────────────┐   │
│  │               DATABASE (SQLite)                        │   │
│  │  system_config | banks | queue_entries | system_logs  │   │
│  │  users | sound_settings | ticket_design | label_set.  │   │
│  │  printer_settings | bank_operators                    │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         ▲               ▲               ▲               ▲
         │               │               │               │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │  KIOSK  │    │  ANA    │    │  BANKO  │    │  ADMIN  │
    │ (Sıra   │    │ MONİTÖR│    │ PANELİ  │    │ PANELİ  │
    │  Alma)  │    │(Ekran)  │    │(Görevli)│    │(Yönetici)│
    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 2.3 Client Routes (wouter)

| Route | Sayfa | Açıklama |
|-------|-------|----------|
| `/` | Home | Giriş/karşılama sayfası |
| `/kiosk` | Kiosk | Müşteri sıra alma ekranı (dokunmatik) |
| `/display` | DisplayScreen | Bekleme salonu ana monitörü |
| `/bank` | BankPanel | Banko görevlisi paneli |
| `/admin` | AdminPanel | Sistem yönetim paneli |
| `/reports` | ReportingDashboard | Raporlama ve analitik |

---

## 3. VERİTABANI ŞEMASI (SQLite)

### 3.1 Tablolar

| Tablo | Açıklama | Temel Alanlar |
|-------|----------|---------------|
| `system_config` | Sistem yapılandırması | total_banks, queue_number, business_hours, theme (renk/yazı tipi), kiosk_mode, weather_city, working_days, announcements, ticker_speed |
| `banks` | Banko kayıtları | bank_number, is_active, is_occupied, current_queue_entry_id, assigned_operator_id, ip_address, total_served |
| `queue_entries` | Sıra kayıtları | ticket_number, phone_number, priority_type, status (waiting/called/serving/completed/cancelled), service_time_ms |
| `system_logs` | Sistem logları | event_type, bank_id, queue_entry_id, metadata (JSON) |
| `users` | Kullanıcılar | openId, name, email, role (user/admin) |
| `sound_settings` | Ses ve animasyon | sound_type, volume, is_enabled, animation_type/speed |
| `printer_settings` | Yazıcı ayarları | vendor_id, product_id, printer_type, windows_printer_name |
| `ticket_design` | Bilet tasarımı | company_name, subtitle, logo_url, header/footer text, ticket_width, show_* flags |
| `label_settings` | Etiket tasarımı (gelişmiş) | label_name, type, width/height, font sizes (header/queue/bank/datetime), QR/barcode, colors, border, logo, custom messages |
| `bank_operators` | Banko operatörleri | name |

### 3.2 Sıra Durum Makinesi

```
waiting ──► called ──► received ──► completed
                │
                └──► no_show

Herhangi bir aşamada: cancelled (admin reset)
```

---

## 4. API KATMANI (tRPC Router Yapısı)

### 4.1 Router Hiyerarşisi

```
appRouter
├── queue
│   ├── createTicket(phoneNumber?) → { ticketNumber, entryId }
│   ├── createPriorityTicket(priorityType, phoneNumber?) → { ... }
│   ├── getWaitingQueue → QueueEntry[]
│   ├── getNextWaitingEntry → QueueEntry | null
│   ├── updateQueueEntryStatus(entryId, status)
│   ├── callNext(bankId) → { ticketNumber, ... }
│   ├── callSpecific(bankId, entryId) → { ... }
│   ├── markReceived(entryId)
│   ├── skipNoShow(bankId, entryId) → { nextCustomer }
│   ├── completeService(bankId, entryId)
│   ├── getEstimatedWaitTime(ticketNumber) → { waitMs }
│   └── getStats → { totalTickets, waitingCount, avgServiceTime, ... }
│
├── bank
│   ├── getAll → Bank[]
│   ├── getAvailable → Bank | null
│   └── getMyBank → Bank | null (IP bazlı)
│
├── admin
│   ├── initialize(bankCount) → Sistem başlatma
│   ├── getConfig → SystemConfig
│   ├── updateBankCount(count) / toggleBankStatus(bankId)
│   ├── getBankOperators / createBankOperator / updateBankOperator / deleteBankOperator
│   ├── assignBankOperator(bankId, operatorId)
│   ├── updateBankIpAddress(bankId, ipAddress)
│   ├── updateSystemSettings(partial config)
│   ├── getSoundSettings / updateSoundSettings
│   ├── getPrinterSettings / updatePrinterSettings
│   ├── testPrinter / listUSBPrinters / listWindowsPrinters
│   ├── testWindowsPrinterEndpoint
│   ├── resetQueue
│   ├── getTicketDesign / updateTicketDesign
│   ├── getLabelSettings / getAllLabelSettings / updateLabelSettings
│   ├── createLabelSettings / deleteLabelSettings / setDefaultLabelSettings
│   └── getDefaultWindowsPrinter
│
├── analytics
│   ├── generateReport(startDate, endDate) → istatistikler
│   ├── getBankPerformance → banka performans
│   ├── getDailyStats(date) / getHourlyStats(date)
│
├── weather
│   └── getCurrent → { temp, desc, icon, ... } (wttr.in API)
│
└── auth
    ├── me → user | null
    └── logout
```

---

## 5. GERÇEK ZAMANLI İLETİŞİM (Socket.io)

| Event | Yön | Açıklama |
|-------|-----|----------|
| `register` | Client→Server | Tip bildirimi (kiosk/display/bank/admin) |
| `ticket:created` | Client→Server→All | Yeni sıra oluşturuldu |
| `customer:called` | Server→All | Müşteri çağrıldı + bildirim sesi tetikler |
| `service:completed` | Server→All | İşlem tamamlandı |
| `bank:statusChanged` | Server→All | Banko açıldı/kapandı |
| `system:configUpdated` | Server→All | Yapılandırma değişti |
| `notification:play` | Server→Display | Ses çalma komutu |
| `system:state` | Server→Client | Tam sistem durumu broadcast |
| `system:requestState` | Client→Server | State talep etme |

---

## 6. İŞ AKIŞI (ÇALIŞMA MANTIĞI)

### 6.1 Sıra Alma (Kiosk)

1. Kiosk ekranı açılır, sistem config'ini kontrol eder
2. Çalışma saatleri ve günü kontrol edilir (mesai dışı → "ÇALIŞMA SAATLERİ DIŞINDA")
3. Müşteri "SIRA AL" butonuna basar (veya öncelikli: yaşlı/engelli/hamile)
4. Backend:
   - `current_queue_number` increment edilir
   - `queue_entries` tablosuna kayıt eklenir (status: waiting)
   - Sistem log'u yazılır
   - **Windows yazıcıya** bilet gönderilir (native-printer ile)
   - **USB termal yazıcıya** bilet gönderilir (ESC/POS)
5. Socket.io ile tüm istemcilere `ticket:created` event'i gönderilir
6. Kiosk ekranında sıra numarası + tahmini bekleme süresi gösterilir

### 6.2 Müşteri Çağırma (Banko Paneli)

1. Banko görevlisi paneli açar, `getMyBank` ile IP bazlı banko ataması yapılır
2. "SIRADAKİNİ ÇAĞIR" butonu → `queue.callNext(bankId)` çağrılır
3. Backend:
   - Bekleyen ilk sıra alınır (öncelikli sıralar önce)
   - `queue_entries.status` → "called"
   - `banks.is_occupied` → true, `current_queue_entry_id` set edilir
4. Socket.io ile `customer:called` event'i tüm ekranlara iletilir
5. Ana monitörde (DisplayScreen) büyük numara + animasyon + ses efekti

### 6.3 İşlem Tamamlama

1. Müşteri bankoya gelir → "İŞLEM TAMAMLA" butonu
2. `queue.completeService(bankId, entryId)` çağrılır
3. Backend:
   - `service_time_ms` hesaplanır (called_at'ten itibaren)
   - `queue_entries.status` → "completed"
   - `banks.total_served` increment, `is_occupied` → false
4. Yeni müşteri çağrılmaya hazır

### 6.4 Öncelikli Sıra Sistemi

- Kiosk'ta yaşlı, engelli, hamile butonları
- `is_priority` flag'i ile işaretlenir
- `callNext` sorgusunda öncelikli sıralar normal sıralardan önce gelir (şu an düz `ORDER BY created_at ASC` - öncelik mantığı henüz sorguya tam entegre edilmemiş, sadece veritabanı flag'i mevcut)

### 6.5 IP Bazlı Banko Yönlendirme

- Admin panelinde her bankoya IP adresi atanabilir
- Banko bilgisayarı paneli açtığında `getMyBank` endpoint'i client IP'sini alır
- Eşleşen banko varsa otomatik seçilir
- Sunucu tarafında **Bank IP restriction middleware**:
  - Banko IP'sinden gelen istekler sadece `/bank`, `/api/`, `/assets/` yollarına erişebilir
  - Diğer tüm sayfalara yönlendirme engellenir (güvenlik)

---

## 7. YÖNETİM ŞEKLİ (Admin Paneli)

### 7.1 Yönetilebilen Özellikler

| Özellik | Açıklama |
|---------|----------|
| **Sistem Başlatma** | Banko sayısı (2-10) belirleme, tabloları oluşturma |
| **Banko Yönetimi** | Banko aç/kapa, operatör ata, IP adresi belirle |
| **Operatör Yönetimi** | Operatör ekle/düzenle/sil, banko-operatör eşleme |
| **Sıra Yönetimi** | Sıfırlama, bekleme kuyruğunu izleme |
| **Çalışma Saatleri** | Açılış/kapanış saati, çalışma günleri |
| **Görsel Tema** | Arkaplan, metin, başlık, alt başlık renkleri, yazı tipi, border rengi |
| **Kiosk Ayarları** | Mesaj, kiosk modu (touch/usb_keypad/single_button), hava durumu şehri |
| **Animasyonlar** | Duyuru metni, kayan yazı hızı/boyutu |
| **Ses Ayarları** | Ses tipi (bell/chime/alarm/beep/siren), ses seviyesi, animasyon tipi/hızı |
| **Yazıcı Ayarları** | USB yazıcı (VendorID/ProductID), Windows yazıcı seçimi, test yazdırma |
| **Bilet Tasarımı** | Firma adı, logo, alt/üst metin, bilet genişliği |
| **Etiket Tasarımı** | Çoklu etiket şablonları, font boyutları, QR/Barkod, renkler, kenarlıklar |
| **Raporlama** | Tarih aralığı filtreleme, grafikler, banka performansı, KPI |
| **Dışa Aktarım** | CSV/PDF olarak istatistik ve log indirme |
| **E-posta** | Raporları e-posta ile gönderme (Nodemailer) |

### 7.2 Yetkilendirme

- Admin paneline erişim için passcode: `1234` (SuperAdmin)
- tRPC middleware katmanı: `publicProcedure`, `protectedProcedure`, `adminProcedure`
- JWT tabanlı session (jose kütüphanesi)
- Banko IP kısıtlaması

---

## 8. YAZICI SİSTEMİ

### 8.1 Üç Farklı Yazıcı Sistemi

| Sistem | Dosya | Özellik |
|--------|-------|---------|
| **USB/ESC/POS** | `printer-usb.ts` | Doğrudan USB termal yazıcıya ESC/POS komutları |
| **Windows Native** | `native-printer.ts` | Windows yazıcı API'si ile RAW yazdırma |
| **Windows Print API** | `windows-print-api.ts` | PowerShell + fs.createWriteStream ile yazdırma |

### 8.2 Yazdırma Akışı

```
Ticket oluşturulunca:
1. Windows yazıcı ayarlanmışsa → printToWindowsPrinter()
2. USB yazıcı tanımlıysa → initializeUSBPrinter() + printUSBTicket()

generateTicketContent() fonksiyonu label_settings parametresini kullanır:
- Queue number (büyük font)
- Bank name
- Tarih/saat
- QR/Barkod (opsiyonel)
- Header/footer metin
- Logo
- Özel mesajlar
```

---

## 9. TEMA VE GÖRSELLEŞTİRME

- Cyberpunk tarzı neon temalı
- Renkler `system_config` tablosunda dinamik
- Her sayfa config'den aldığı temayı CSS değişkenlerine uygular
- DisplayScreen'de büyük dijital saat, hava durumu widget'ı, kayan duyuru metni
- Framer Motion ile animasyonlar (pulse, bounce, shake, glow vb.)

---

## 10. TEST YAPISI

- **Vitest** ile 25+ test
- Test dosyaları: `siramatik.test.ts`, `kiosk.test.ts`, `printer-setup.test.ts`, `printer-admin.test.ts`, `ticket-design.test.ts`, `label-settings.test.ts`, `export.test.ts`, `auth.logout.test.ts`, `label-save-verify.test.ts`, `native-printer.test.ts`

---

## 11. KURULUM VE DAĞITIM

### Geliştirme:
```bash
pnpm install
pnpm dev    → tsx watch ile server + Vite
```

### Üretim:
```bash
pnpm build   → Vite build + esbuild server
pnpm start
```

### Windows Masaüstü:
```bash
pnpm electron:build → Electron + NSIS installer
```

- `setup-windows.ps1` / `setup-windows.bat` ile Windows ortamı hazırlığı
- SQLite veritabanı dosyası: `siramatik.db`
- `baslat.ps1` ile tek tıkla başlatma

---

## 12. GÜVENLİK ÖNLEMLERİ

- Banko IP kısıtlama middleware
- tRPC middleware ile rol bazlı erişim
- JWT cookie authentication
- Session yönetimi
- Çalışma saati/günü kontrolü (mesai dışı sıra alınamaz)
- Kapanış saatinde otomatik sıra temizleme

---

## 13. EKSİK / GELİŞTİRİLEBİLECEK ALANLAR

| Alan | Durum |
|------|-------|
| WhatsApp entegrasyonu | Altyapı hazır (`sendWhatsAppNotification`), UI ve ayarlar eksik |
| Öncelikli sıra sorgulama | Flag mevcut ama `callNext`'te öncelik sıralaması yok |
| Banko otomatik tamamlama | Yeni müşteri çağrılırken eskisi otomatik tamamlansın |
| Responsive raporlama | Raporlama Dashboard'u responsive değil |
| Çoklu dil desteği | Yok, tamamen Türkçe |
| Rate limiting | Yok |
| HTTPS/SSL | Yok |
| Yedekleme | Manuel SQLite dosya kopyalama |

---

## 14. ÖZET

**Sıramatik**, modern web teknolojileriyle (React + tRPC + Socket.io + SQLite) inşa edilmiş, 4 ekranlı (Kiosk → Monitör → Banko → Admin), gerçek zamanlı, özelleştirilebilir bir müşteri sıra yönetim sistemidir. Windows yazıcı desteği, özel bilet/etiket tasarımı, detaylı raporlama, görsel tema yönetimi ve Electron ile masaüstü dağıtımı gibi özellikler sunar. SQLite kullanımı sayesinde harici bir veritabanı sunucusuna ihtiyaç duymadan çalışabilir. Proje büyük ölçüde tamamlanmış olup, WhatsApp entegrasyonu ve bazı iyileştirmeler kalmıştır.
