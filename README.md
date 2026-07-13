<div align="center">

<img src="public/assets/maskot.png" alt="KitaBelajar" width="120" />

# 🦁 KitaBelajar

**Platform Belajar Seru untuk Murid, Guru, dan Orangtua Indonesia**

LMS (Learning Management System) berbasis web dengan kelas online, materi, quiz, gamifikasi, video call, dan asisten AI.

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/license-private-lightgrey)

</div>

---

## ✨ Fitur Utama

- 🏫 **Manajemen Kelas** — guru buat kelas, murid gabung pakai kode akses
- 📚 **Materi Belajar** — teks, PDF, video, gambar
- ⚡ **Quiz & Latihan** — quiz kilat, quiz live multiplayer (KitaQuiz), bank soal, PR/tugas
- 🎥 **Kelas Online** — video call via Jitsi
- 💬 **Chat** — chat kelas & chat privat (terenkripsi AES-256-GCM)
- 🏆 **Gamifikasi** — XP, level, streak, badge, misi, hadiah harian, leaderboard
- 🤖 **Asisten AI** — chatbot untuk murid & guru, dengan pencarian web realtime (SearXNG)
- 👨‍👩‍👧 **Akun Orangtua** — memantau aktivitas belajar anak (dibuat otomatis saat murid daftar)
- 🔔 **Notifikasi** — in-app & push notification
- 📋 **Onboarding Data Diri** — isi data diri saat daftar, murid dapat reward XP

---

## 🛠️ Teknologi

**Backend:** Node.js, Express.js, Supabase (PostgreSQL), Socket.io, JWT, bcryptjs, Helmet, Multer
**Frontend:** HTML, CSS, JavaScript (vanilla, SPA), Service Worker, KaTeX
**Layanan Eksternal:** Groq AI (LLaMA/Qwen), Brevo (email), Jitsi (video call), HuggingFace (TTS), Google OAuth, SearXNG (web search)
**Deployment:** Railway · GitHub

---

## 🚀 Cara Menjalankan (Lokal)

### 1. Prasyarat
- [Node.js](https://nodejs.org/) versi LTS + npm
- Akun [Supabase](https://supabase.com/) (database)

### 2. Clone & Install
```bash
git clone https://github.com/mrromzak/KitaBelajar.git
cd KitaBelajar
npm install
```

### 3. Siapkan Database
Buka **Supabase → SQL Editor**, lalu jalankan file SQL secara berurutan:
1. `schema.sql` (tabel inti + data demo)
2. Semua file `migration_*.sql` (lihat daftar di bawah)

> ⚠️ Tanpa menjalankan migrasi yang sesuai, fitur terkait akan error karena kolom/tabel belum ada.

### 4. Konfigurasi `.env`
Buat file `.env` di root proyek (lihat bagian [Environment Variables](#-environment-variables)).

### 5. Jalankan
```bash
npm start        # mode produksi
npm run dev      # mode development (auto-reload)
```
Buka di browser: **http://localhost:3000**

### 🔑 Akun Demo
| Role | Email | Password |
|------|-------|----------|
| Guru | `guru.demo@kitabelajar.id` | `Guru12345` |
| Murid | `murid.demo@kitabelajar.id ` | `Murid12345` |

---

## 🔐 Environment Variables

Buat file `.env` (file ini **tidak** di-commit ke Git):

```env
# Server
PORT=3000
CORS_ORIGIN=https://domain-kamu.com
APP_URL=https://domain-kamu.com

# Database (Supabase)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...

# Autentikasi
JWT_SECRET=rahasia-acak-panjang
ENCRYPTION_KEY=64-karakter-hex   # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# AI (Groq) — key ke-2 opsional untuk fallback rate limit
GROQ_API_KEY=gsk_xxx
GROQ_API_KEY_2=gsk_yyy
GROQ_MODEL=openai/gpt-oss-120b

# Email (Brevo)
BREVO_API_KEY=xkeysib-xxx
BREVO_FROM_EMAIL=email@kamu.com
BREVO_FROM_NAME=KitaBelajar

# Lainnya
HF_TOKEN=hf_xxx                  # HuggingFace TTS
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
SEARXNG_URL=https://mikosearch.up.railway.app   # web search (opsional, ada default)
```

> Saat deploy di **Railway**, isi variabel ini lewat menu **Variables** (jangan upload `.env`).

---

## 📂 Struktur Proyek

```
KitaBelajar/
├── src/                    # Backend (Node.js)
│   ├── server.js           # Entry point: Express, Socket.io, proxy AI
│   ├── supabase.js         # Koneksi database
│   ├── middleware/         # Autentikasi & keamanan
│   ├── routes/             # REST API (auth, kelas, materi, quiz, dll)
│   ├── socket/             # Handler realtime (chat, quiz live, dll)
│   └── utils/              # AI, gamifikasi, enkripsi
├── public/                 # Frontend
│   ├── belajar-seru.html   # Aplikasi utama (SPA)
│   ├── kita-latihan.html   # Latihan soal
│   ├── kita-materi.html    # Ringkasan materi
│   ├── belajar-game-v6.html# Mini game
│   ├── sw.js               # Service worker (push notification)
│   └── assets/, css/
├── ai-features.js          # Asisten AI murid
├── schema.sql              # Skema database awal
├── migration_*.sql         # Migrasi database
├── ARSITEKTUR.md           # Dokumentasi teknis lengkap
└── dokumentasi/            # Dokumentasi tambahan
```

---

## 🗄️ Migrasi Database

Jalankan di Supabase SQL Editor setelah `schema.sql`:

| File | Isi |
|------|-----|
| `migration_features_v2.sql` | Role orangtua, tabel parent_student, push_subscriptions |
| `migration_gamification.sql` | Badge, misi, streak, XP |
| `migration_quiz.sql`, `migration_submission.sql` | Quiz lanjutan & tugas |
| `migration_pesan_kelas.sql`, `migration_pesan_private.sql` | Chat kelas & privat |
| `migration_badges_v2.sql`, `migration_daily_reward.sql`, `migration_latihan_misi.sql`, `migration_misi_latihan_belajar.sql`, `migration_welcome_badge.sql` | Badge & misi tambahan |
| `migration_data_diri.sql` | Data diri (alamat, umur, asal sekolah) + kolom notifikasi |
| `migration_fixes_v3.sql` | Perbaikan kecil |

---

## 📖 Dokumentasi Lengkap

- **[ARSITEKTUR.md](ARSITEKTUR.md)** — arsitektur, daftar API, event Socket.io, alur fitur
- **[dokumentasi/penjelasan.md](dokumentasi/penjelasan.md)** — deskripsi sistem, kebutuhan, komponen, teknologi

---

## 🔒 Keamanan

- Password di-hash dengan bcrypt
- Isi chat dienkripsi (AES-256-GCM)
- Autentikasi JWT + rate limiting
- Helmet + Content Security Policy
- Filter konten terlarang (anti-judol/iklan) & anti-SSRF
- API key pihak ketiga hanya di backend (tidak pernah bocor ke frontend)

---

<div align="center">
 untuk pendidikan Indonesia · **KitaBelajar**

</div>
