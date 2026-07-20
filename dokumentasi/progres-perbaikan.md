# Progres Perbaikan UI/UX — KitaBelajar

Dokumen ini melacak perbaikan tampilan & pengalaman pengguna berdasarkan feedback pemilik proyek.
Dikerjakan **dari yang paling mudah dulu**. Setiap item mencatat: **apa yang diperbaiki / ditambahkan / dikurangi**.

> Untuk AI/kolaborator lain: baca dulu skill `.claude/skills/kitabelajar-frontend` (arsitektur & konvensi)
> dan `.claude/skills/kitabelajar-design` (prinsip desain) sebelum menggarap item di bawah.

Legenda status: ✅ Selesai · 🟡 Sebagian · ⬜ Belum

---

## Ringkasan
| # | Item | Tingkat | Status |
|---|------|---------|--------|
| 1 | Toast/alert muncul dari atas | Mudah | ✅ |
| 2 | Logo navbar clickable → beranda | Mudah | ✅ |
| 3 | Konsistensi tinggi navbar antar halaman | Mudah | ✅ |
| 4 | Hapus border-top warna di card landing (AI look) | Mudah | ✅ |
| 5 | Validasi format email (login & register) | Mudah | ✅ |
| 6 | CTA landing ketutup di mobile (below the fold) | Mudah | ✅ |
| 7 | Animasi kaku → easing halus + reduce-motion | Mudah | ✅ |
| 8 | Satu tombol "Masuk" untuk semua peran (SSO-like) | Sedang | ✅ |
| 9 | Kurangi pengulangan branding "KitaBelajar" | Sedang | ✅ |
| 10 | Leaderboard: jangan ulang top-3 di list bawah | Sedang | ✅ |
| 11 | Misi dikategorikan/filter | Sedang | ✅ |
| 12 | Redesign halaman login/register | Sedang | ✅ |
| 13 | Kurangi emoji-as-icon, gradient, & card berlebih | Sulit | 🟡 |
| 14 | Layout landing lebih dinamis | Sulit | ✅ |
| 15 | Skalabilitas field kelas saat registrasi murid | Sulit | ✅ |

---

## SELESAI (batch pertama — perbaikan mudah)

### 1. Toast/alert muncul dari atas ✅
- **File:** `public/css/belajar-seru.css` (`#toast`)
- **Diperbaiki:** posisi toast dipindah dari bawah (`bottom: 28px`) ke atas (`top: 24px`).
  Animasi masuk sekarang meluncur turun dari atas layar.
- **Ditambahkan:** transisi easing halus `cubic-bezier(0.22, 1, 0.36, 1)` + `opacity` supaya fade masuk/keluar,
  dan `box-shadow` lembut agar terbaca di atas konten.
- **Dikurangi:** animasi geser dari bawah yang lama.

### 2. Logo navbar clickable → beranda ✅
- **File:** `public/js/app-core.js`, `public/css/belajar-seru.css`
- **Ditambahkan:** fungsi `goHome()` — klik logo membawa user ke dashboard sesuai perannya
  (guru/murid/orangtua), atau ke landing kalau belum login. Semua `.navbar .logo` didaftarkan
  event `click` + keyboard (`Enter`/`Space`) dan atribut aksesibilitas (`role="button"`, `tabindex`, `title`).
- **CSS:** `.logo { cursor: pointer }` + `:focus-visible` outline untuk aksesibilitas keyboard.

### 3. Konsistensi tinggi navbar ✅
- **File:** `public/css/belajar-seru.css`, `public/belajar-seru.html`
- **Diperbaiki:** navbar diberi `min-height: 76px` agar semua halaman punya tinggi sama.
- **Diperbaiki:** logo di halaman login sebelumnya `<span></span>` kosong (tanpa maskot) sehingga
  navbar-nya lebih pendek — sekarang memakai gambar maskot yang sama seperti halaman lain.

### 4. Hapus border-top warna di card landing (AI look) ✅
- **File:** `public/css/belajar-seru.css` (`.feature-card`)
- **Dikurangi/Dihapus:** `border-top: 5px solid` + 4 aturan `nth-child` warna-warni (pola template khas AI).
- **Ditambahkan:** border tipis netral `1px solid #F0ECE4` + hover lift halus dengan easing lembut,
  supaya card tetap punya batas tapi terasa lebih "dirancang".

### 5. Validasi format email (login & register) ✅
- **File:** `public/js/app-core.js`
- **Ditambahkan:** helper `isValidEmail(email)` (regex). Dipakai di `doLogin()` dan `doRegister()`:
  input seperti `fno@nog` langsung ditolak dengan toast *"Format email tidak valid. Contoh: nama@email.com"*.
- **Ditambahkan:** di `doRegister()`, cek panjang password minimal 8 karakter sebelum kirim OTP.

### 6. CTA landing tidak lagi ketutup di mobile ✅
- **File:** `public/css/belajar-seru.css` (media query `max-width: 640px`)
- **Masalah:** urutan DOM landing = badge → judul → paragraf → **maskot 200px** → tombol CTA.
  Maskot besar mendorong tombol "Ayo Belajar" & "Portal Guru" ke bawah fold (mis. di iPhone 12 Pro).
- **Diperbaiki:** di mobile, `.hero-text` dijadikan flex-column dan tombol diberi `order` lebih kecil
  dari maskot → CTA kini tampil tepat di bawah teks, di atas maskot.
- **Dikurangi:** ukuran maskot mobile 200px → 180px agar hero lebih ringkas.

### 7. Animasi kaku → easing halus + reduce-motion ✅
- **File:** `public/css/belajar-seru.css`
- **Diperbaiki:** transisi toast, feature-card, & `.btn-login` kini pakai `cubic-bezier(0.22, 1, 0.36, 1)`
  (bukan `ease`/`linear` default yang terasa kaku).
- **Ditambahkan:** blok `@media (prefers-reduced-motion: reduce)` yang menonaktifkan animasi loop/parallax
  untuk user yang mengaktifkan "kurangi gerak" di OS (aksesibilitas & anti motion-sickness).

### 8. Satu tombol "Masuk" untuk semua peran (SSO-like) ✅
- **File:** `public/belajar-seru.html`, `public/js/app-core.js`
- **Dikurangi/Dihapus:** tombol terpisah "Masuk sebagai Guru"/"Masuk sebagai Murid" di navbar landing,
  tombol "Portal Guru" di hero, dan **role-tabs** (Guru/Murid) di halaman login.
- **Diperbaiki:** navbar landing kini satu tombol **"Masuk"**; hero jadi "Ayo Mulai Belajar" (→ login) +
  "Daftar Gratis" (→ register). Judul login jadi generik *"Masuk ke Akunmu"* dengan sub-teks yang menjelaskan
  routing otomatis.
- **Diperbaiki:** `showLogin()` tak lagi butuh argumen role; `doLogin()` **menghapus** validasi "role tidak
  cocok dengan tab" dan langsung mengarahkan ke dashboard sesuai `data.user.role` dari backend (pola SSO).
  `switchRole()` disederhanakan jadi no-op aman (kompatibilitas).
- **Catatan:** halaman **register** tetap punya tab Guru/Murid — karena data yang dikumpulkan berbeda,
  bukan bagian dari alur login.

### 9. Kurangi pengulangan branding "KitaBelajar" ✅
- **File:** `public/belajar-seru.html`
- **Dihapus:** dua `<span class="kb-latihan-brand">KitaBelajar</span>` yang menempel di atas CTA
  "Kita Latihan!" & "AyoBelajar!" di dashboard murid.
- **Diperbaiki:** section-title "📚 KitaBelajar" → "📚 Belajar & Latihan"; teks CTA "AyoBelajar!" → "Ayo Belajar!".
  Brand kini hanya di logo navbar.

### 10. Leaderboard: tidak lagi mengulang top-3 di list bawah ✅
- **File:** `public/js/app-core.js` (`loadLeaderboard`, `renderListLb`)
- **Diperbaiki:** list peringkat sekarang memakai `json.data.slice(3)` → mulai dari #4, karena #1–3 sudah
  tampil jelas di podium.
- **Diperbaiki:** saat peserta ≤ 3 (list kosong), list dikosongkan rapi (tidak menampilkan "Belum ada peserta"
  yang menyesatkan).

### 11. Misi dikategorikan/filter ✅
- **File:** `public/belajar-seru.html`, `public/js/app-core.js`, `public/css/belajar-seru.css`
- **Ditambahkan:** bar filter di panel Misi — **Semua · ⚡ Harian · 🗓️ Mingguan · 🏆 Achievement** — plus
  fungsi `setMisiFilter(cat)` yang menampilkan hanya kategori terpilih (default "Semua"). Styling pil
  `.misi-filter` mengikuti gaya filter yang sudah ada.
- **Efek:** user tidak lagi dipaksa menggulir semua kategori sekaligus; bisa fokus ke satu jenis misi.

---

## BELUM DIKERJAKAN (backlog, urut dari lebih ringan)

## SELESAI (batch ketiga — item berat)

### 12. Redesign halaman login/register ✅
- **File:** `public/css/belajar-seru.css` (`.login-wrap`, `.login-card`)
- **Diperbaiki:** kartu auth kini **terpusat vertikal** (`min-height: calc(100vh - 76px)` + flex center),
  bukan menempel di atas. Bayangan & border kartu dihaluskan.
- **Ditambahkan:** latar lembut dua radial-gradient (kuning + biru) di `.login-wrap::before` supaya
  halaman tidak terasa kosong/datar; **header maskot** otomatis di atas SEMUA kartu auth
  (login/daftar/lupa sandi/reset) via `.login-card::before` — tanpa perlu edit tiap kartu.
- **Diperbaiki:** judul & sub-teks kartu auth dibuat rata tengah agar lebih rapi.
- Berlaku konsisten untuk keempat halaman auth karena semuanya memakai `.login-card`.

### 13. Kurangi emoji-as-icon, gradient, & card berlebih 🟡 (landing selesai)
- **File:** `public/belajar-seru.html`, `public/css/belajar-seru.css`
- **Dihapus/diubah:** 4 ikon emoji di feature-card landing (📚✏️🎮🏆) → **SVG line-icon** (buku, pensil,
  gamepad, medali) di dalam kotak bulat bertint warna berbeda per kartu. Ini jawaban langsung untuk
  keluhan "emoji untuk icons".
- **Sudah sejalan (dari batch sebelumnya):** CTA landing kini flat (tanpa gradient di setiap tombol),
  border-top warna di card sudah dihapus.
- **Sengaja dipertahankan:** emoji sebagai **aksen playful** (badge hero, speech bubble, judul section)
  dan gradient pada elemen brand di dashboard (welcome-banner, game card) — sesuai skill
  `kitabelajar-design` (emoji boleh sebagai aksen; gradient dibatasi, bukan dihabisi) mengingat
  audiens anak-anak.
- **Sisa opsional (🟡):** audit gradient/emoji tingkat dashboard (game card, banner) bila ingin nuansa
  lebih "dewasa/minimal". Belum dikerjakan agar tidak mengubah identitas visual utama tanpa arahan.

### 14. Layout landing lebih dinamis ✅
- **File:** `public/css/belajar-seru.css` (media query `min-width: 900px`)
- **Ditambahkan:** di desktop, `.hero-text` jadi **grid 2 kolom asimetris** (teks kiri rata-kiri,
  maskot kanan) memakai `grid-template-areas` — jauh lebih hidup daripada satu kolom tengah.
  Features sedikit "naik" (`margin-top: -10px`) untuk ritme visual.
- **Dipertahankan:** di mobile tetap satu kolom dengan urutan CTA-di-atas-maskot (item #6).

### 15. Skalabilitas field kelas saat registrasi murid ✅
- **File:** `public/belajar-seru.html` (`#reg-kelas`)
- **Diubah:** input **teks bebas** (`contoh: 4A`) → **`<select>` terstruktur** dengan optgroup
  SD/SMP/SMA (Kelas 1–12). Nilai jadi ternormalisasi konsisten (mis. `"Kelas 4 SD"`), sehingga pada
  skala ribuan murid tidak berantakan karena variasi ketikan.
- **Ditambahkan:** keterangan bahwa **rombel spesifik** (mis. 12-A) didapat otomatis saat murid
  **gabung kelas guru pakai kode** — memisahkan "tingkat" (registrasi) dari "rombel" (join kelas).
- **Tanpa perubahan backend/skema:** `src/routes/auth.js` tetap menerima `kelas` sebagai string; hanya
  sumber nilainya yang kini terkontrol. `doRegister()` sudah membaca `.value` (kompatibel dengan select).

---

## Google Auth di domain produksi baru (Railway) — `Error 400: origin_mismatch`
**Gejala:** setelah pindah ke `https://kitabelajar-production-26d9.up.railway.app`, login Google gagal
dengan halaman Google "Access blocked: Authorization Error — Error 400: origin_mismatch".

**Akar masalah (BUKAN bug kode):** origin domain baru belum terdaftar di **Authorized JavaScript origins**
pada OAuth 2.0 Client ID di Google Cloud Console. Kode frontend/backend, CSP, dan CORS sudah benar
(sudah diverifikasi). `origin_mismatch` hanya bisa diperbaiki di Console.

**Cara perbaiki (dilakukan pemilik akun Google):**
1. Google Cloud Console → **APIs & Services → Credentials**.
2. Buka OAuth 2.0 Client ID `1090565500817-…apps.googleusercontent.com`.
3. **Authorized JavaScript origins → + Add URI** → `https://kitabelajar-production-26d9.up.railway.app`.
4. **Save**, tunggu ±5 menit propagasi. (Redirect URI tidak perlu untuk GIS mode popup.)
5. Tiap ganti domain produksi, ulangi langkah ini untuk origin baru.

**Env Railway yang disarankan:** `GOOGLE_CLIENT_ID` = client ID yang sama dgn frontend (agar cek `aud`
di backend konsisten), dan `CORS_ORIGIN` = domain produksi bila ada request lintas-origin.

**Hardening kode (butuh redeploy):** `_initGoogle()` kini `try/catch` + mendeteksi bila tombol Google
gagal render lalu menampilkan pesan ramah ("Login Google belum aktif untuk alamat situs ini") dan
mencetak origin yang bermasalah ke console — supaya kegagalan tidak lagi senyap. (app-core.js `v=4`)

## Ekstra de-AI: ikon game card dashboard murid ✅
- **File:** `public/belajar-seru.html`, `public/css/belajar-seru.css`
- **Diubah:** 4 ikon emoji game card (⚡🎯🎮🏆) → **SVG line-icon** (zap, target, gamepad, medali) stroke putih,
  konsisten dengan feature card landing. Warna gradient kartu tetap (identitas playful).

## Skill yang dibuat untuk mendukung pekerjaan ini
- `.claude/skills/kitabelajar-frontend/SKILL.md` — arsitektur & konvensi frontend (page system, helper,
  cache-busting, lokasi file).
- `.claude/skills/kitabelajar-design/SKILL.md` — prinsip desain anti-AI-look, konsistensi, animasi,
  validasi form, aturan branding.

## Catatan teknis
- Setiap perubahan `css`/`js` **wajib menaikkan `?v=N`** di `belajar-seru.html` (sudah: css `v=22`, app-core `v=3`).
- Status: 14 dari 15 item **selesai**; sisa #13 sebagian (audit gradient/emoji tingkat dashboard, opsional).
- Cek cepat sintaks: `node --check public/js/app-core.js`.

---

## SESI KEAMANAN & INFRASTRUKTUR (Juli 2026)

> Dikerjakan oleh AI session terpisah. Semua perubahan sudah di-push ke `main` (commit `785e573`).

### Ringkasan Sesi

| # | Item | Status |
|---|------|--------|
| S1 | Prototype sistem kode undangan guru (lokal, tidak di-push) | ✅ |
| S2 | 7 security fixes pada prototype | ✅ |
| S3 | Integrasi Supabase pada prototype | ✅ |
| S4 | Migration schema `kode_guru` v2 (permanen, login log, RPC) | ✅ |
| S5 | RLS (Row Level Security) semua 24 tabel Supabase | ✅ |
| S6 | Smoke test 18 endpoint — 18/18 PASS | ✅ |
| S7 | Integrasi `kode-guru` ke `src/routes/kode-guru.js` (main app) | ✅ |
| S8 | Audit gradient/emoji dashboard (item #13 sisa) | ⬜ |
| S9 | Integrasi fitur kode guru ke UI frontend (`belajar-seru.html`) | ⬜ |
| S10 | Halaman manajemen guru untuk kepala sekolah di frontend | ⬜ |

---

### S1–S3: Prototype Sistem Kode Undangan Guru ✅

**Lokasi:** `prototype/kode-guru/` (di `.gitignore`, tidak di-push — hanya lokal)

**Konsep:**
- Kepala sekolah generate **kode permanen 8 karakter** per guru (3-char SHA-256 hash `nama|email` + 5-char CSPRNG)
- Satu email guru = satu kode permanen (tidak berubah, bisa dipakai berulang)
- Guru login dengan Google → sistem cek whitelist email → beri akses

**File prototype (lokal saja):**
- `prototype/kode-guru/server.js` — Express server port `PROTO_PORT=4100`
- `prototype/kode-guru/app.js` — semua route API
- `prototype/kode-guru/store.js` — dual-mode: Supabase (produksi) / in-memory (fallback)
- `prototype/kode-guru/index.html` — UI admin panel + guru registration
- `prototype/kode-guru/public/app.js` — frontend JS (CSP-compliant, tanpa inline)
- `prototype/kode-guru/seed-kepala.js` — seed akun kepala ke Supabase

**7 Security Fixes yang diimplementasikan:**
1. JWT secret wajib dari env (tidak ada fallback lemah) — `server.js`
2. Google OAuth2 nyata via `google-auth-library` (verifikasi `id_token`) — `app.js`
3. Validasi format email & telepon via `validator.js` — `store.js`
4. Rate limiter login diperketat (5 req/15 menit) — `app.js`
5. Data persistent via Supabase (`SUPABASE_SERVICE_KEY`) — `store.js`
6. CORS whitelist origin — `app.js`
7. Hapus `unsafe-inline` dari CSP, JS dipisah ke file eksternal — `index.html` + `public/app.js`

**Bug fixes selama integrasi:**
- `EADDRINUSE :::3000` → pakai `PROTO_PORT=4100` bukan `PORT`
- Kolom `password_hash` tidak ada → pakai `password` (sesuai schema Supabase aktual)
- Kolom `no_telepon`/`alamat` tidak ada di tabel `users` → dihapus dari insert, dikembalikan dari parameter

---

### S4: Migration Schema `kode_guru` v2 ✅

**File:** [`migration_kode_guru_v2.sql`](../migration_kode_guru_v2.sql)

**Yang dibuat:**
```sql
-- Tabel kode_guru (kode permanen per guru)
CREATE TABLE kode_guru (
  id          UUID PRIMARY KEY,
  kode        TEXT UNIQUE NOT NULL,        -- 8-char permanent code
  email_guru  TEXT NOT NULL,
  nama_guru   TEXT NOT NULL,
  dibuat_oleh UUID REFERENCES users(id),
  status      TEXT DEFAULT 'active',       -- active | revoked
  login_count INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Tabel kode_guru_login_log (audit trail)
CREATE TABLE kode_guru_login_log (
  id         UUID PRIMARY KEY,
  kode_id    UUID REFERENCES kode_guru(id),
  guru_id    UUID REFERENCES users(id),
  login_at   TIMESTAMPTZ DEFAULT now()
);

-- RPC increment_kode_guru_login (atomic counter)
CREATE FUNCTION increment_kode_guru_login(kode_id UUID) ...
```

**Sudah dijalankan di Supabase SQL Editor** ✅

---

### S5: RLS (Row Level Security) Semua 24 Tabel ✅

**File:** [`migration_rls_semua_tabel.sql`](../migration_rls_semua_tabel.sql)

**Strategi:** "Backend-only pattern"
- `ALTER TABLE x ENABLE ROW LEVEL SECURITY` — tanpa policy = deny all untuk anon/authenticated
- Backend Node.js pakai `SUPABASE_SERVICE_KEY` → bypass RLS otomatis (Supabase default)
- Browser tidak bisa akses Supabase langsung dengan anon key

**24 tabel yang dilindungi:**
`users`, `kelas`, `kelas_murid`, `materi`, `soal`, `quiz`, `quiz_soal`, `hasil_quiz`,
`detail_jawaban`, `progres_materi`, `notifikasi`, `pesan_kelas`, `pesan_private`,
`tugas_submission`, `parent_student`, `push_subscriptions`, `badges`, `murid_badges`,
`misi_template`, `misi_murid`, `daily_reward_klaim`, `kode_guru`, `kode_guru_login_log`, `error_logs`

**Sudah dijalankan di Supabase SQL Editor** ✅ — semua 24 tabel `rowsecurity = true`

**File diagnostik:** [`cek_rls_status.sql`](../cek_rls_status.sql) — query untuk cek status RLS kapanpun

---

### S6: Smoke Test 18 Endpoint ✅

**File:** [`smoke_test.js`](../smoke_test.js)

**Hasil:** 18/18 PASS

```
✅ GET /              → 200 (halaman utama HTML)
✅ POST /api/auth/login       → 200 (kepala, dapat token)
✅ GET /api/auth/profile      → 200 (data user)
✅ GET /api/dashboard         → 200
✅ GET /api/kelas             → 200
✅ GET /api/materi            → 200
✅ GET /api/soal/latihan      → 200
✅ GET /api/quiz              → 200
✅ GET /api/kode-guru         → 200
✅ GET /api/notifikasi        → 200
✅ GET /api/misi              → 200
✅ GET /api/misi/badges       → 200
✅ GET /api/soal/latihan/mapel → 200
✅ GET /api/chat/inbox        → 200
✅ GET /api/orangtua/anak     → 403 (kepala bukan orangtua — benar)
✅ GET /api/dashboard (no token) → 401
✅ POST /api/auth/login (salah) → 401
✅ GET /api/tidak-ada         → 404
```

**Cara jalankan:** `node smoke_test.js` (server harus jalan dulu: `node src/server.js`)

---

### S7: Route `kode-guru` di Main App ✅

**File:** [`src/routes/kode-guru.js`](../src/routes/kode-guru.js)

Route yang tersedia (semua `kepalaOnly`):
- `POST /api/kode-guru` — generate kode baru untuk guru
- `GET /api/kode-guru` — list semua kode
- `GET /api/kode-guru/guru` — list guru yang sudah punya akun
- `PATCH /api/kode-guru/:id/revoke` — cabut kode

**Sudah terdaftar di** [`src/server.js`](../src/server.js:121):
```js
app.use('/api/kode-guru', require('./routes/kode-guru'));
```

---

## YANG BELUM DIKERJAKAN (Backlog untuk AI Berikutnya)

### ⬜ B1: Integrasi UI Kode Guru ke Frontend (`belajar-seru.html`)

**Prioritas: TINGGI**

Backend sudah siap (`/api/kode-guru`), tapi belum ada UI di frontend untuk:
- Kepala sekolah: panel generate kode, lihat daftar kode, revoke kode
- Kepala sekolah: lihat daftar guru yang sudah terdaftar (`GET /api/kode-guru/guru`)
- Guru: tampilkan kode mereka di profil/dashboard

**File yang perlu diubah:**
- `public/belajar-seru.html` — tambah section panel kepala sekolah
- `public/js/app-core.js` — tambah fungsi load/generate/revoke kode
- `public/css/belajar-seru.css` — styling panel kepala (jika perlu)

**Catatan:** role `kepala_sekolah` sudah ada di backend, tapi dashboard-nya (`dashboardGuru` di `src/routes/dashboard.js`) belum dibedakan dari guru biasa.

---

### ⬜ B2: Dashboard Kepala Sekolah Terpisah

**Prioritas: TINGGI**

Saat ini kepala sekolah masuk ke dashboard guru (`dashboardGuru`). Perlu dashboard khusus yang menampilkan:
- Statistik sekolah (total guru, murid, kelas)
- Daftar kode guru (aktif/revoked)
- Daftar guru terdaftar
- Manajemen kode (generate, revoke)

**File yang perlu diubah:**
- `src/routes/dashboard.js` — tambah `dashboardKepala()` function, routing berdasarkan role
- `public/belajar-seru.html` — tambah section dashboard kepala
- `public/js/app-core.js` — tambah `loadDashboardKepala()`

---

### ⬜ B3: Validasi Kode Guru saat Register Guru

**Prioritas: TINGGI**

Saat ini guru bisa register tanpa kode. Perlu:
- Tambah field `kode_guru` di form register guru
- Backend `POST /api/auth/register` validasi kode sebelum buat akun
- Kode harus `active` dan email harus cocok dengan `email_guru` di tabel `kode_guru`
- Setelah register sukses, update `login_count` dan `last_used_at`

**File yang perlu diubah:**
- `src/routes/auth.js` — tambah validasi kode di endpoint register
- `public/belajar-seru.html` — tambah field kode di form register guru
- `public/js/app-core.js` — kirim kode saat register

---

### ⬜ B4: Endpoint Validasi Kode (untuk Frontend)

**Prioritas: SEDANG**

Tambah endpoint `POST /api/kode-guru/validate` yang bisa dicek frontend sebelum submit form register:
```json
{ "kode": "WJDHZLS2", "email": "guru@sekolah.id" }
→ { "valid": true, "nama_guru": "Budi Santoso" }
```

**File yang perlu diubah:**
- `src/routes/kode-guru.js` — tambah route `POST /validate`

---

### ⬜ B5: Audit Gradient/Emoji Dashboard (Item #13 Sisa)

**Prioritas: RENDAH (opsional)**

Dari backlog UI/UX lama — audit emoji dan gradient di:
- Game card dashboard murid (welcome-banner, card AyoBelajar/KitaLatihan)
- Pertimbangkan apakah perlu diubah mengingat audiens anak-anak

**File:** `public/belajar-seru.html`, `public/css/belajar-seru.css`

---

### ⬜ B6: Push Notification (Service Worker)

**Prioritas: SEDANG**

`public/sw.js` sudah ada tapi belum terintegrasi penuh. Tabel `push_subscriptions` sudah ada di DB (dan sudah RLS). Perlu:
- Endpoint `POST /api/notifikasi/subscribe` untuk simpan subscription
- Endpoint `POST /api/notifikasi/push` untuk kirim push notif
- Frontend: minta permission + register service worker

---

### ⬜ B7: Error Logging ke Tabel `error_logs`

**Prioritas: RENDAH**

Tabel `error_logs` sudah ada di DB (dan sudah RLS). Perlu:
- Middleware global error handler yang log ke `error_logs`
- Atau endpoint `POST /api/error-log` untuk frontend report error

---

## Env Variables yang Diperlukan

Lihat [`.env.example`](../.env.example) untuk daftar lengkap. Yang baru ditambahkan:

```env
# Prototype kode guru (lokal saja)
PROTO_PORT=4100
KEPALA_EMAIL=kepala@sekolah.id
KEPALA_PASS=KepalaProto2024!
KEPALA_NAMA=Kepala Sekolah

# Google OAuth (wajib untuk login Google)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## Arsitektur Keamanan Saat Ini

```
Browser
  │
  │  fetch('/api/...') — hanya tahu URL Node.js
  ▼
Node.js (src/server.js) — PORT=3000
  │  pakai SUPABASE_SERVICE_KEY (bypass RLS)
  ▼
Supabase Database
  │  RLS ON: 24 tabel
  │  anon key dari browser → DITOLAK
  │  service_role key → bypass otomatis
  ▼
  data
```

**Tidak ada akses langsung browser → Supabase.** Semua lewat Node.js.
