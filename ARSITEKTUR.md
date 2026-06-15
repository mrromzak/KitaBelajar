# 📚 KitaBelajar — Dokumentasi Arsitektur & Kode

Dokumen ini menjelaskan **teknologi, struktur kode, fungsi tiap file, dan alur kerja** platform KitaBelajar — Learning Management System (LMS) untuk murid, guru, dan orangtua di Indonesia.

---

## 1. Ringkasan Singkat

KitaBelajar adalah aplikasi web **full-stack** berisi:
- **Kelas online** (guru buat kelas, murid gabung pakai kode)
- **Materi belajar** (teks, PDF, video, gambar)
- **Quiz & latihan soal** (quiz kilat, quiz live multiplayer, bank soal, PR/tugas)
- **Video call kelas** (tatap muka online)
- **Chat** (chat kelas & chat privat terenkripsi)
- **Gamifikasi** (XP, level, streak, badge, misi, hadiah harian, leaderboard)
- **Asisten AI** (untuk murid & guru, dengan web search realtime)
- **Akun orangtua** (memantau aktivitas belajar anak)
- **Notifikasi** (in-app + push notification)

---

## 2. Teknologi yang Digunakan

### Backend
| Teknologi | Fungsi |
|-----------|--------|
| **Node.js + Express.js** | Server HTTP & REST API |
| **Supabase (PostgreSQL)** | Database utama (via `@supabase/supabase-js`, pakai *service role key*) |
| **Socket.io** | Komunikasi realtime (chat, quiz live, video call signaling, world game) |
| **JWT (jsonwebtoken)** | Autentikasi token (login berlaku 30 hari) |
| **bcryptjs** | Hashing password |
| **Helmet** | Security headers + Content Security Policy (CSP) |
| **express-rate-limit** | Membatasi jumlah request (anti brute-force) |
| **Multer** | Upload file materi |
| **validator + xss** | Validasi & sanitasi input |
| **compression** | Gzip response |
| **AES-256-GCM (crypto bawaan Node)** | Enkripsi isi pesan di database |

### Layanan Eksternal (API pihak ketiga)
| Layanan | Fungsi |
|---------|--------|
| **Groq AI (LLaMA/Qwen)** | Otak chatbot AI (chat, generate soal, ringkasan, vision) |
| **Brevo (Sendinblue)** | Kirim email (OTP, reset password, kredensial orangtua) |
| **Daily.co** | Video call (WebRTC) |
| **HuggingFace** | Text-to-Speech (suara AI) — MMS-TTS |
| **Google OAuth** | Login dengan akun Google |
| **SearXNG** (`mikosearch.up.railway.app`) | Web search realtime untuk Asisten Guru (fallback: DuckDuckGo) |
| **YouTube** | Embed video & ambil transkrip |

### Frontend
| Teknologi | Fungsi |
|-----------|--------|
| **HTML + CSS + JavaScript murni (vanilla)** | Tidak pakai framework. SPA (Single Page Application) buatan sendiri dengan sistem `showPage()` |
| **Service Worker (sw.js)** | Push notification offline |
| **KaTeX** | Render rumus matematika di chat AI |

### Deployment
- **Railway** (hosting backend + frontend)
- **Git/GitHub** (`github.com/mrromzak/KitaBelajar`)

---

## 3. Struktur Folder & File

```
project KitaBelajar/
├── src/                        # ★ Backend (Node.js)
│   ├── server.js               # Entry point: setup Express, Socket.io, route, AI proxy
│   ├── supabase.js             # Koneksi ke database Supabase
│   ├── middleware/
│   │   ├── auth.js             # Verifikasi JWT + cek role (guru/murid)
│   │   └── security.js         # Helmet/CSP + anti-judol/iklan
│   ├── routes/                 # REST API (dikelompokkan per fitur)
│   │   ├── auth.js             # Login, register, OTP, data diri, reset password, Google
│   │   ├── kelas.js            # CRUD kelas + chat kelas + join/leave
│   │   ├── materi.js           # CRUD materi + upload file + tandai selesai
│   │   ├── soal.js             # Bank soal + quiz sederhana + latihan
│   │   ├── quiz.js             # Quiz lengkap + PR/tugas submission + penilaian
│   │   ├── zepquiz.js          # KitaQuiz (quiz live multiplayer)
│   │   ├── dashboard.js        # Statistik, leaderboard, penilaian, init data
│   │   ├── misi.js             # Misi, badge, hadiah harian (gamifikasi)
│   │   ├── latihan.js          # Catat latihan soal selesai (untuk XP/misi)
│   │   ├── belajar.js          # Catat materi "AyoBelajar" dibuka (untuk XP/misi)
│   │   ├── chat.js             # Chat privat (terenkripsi) + inbox
│   │   ├── notifikasi.js       # Notifikasi in-app
│   │   ├── orangtua.js         # Dashboard orangtua (pantau anak)
│   │   └── meeting.js          # Buat room video call
│   ├── socket/                 # Handler realtime (Socket.io)
│   │   ├── kelas.js            # Chat kelas realtime + status online + banner meeting
│   │   ├── zepquiz.js          # Logika game quiz live (room, matchmaking, skor)
│   │   ├── videocall.js        # Signaling WebRTC (mesh, peer-to-peer)
│   │   ├── mediasoup-sfu.js    # Signaling WebRTC alternatif (SFU)
│   │   └── world.js            # Game "world" + voting realtime
│   └── utils/
│       ├── groq.js             # Panggil Groq AI (dual-key fallback saat rate limit)
│       ├── gamification.js     # Hitung XP, level, streak, progres misi, klaim reward
│       └── crypto.js           # Enkripsi/dekripsi AES-256-GCM untuk pesan
│
├── public/                     # ★ Frontend (dikirim ke browser)
│   ├── belajar-seru.html       # Aplikasi utama (SPA, ~11.000 baris) — SEMUA halaman
│   ├── ai-features.js          # (di root) Asisten AI murid (chatbot 🤖)
│   ├── kita-latihan.html       # Halaman "Kita Latihan!" (latihan soal SD/SMP/SMA)
│   ├── kita-materi.html        # Halaman "AyoBelajar!" (ringkasan materi)
│   ├── belajar-game-v6.html    # "BelajarYuk!" (15+ mini game)
│   ├── zep-world.html          # Game world / voting
│   ├── sw.js                   # Service Worker (push notification)
│   ├── css/                    # Stylesheet
│   └── assets/                 # Gambar (maskot.png, robot-icon.svg)
│
├── ai-features.js              # Asisten AI murid (versi root, ~1.050 baris)
├── schema.sql                  # Skema database awal (tabel inti + seed demo)
├── migration_*.sql             # Migrasi tambahan (lihat bagian Database)
├── .env                        # Kunci rahasia (TIDAK di-upload ke GitHub)
├── package.json                # Dependency & script (npm start / npm run dev)
└── ARSITEKTUR.md               # Dokumen ini
```

---

## 4. Arsitektur Sistem (Gambaran Besar)

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Frontend)                    │
│  belajar-seru.html (SPA) + ai-features.js + sw.js         │
│  - Render UI, panggil REST API (fetch), Socket.io client  │
└───────────────┬─────────────────────┬───────────────────┘
                │ HTTP (REST API)      │ WebSocket (Socket.io)
                ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│                  SERVER (src/server.js)                   │
│  Middleware: compression → helmet → anti-judol →          │
│              rate-limit → cors → JSON parser               │
│                                                           │
│  Routes /api/*  ──►  src/routes/*.js                      │
│  Socket.io      ──►  src/socket/*.js                      │
│  AI Proxy       ──►  utils/groq.js (Groq API)            │
└───────┬─────────────────┬──────────────┬─────────────────┘
        │                 │              │
        ▼                 ▼              ▼
   ┌─────────┐      ┌───────────┐   ┌──────────────────┐
   │Supabase │      │ Groq AI   │   │ Brevo / Daily.co │
   │(Postgres)│     │ (LLaMA)   │   │ SearXNG / HF TTS │
   └─────────┘      └───────────┘   └──────────────────┘
```

**Pola umum:** Frontend → `fetch('/api/...')` dengan header `Authorization: Bearer <JWT>` → middleware cek token → route query Supabase → balas JSON. Untuk fitur realtime (chat/quiz/video), pakai Socket.io.

---

## 5. Backend — Penjelasan Per File

### 5.1 `src/server.js` (Entry Point)
Pusat aplikasi. Tugasnya:
- Setup Express + middleware (urutan penting: `compression` → `helmet` → `blockBadReferer` → `rate limit` → `cors` → `express.json` → `antiJudol`).
- Setup **Socket.io** + middleware verifikasi JWT untuk koneksi socket.
- **Mount semua route** (`/api/auth`, `/api/kelas`, dst).
- **Proxy AI** (agar API key tidak bocor ke frontend):
  - `POST /api/ai/chat` — chat teks ke Groq
  - `POST /api/ai/vision` — analisis gambar (model vision)
  - `POST /api/ai/tts/kokoro` — Text-to-Speech via HuggingFace
  - `GET  /api/ai/search` — **web search (SearXNG → fallback DuckDuckGo)**
  - `GET  /api/proxy/fetch` — ambil isi artikel dari URL (anti-SSRF)
  - `GET  /api/proxy/youtube-transcript` & `youtube-check` — transkrip & cek embed YouTube
- **Push notification**: `POST /api/push/subscribe`, `/api/push/unsubscribe`, helper `sendPushToUser()`.
- **Hasil quiz**: `POST /api/hasil-quiz` (simpan skor + tambah XP).
- **Error logging**: `POST /api/log-error` & `GET /api/error-logs` (simpan error frontend/backend ke tabel `error_logs`).
- Rate limiter khusus: `loginLimiter` (10x/15 menit), `aiLimiter` (15x/menit), `globalLimiter` (200x/15 menit).

### 5.2 `src/supabase.js`
Membuat satu koneksi Supabase pakai **service role key** (bisa bypass Row Level Security karena keamanan ditangani di layer aplikasi/JWT). Diekspor & dipakai di semua route.

### 5.3 `src/middleware/auth.js`
- `authMiddleware` — ambil token dari header `Authorization`, verifikasi JWT, simpan data user di `req.user`. Kalau gagal → 401.
- `guruOnly` / `muridOnly` — pastikan `req.user.role` sesuai, kalau tidak → 403.
- Ekspor `JWT_SECRET`.

### 5.4 `src/middleware/security.js`
- `helmetMiddleware` — security headers + **CSP** (daftar domain yang diizinkan: Groq, Supabase, Daily.co, Google, YouTube, dll).
- `antiJudolMiddleware` — blokir request yang isinya mengandung kata judi online/iklan/pinjol (daftar `BLOCKED_EXACT` & `BLOCKED_SUBSTR`).
- `blockBadReferer` — tolak request dari domain judol.

### 5.5 `src/utils/`
- **`groq.js`** — `callGroq(payload)`: panggil Groq AI. Kalau key utama kena rate limit (429), otomatis coba `GROQ_API_KEY_2`. Juga membersihkan tag `<think>...</think>` dari model reasoning.
- **`gamification.js`**:
  - `updateUserStats()` — tambah XP, hitung level (`floor(xp/1000)+1`), update streak harian, hitung quiz_count & rata-rata skor.
  - `checkMisi()` — cek progres misi (harian/mingguan/achievement) setiap aktivitas.
  - `claimMisiReward()` — klaim XP bonus + badge saat misi selesai.
- **`crypto.js`** — `encrypt()`/`decrypt()` AES-256-GCM. Isi chat di-enkripsi sebelum disimpan ke DB; format `iv:authTag:ciphertext`. Backward-compatible (pesan lama plaintext tetap terbaca).

---

## 6. Backend — Daftar REST API (Endpoint)

> Semua endpoint diawali `/api`. Tanda 🔒 = butuh login (JWT), 👩‍🏫 = guru saja, 🎒 = murid saja, 👨‍👩‍👧 = orangtua saja.

### `auth.js` — Autentikasi & Akun
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/auth/send-otp` | Langkah 1 daftar: kirim OTP ke email (guru wajib isi data diri di sini) |
| POST | `/auth/register` | Langkah 2 daftar: verifikasi OTP → buat akun (+ akun orangtua otomatis utk murid) |
| POST | `/auth/login` | Login email+password → JWT |
| POST | `/auth/google` | Login/daftar via Google OAuth |
| GET 🔒 | `/auth/profile` | Ambil profil + rank + data diri |
| PUT 🔒 | `/auth/profile` | Update profil (nama, avatar, password, data diri) — beri reward XP bila data diri jadi lengkap |
| PUT 🔒 | `/auth/data-diri` | Lengkapi data diri (popup murid) → **+150 XP sekali** |
| POST | `/auth/forgot-password` | Kirim OTP reset password |
| POST | `/auth/verify-reset-otp` | Verifikasi OTP reset → dapat reset_token |
| POST | `/auth/reset-password` | Ganti password pakai reset_token |

### `kelas.js` — Kelas & Chat Kelas
`POST 🔒👩‍🏫 /kelas` (buat), `GET 🔒 /kelas` (daftar), `GET 🔒 /kelas/:id`, `POST 🔒🎒 /kelas/join`, `DELETE 🔒👩‍🏫 /kelas/:id`, `DELETE 🔒🎒 /kelas/:id/leave`, plus chat: `GET/POST /kelas/:id/chat`, `PUT/DELETE /kelas/:id/chat/:msgId`.

### `materi.js` — Materi Belajar
`POST 🔒👩‍🏫 /materi/upload` (upload file), `POST 🔒👩‍🏫 /materi` (buat), `GET 🔒 /materi`, `GET 🔒 /materi/:id`, `PUT/DELETE 🔒👩‍🏫 /materi/:id`, `POST 🔒 /materi/:id/selesai` (murid tandai selesai → XP).

### `soal.js` — Bank Soal, Latihan & Quiz Sederhana
CRUD soal (`/soal`, guru), `GET /soal/latihan` & `/soal/latihan/mapel` (latihan), `GET/POST /soal/quiz` (quiz), `POST /soal/quiz/:id/submit`, `GET /soal/quiz/:id/leaderboard`.

### `quiz.js` — Quiz Lengkap & PR/Tugas
`GET/POST /quiz`, `GET /quiz/:id`, `POST /quiz/:id/soal`, `DELETE /quiz/:id`, `POST /quiz/hasil` (simpan hasil), `GET /quiz/hasil/cek`, dan **submission tugas**: `POST /quiz/:id/submission` (kumpul PR: file/link/gambar/teks), `GET /quiz/:id/submissions`, `PUT /quiz/:id/submissions/:sub_id/nilai` (guru menilai), `GET /quiz/:id/submission/cek`.

### `zepquiz.js` — KitaQuiz (Quiz Live)
`POST 🔒👩‍🏫 /zepquiz/room` (buat room), `GET /zepquiz/quiz` & `/murid-quiz`, `GET /zepquiz/quiz-soal/:quiz_id`, `POST /zepquiz/room-public`, `GET /zepquiz/bank-mapel` & `/bank-soal`, `GET /zepquiz/ai-generate` (generate soal pakai AI).

### `dashboard.js` — Dashboard & Statistik
`GET /dashboard` (statistik guru/murid), `GET /dashboard/leaderboard`, `GET /dashboard/penilaian` (nilai dikelompokkan per kelas), `GET /dashboard/murid-init` (muat data awal murid sekaligus), `GET/PUT /dashboard/notifikasi`.

### `misi.js` — Gamifikasi
`GET /misi` (daftar misi), `POST /misi/:id/klaim`, `GET /misi/daily-reward` & `POST /misi/daily-reward/klaim` (hadiah harian beruntun), `GET /misi/badges` & `/badges/semua`.

### `latihan.js` & `belajar.js`
`POST /latihan/selesai` — catat latihan soal selesai (untuk XP/misi).
`POST /belajar/buka` — catat materi AyoBelajar dibuka (untuk XP/misi).

### `chat.js` — Chat Privat (Terenkripsi)
`GET/POST /chat/private/:userId`, `PUT/DELETE /chat/private/msg/:msgId`, `GET /chat/inbox`. Isi pesan di-enkripsi AES (lihat `crypto.js`).

### `notifikasi.js`
`GET /notifikasi`, `PATCH /notifikasi/baca-semua`, `POST 🔒👩‍🏫 /notifikasi/kelas/:kelasId` (guru broadcast ke semua murid).

### `orangtua.js`
`GET 🔒👨‍👩‍👧 /orangtua/anak` (daftar anak), `GET 🔒👨‍👩‍👧 /orangtua/aktivitas/:murid_id` (detail aktivitas: quiz, tugas, materi, rank).

### `meeting.js`
`POST 🔒👩‍🏫 /meeting/buat` — buat room video call (Daily.co).

---

## 7. Backend — Socket.io (Realtime)

| File | Prefix Event | Fungsi |
|------|--------------|--------|
| `socket/kelas.js` | `kelas:*`, `private:*` | Chat kelas realtime, status online/offline, edit/hapus pesan, banner "meeting dimulai", chat privat |
| `socket/zepquiz.js` | `zep:*` | Game quiz live: buat/join room, mulai game, jawab soal, skor, matchmaking (1v1), public room, rejoin, forfeit |
| `socket/videocall.js` | `vc:*` | Signaling WebRTC mesh (offer/answer/ICE) untuk video call peer-to-peer |
| `socket/mediasoup-sfu.js` | `vc:*` | Signaling WebRTC mode SFU (alternatif, lebih scalable) |
| `socket/world.js` | `world:*` | Game "world": gerak avatar, voting map, jawab soal bareng |

---

## 8. Frontend — Penjelasan Per File

### 8.1 `public/belajar-seru.html` (Aplikasi Utama — SPA)
File raksasa (~11.000 baris) berisi **seluruh halaman** dalam satu file. Berisi HTML, CSS (`<style>`), dan JavaScript (`<script>`).

**Sistem navigasi:** fungsi `showPage(id)` menyembunyikan/menampilkan `<div class="page">`. Tidak ada reload halaman.

**Halaman utama (`<div class="page" id="...">`):**
- `page-login`, `page-register`, `page-reset` (auth)
- `page-murid` (dashboard murid), `page-guru` (dashboard guru), `page-orangtua` & `page-orangtua-detail`
- `page-kelas` (ruang kelas: materi, chat, anggota), `page-profile-murid`, `page-profile-guru`
- halaman quiz, latihan, dll.

**Modal penting:** `modal-otp-register`, `modal-data-diri` (popup lengkapi data diri + reward), `modal-google-role`, `modal-join-kelas`, `modal-submission`.

**Fungsi JavaScript kunci:**
| Fungsi | Tugas |
|--------|-------|
| `api(method, path, body)` | Wrapper `fetch` + otomatis pasang token JWT |
| `doLogin()`, `doRegister()`, `doVerifyOTP()` | Alur login & daftar |
| `switchRegRole()` | Tampilkan field data diri saat daftar guru |
| `openDataDiriModal()`, `doSubmitDataDiri()`, `skipDataDiri()`, `remindDataDiriIfNeeded()`, `showDataDiriReward()` | **Onboarding data diri + reward XP** |
| `_handleGoogleCredential()`, `completeGoogleRegister()` | Login/daftar Google |
| `loadMuridDashboard()`, `loadGuruDashboard()`, `loadOrangtuaDashboard()` | Muat dashboard sesuai role |
| `toggleGuruChat()`, `kirimGuruChat()`, `gchatSearchWeb()`, `gchatIsSearchIntent()` | **Asisten AI Guru + web search realtime** |
| `loadMisi()`, `loadDailyReward()`, `klaimMisi()` | Gamifikasi |
| `loadBellNotifications()`, `subscribePush()` | Notifikasi & push |
| `startQuiz()`, `bukaZepQuizMurid()` | Quiz |

### 8.2 `ai-features.js` (Asisten AI Murid)
Chatbot mengambang (FAB 🤖) untuk **murid**: tanya pelajaran, ringkasan materi, dll. Memanggil `/api/ai/chat`. Punya system prompt ramah untuk anak SD/SMP.

### 8.3 Halaman terpisah
- **`kita-latihan.html`** — "Kita Latihan!": pilih mapel & jenjang (SD/SMP/SMA), latihan soal sepuasnya.
- **`kita-materi.html`** — "AyoBelajar!": ringkasan materi pelajaran.
- **`belajar-game-v6.html`** — "BelajarYuk!": 15+ mini game edukatif.
- **`zep-world.html`** — game world/voting.

### 8.4 `sw.js` (Service Worker)
Menampilkan **push notification** walau tab tertutup. Di-register saat login.

---

## 9. Database (Supabase / PostgreSQL)

### Tabel inti (`schema.sql`)
`users`, `kelas`, `kelas_murid`, `materi`, `soal`, `quiz`, `quiz_soal`, `hasil_quiz`, `detail_jawaban`, `progres_materi`, `notifikasi`, `pesan_kelas`.

### Migrasi tambahan (jalankan berurutan di Supabase SQL Editor)
| File | Isi |
|------|-----|
| `migration_features_v2.sql` | Role `orangtua`, tabel `parent_student`, `push_subscriptions`, kolom `mapel` & reset_token |
| `migration_quiz.sql` / `migration_submission.sql` | Kolom `tipe`/`deadline`/`tipe_submission`, tabel `tugas_submission` |
| `migration_gamification.sql` | Tabel `badges`, `misi_template`, `misi_murid`, `murid_badges`, kolom streak/quiz_count |
| `migration_badges_v2.sql`, `migration_daily_reward.sql`, `migration_latihan_misi.sql`, `migration_misi_latihan_belajar.sql`, `migration_welcome_badge.sql` | Tambahan badge & misi |
| `migration_pesan_kelas.sql`, `migration_pesan_private.sql` | Tabel chat kelas & chat privat |
| `migration_fixes_v3.sql` | Perbaikan kecil |
| **`migration_data_diri.sql`** | **Kolom `alamat`, `umur`, `asal_sekolah`, `profil_lengkap` di `users` + kolom `tipe`/`data_extra` di `notifikasi`** |

> ⚠️ Tanpa menjalankan migrasi yang sesuai, fitur terkait akan error (kolom/tabel belum ada).

---

## 10. Alur Penting (Flow)

### A. Registrasi + Onboarding Data Diri + Reward
1. **Daftar manual:** isi form → `POST /auth/send-otp` → OTP ke email → `POST /auth/register` (verifikasi OTP). Guru wajib isi data diri di form; murid tidak.
2. Untuk **murid**, sistem otomatis membuat **akun orangtua** + kirim kredensial via email **dan** notifikasi in-app.
3. **Murid baru** (manual atau Google) → muncul **popup data diri** (`modal-data-diri`). Bisa "Isi nanti" (diingatkan tiap login).
4. Saat data diri **pertama kali lengkap** → `PUT /auth/data-diri` memberi **+150 XP** sekali → popup perayaan `showDataDiriReward()`.

### B. Quiz Live (KitaQuiz)
Guru buat room (`/zepquiz/room`) → murid join via Socket.io (`zep:join_room`) → guru mulai (`zep:start_game`) → soal dikirim realtime → murid jawab (`zep:jawab`) → skor & leaderboard live.

### C. Video Call Kelas
Guru buat meeting (`/meeting/buat`, Daily.co) → broadcast banner ke murid via socket (`kelas:meeting_started`) → murid masuk room. WebRTC signaling lewat `socket/videocall.js` atau `mediasoup-sfu.js`.

### D. Asisten AI Guru dengan Data Realtime
Guru tanya di chat → `gchatIsSearchIntent()` deteksi apakah butuh data terbaru → kalau ya, `GET /api/ai/search` (SearXNG) ambil hasil web → hasil dimasukkan ke konteks → `POST /api/ai/chat` (Groq) → jawaban menyertakan sumber/link.

### E. Gamifikasi
Setiap aktivitas (quiz, materi, latihan) → `updateUserStats()` tambah XP/streak → `checkMisi()` cek progres misi → murid klaim reward (XP + badge).

---

## 11. Environment Variables (`.env`)

| Variabel | Fungsi |
|----------|--------|
| `PORT`, `CORS_ORIGIN` | Konfigurasi server |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Koneksi database |
| `JWT_SECRET` | Tanda tangan token login |
| `ENCRYPTION_KEY` | Kunci enkripsi pesan (64 hex / 32 byte) |
| `GROQ_API_KEY`, `GROQ_API_KEY_2`, `GROQ_MODEL` | AI (dual-key fallback) |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` | Email |
| `DAILY_API_KEY` | Video call |
| `HF_TOKEN` | Text-to-Speech |
| `GOOGLE_CLIENT_ID` | Login Google |
| `SEARXNG_URL` | Web search realtime (default mikosearch) |
| `APP_URL` | URL aplikasi (untuk link email) |

> 🔒 `.env` ada di `.gitignore` — **tidak pernah di-upload ke GitHub**. Di Railway, set lewat menu **Variables**.

---

## 12. Cara Menjalankan

```bash
# Install dependency
npm install

# Jalankan (production)
npm start

# Jalankan (development, auto-reload)
npm run dev
```
Server berjalan di `http://localhost:3000`. Buka di browser → halaman login muncul.

**Akun demo** (dari `schema.sql`): Guru `guru@demo.com / guru123`, Murid `andi@demo.com / murid123`.

---

## 13. Catatan Keamanan
- Password di-hash bcrypt; pesan chat di-enkripsi AES-256-GCM.
- API key pihak ketiga **tidak pernah ada di frontend** — semua lewat proxy backend.
- Helmet + CSP membatasi sumber script/koneksi.
- Rate limiting di login & AI untuk cegah penyalahgunaan.
- Filter anti-judol/iklan di setiap request.
- Anti-SSRF di proxy fetch artikel (blokir IP internal, hanya HTTPS).

---

*Dokumen dibuat otomatis berdasarkan kode terkini. Perbarui bila ada perubahan besar pada arsitektur.*
