# DersPlan - Haftalık Ders Dağıtım Sistemi

## Teknik Tasarım Dokümanı

---

## 1. Proje Özeti

BİLSA Haftalık Ders Dağıtım programına benzer, tüm kademeleri (ilkokul/ortaokul/lise) destekleyen, masaüstü (Tauri) ders dağıtım sistemi.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Amaç |
|--------|-----------|------|
| **Desktop Shell** | Tauri v2 | Native pencere, tray icon, auto-update |
| **Frontend** | Vite + React 19 + TypeScript | Kullanıcı arayüzü |
| **Styling** | Tailwind CSS v4 + shadcn/ui | UI bileşenleri |
| **Backend** | Rust (Tauri commands) | İş mantığı, veritabanı, algoritma |
| **Database** | SQLite (rusqlite + refinery) | Yerel veritabanı |
| **State** | Zustand + TanStack React Query | Frontend state yönetimi |
| **Takvim** | FullCalendar | Sürükle-bırak program düzenleme |
| **Charts** | Recharts | Dashboard grafikleri |
| **Form** | React Hook Form + Zod | Form yönetimi |

---

## 3. Proje Dizin Yapısı

```
dersplan/
│
├── src/                            # React Frontend (Vite)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui bileşenleri
│   │   └── timetable/              # FullCalendar, drag-drop
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Teachers.tsx
│   │   ├── Courses.tsx
│   │   ├── Classrooms.tsx
│   │   ├── Rooms.tsx
│   │   ├── Students.tsx
│   │   ├── Schedule.tsx            # Ana program sayfası
│   │   ├── Electives.tsx
│   │   ├── Duty.tsx
│   │   ├── Reports.tsx
│   │   ├── Import.tsx
│   │   ├── Settings.tsx
│   │   └── License.tsx
│   ├── lib/
│   │   └── commands.ts             # Tauri invoke() wrapper (tip güvenli)
│   ├── stores/
│   │   └── app.ts                  # Zustand store
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/                      # Rust Backend
│   ├── src/
│   │   ├── main.rs                 # Tauri entry point
│   │   ├── lib.rs                  # Module declarations
│   │   │
│   │   ├── db/
│   │   │   ├── mod.rs              # Connection + migration runner
│   │   │   ├── models.rs           # All serde models
│   │   │   └── migrations/         # SQL migration files
│   │   │
│   │   ├── commands/               # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── teachers.rs
│   │   │   ├── courses.rs
│   │   │   ├── classrooms.rs
│   │   │   ├── rooms.rs
│   │   │   ├── students.rs
│   │   │   ├── constraints.rs
│   │   │   ├── schedule.rs
│   │   │   ├── electives.rs
│   │   │   ├── duty.rs
│   │   │   ├── reports.rs
│   │   │   ├── import.rs
│   │   │   ├── config.rs
│   │   │   └── license.rs
│   │   │
│   │   ├── scheduler/              # Program algoritması
│   │   │   ├── mod.rs
│   │   │   ├── types.rs
│   │   │   ├── constraints.rs
│   │   │   ├── solver.rs
│   │   │   └── optimizer.rs
│   │   │
│   │   ├── license/
│   │   │   ├── mod.rs
│   │   │   └── crypto.rs
│   │   │
│   │   ├── export/
│   │   │   ├── mod.rs
│   │   │   ├── pdf.rs
│   │   │   └── excel.rs
│   │   │
│   │   └── encryption/
│   │       └── mod.rs
│   │
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── components.json                 # shadcn/ui config
```

---

## 4. Veritabanı Şeması (13 Tablo)

### school_config
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| name | TEXT | Okul adı |
| education_type | TEXT | TEKLI / IKILI |
| academic_year | TEXT | 2025-2026 |
| semester | TEXT | GÜZ / BAHAR |
| lesson_duration | INTEGER | Ders süresi (dk) |
| break_duration | INTEGER | Teneffüs süresi (dk) |
| lesson_days | TEXT | Çalışma günleri (1,2,3,4,5) |
| max_daily_lessons | INTEGER | Günlük maksimum ders |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### teachers
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| first_name | TEXT | ŞİFRELİ |
| last_name | TEXT | ŞİFRELİ |
| branch | TEXT | Branş kodu |
| sicil_no | TEXT | Sicil numarası |
| phone | TEXT | ŞİFRELİ (opsiyonel) |
| email | TEXT | ŞİFRELİ (opsiyonel) |
| is_active | INTEGER | 0/1 |
| created_at | TEXT | |
| updated_at | TEXT | |

### courses
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| name | TEXT | Ders adı |
| code | TEXT | e-Okul kodu |
| weekly_hours | INTEGER | Haftalık saat |
| is_elective | INTEGER | 0=zorunlu, 1=seçmeli |
| branch | TEXT | Bağlı branş |
| grade_levels | TEXT | Uygulandığı seviyeler (5,6,7,8) |
| is_split_enabled | INTEGER | Bölünebilir ders (0/1) |
| split_group_count | INTEGER | Kaç grup (opsiyonel) |

### grade_levels
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| level | INTEGER | 1-12 |
| label | TEXT | 1. Sınıf, ... |

### classrooms
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| name | TEXT | 5-A, 9/B |
| grade_level_id | INTEGER FK | |
| capacity | INTEGER | |
| is_active | INTEGER | 0/1 |

### rooms
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| name | TEXT | Fen Lab., Spor Salonu |
| room_type | TEXT | SINIF, LAB, ATOLYE |
| capacity | INTEGER | |
| is_active | INTEGER | 0/1 |

### students
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| student_no | TEXT | Öğrenci no |
| first_name | TEXT | ŞİFRELİ |
| last_name | TEXT | ŞİFRELİ |
| tckn | TEXT | ŞİFRELİ (opsiyonel) |
| classroom_id | INTEGER FK | |

### teacher_constraints
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| teacher_id | INTEGER FK | |
| day_of_week | INTEGER | 1-7 (Pzt-Paz) |
| lesson_hour | INTEGER | Saat (null=tüm gün) |
| constraint_type | TEXT | MUSBEIT_DEGIL / NOBET / TOPLANTI / IZIN |
| reason | TEXT | Açıklama |
| start_date | TEXT | Başlangıç (opsiyonel) |
| end_date | TEXT | Bitiş (opsiyonel) |

### classroom_constraints
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| classroom_id | INTEGER FK | |
| day_of_week | INTEGER | |
| lesson_hour | INTEGER | |
| is_blocked | INTEGER | 0=ders var, 1=ders yok |

### elective_groups
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| name | TEXT | Görsel Sanatlar Grubu |
| course_id | INTEGER FK | |
| classroom_id | INTEGER FK | |
| capacity | INTEGER | Kontenjan |
| year | INTEGER | |

### elective_selections
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| student_id | INTEGER FK | |
| elective_group_id | INTEGER FK | |
| priority | INTEGER | 1, 2, 3 (tercih sırası) |

### schedule_entries
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| classroom_id | INTEGER FK | |
| course_id | INTEGER FK | |
| teacher_id | INTEGER FK | |
| room_id | INTEGER FK | (opsiyonel) |
| day_of_week | INTEGER | 1-7 |
| lesson_hour | INTEGER | 1..N |
| week_type | TEXT | TEK / CIFT / HER (opsiyonel) |

### duty_rosters
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | |
| teacher_id | INTEGER FK | |
| day_of_week | INTEGER | |
| week_of_year | INTEGER | |
| year | INTEGER | |
| location | TEXT | Nöbet yeri (opsiyonel) |

---

## 5. Rust Bağımlılıkları (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
refinery = { version = "0.8", features = ["rusqlite"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
aes-gcm = "0.10"
ed25519-dalek = "2"
rand = "0.8"
printpdf = "0.7"
rust_xlsxwriter = "0.64"
calamine = "0.24"
machine-uid = "0.4"
base64 = "0.22"
```

---

## 6. Program Algoritması

### Hard Constraints (Kesin)
1. Aynı öğretmen aynı anda iki sınıfta olamaz
2. Aynı sınıf aynı anda iki ders alamaz
3. Aynı derslik aynı anda iki derse atanamaz
4. Öğretmenin müsait olmadığı saatlere ders konulamaz
5. Sınıfın kapalı saatlerine ders konulamaz
6. Dersin haftalık saati aşılamaz

### Soft Constraints (Optimizasyon)
1. Dersler haftanın günlerine dengeli dağıtılsın
2. Aynı ders aynı günde birden fazla olmasın (tercihen)
3. Öğretmenin boş günleri olsun (kesintisiz program)
4. Zor dersler (matematik, fen) sabah saatlerine
5. Beden eğitimi, müzik gibi dersler öğleden sonraya

### Çözüm Stratejisi
- **Greedy initialization**: En çok kısıtlamalı derslerden başla, en uygun boş saati bul
- **Backtracking**: Çakışma durumunda geri al, alternatif dene (max N deneme)
- **Local search**: Simulated annealing ile soft constraint skorunu iyileştir

---

## 7. Lisans Sistemi

### Aktivasyon Akışı
```
1. Kullanıcı 16 haneli aktivasyon kodunu girer
2. Backend kodu + machine ID ile imza doğrular
   (Ed25519 - sunucuda özel anahtar, uygulamada genel anahtar)
3. Başarılı → license.lic dosyası oluştur (şifrelenmiş JSON)
4. Başarısız → hata mesajı
```

### Lisans Dosyası Yapısı
```json
{
  "okul_adi": "aes-gcm-encrypted-base64",
  "barkod": "DD-2026-XXXXX",
  "baslangic": "2026-01-01",
  "bitis": "2026-12-31",
  "ozellikler": ["full"],
  "imza": "ed25519-base64-signature"
}
```

### Deneme Sürümü Kısıtlamaları
```
if teacher_count > 10 || classroom_count > 10:
    show_license_warning()
    disable_create_new_teacher_or_classroom()
```

---

## 8. Faz Planı (17 Gün)

| Faz | İçerik | Süre |
|-----|--------|------|
| **1** | Tauri + Vite + Rust kurulum, rusqlite + refinery migration, school_config CRUD | 1 gün |
| **2** | Teacher, Course, Classroom, Room, GradeLevel modelleri + CRUD + React sayfaları | 2 gün |
| **3** | Student modeli + CRUD + AES-GCM şifreleme + UI | 1 gün |
| **4** | Kısıtlama yönetimi (teacher + classroom) + UI | 1 gün |
| **5** | Program algoritması (greedy + backtracking + optimizer) | 3 gün |
| **6** | Sürükle-bırak takvim (FullCalendar + schedule CRUD) | 2 gün |
| **7** | Seçmeli ders dağıtımı (grup, tercih, otomatik atama) | 1.5 gün |
| **8** | Nöbet modülü | 1 gün |
| **9** | PDF + Excel rapor/çıktı | 1.5 gün |
| **10** | Lisans sistemi (aktivasyon + kısıtlama) | 1 gün |
| **11** | e-Okul XLS import | 1 gün |
| **12** | Auth (roller), build, paketleme | 1 gün |

---

## 9. Veri Şifreleme (AES-256-GCM)

### Şifrelenecek Alanlar
- `teachers.first_name`, `teachers.last_name`
- `teachers.phone`, `teachers.email`
- `students.first_name`, `students.last_name`
- `students.tckn`

### Encrypt/Decrypt Mekanizması
```rust
// Encrypt: plaintext → AES-256-GCM → base64
// Decrypt: base64 → AES-256-GCM → plaintext
// Key: SHA-256(machine_id + app_secret)
```
