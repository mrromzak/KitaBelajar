# Panduan Deploy KitaBelajar ke Railway

Dokumen ini menjelaskan langkah-langkah untuk melakukan deployment aplikasi **KitaBelajar** ke platform **Railway** dengan database **Supabase** yang sudah terhubung.

---

## 1. Prasyarat
- Akun [Railway](https://railway.app/)
- Akun [Supabase](https://supabase.com/) dengan database yang sudah terkonfigurasi dan migrasi yang sudah dijalankan.
- Repositori GitHub proyek KitaBelajar yang sudah di-push.

---

## 2. Konfigurasi Environment Variables di Railway
Saat membuat service baru di Railway dari repositori GitHub Anda, Anda **wajib** mengisi variabel lingkungan (Environment Variables) berikut di tab **Variables** pada dashboard Railway Anda:

| Nama Variabel | Deskripsi | Contoh / Nilai |
|---------------|-----------|----------------|
| `PORT` | Port yang digunakan oleh Express server | `3000` (atau biarkan Railway mengaturnya secara otomatis) |
| `NODE_ENV` | Mode environment aplikasi | `production` |
| `SUPABASE_URL` | URL API Supabase Anda | `https://kxvqoixvoydkxgaxezqj.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key Supabase (untuk bypass RLS di backend) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `JWT_SECRET` | Kunci rahasia untuk enkripsi token JWT | *String acak panjang* (misal: `LXBT<UND-<<XAUCQB`) |
| `ENCRYPTION_KEY` | Kunci enkripsi chat & jawaban (wajib 64 hex / 32 byte) | `84826b7d652b6d63176c6b8f3695562d197e658f57c1dc4def590805e1beee8b` |
| `APP_URL` | URL domain aplikasi Anda setelah dideploy | `https://kitabelajar.up.railway.app` |
| `CORS_ORIGIN` | Domain yang diizinkan untuk CORS (pisahkan dengan koma jika banyak) | `https://kitabelajar.up.railway.app,https://kitabelajar-production.up.railway.app` |
| `KEPALA_EMAIL` | Email akun kepala sekolah | `kepala@sekolah.id` |
| `KEPALA_PASS` | Password akun kepala sekolah | `KepalaProto2024!` |
| `KEPALA_NAMA` | Nama akun kepala sekolah | `Kepala Sekolah` |

### Variabel Opsional (Fitur Tambahan)
Jika Anda ingin mengaktifkan fitur tambahan, isi juga variabel berikut:
- `GROQ_API_KEY` & `GROQ_API_KEY_2` & `GROQ_MODEL`: Untuk fitur Asisten AI & Zep Quiz.
- `DAILY_API_KEY`: Untuk fitur Video Call / Meeting.
- `HF_TOKEN`: Untuk fitur Text-to-Speech (TTS).
- `GOOGLE_CLIENT_ID`: Untuk login menggunakan Google OAuth.
- `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`: Untuk pengiriman email OTP registrasi.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: Untuk pengiriman email reset password.
- `SEARXNG_URL`: URL mesin pencari SearXNG untuk asisten AI.

---

## 3. Langkah Deployment di Railway
1. Buka [Railway Dashboard](https://railway.app/) dan login.
2. Klik **New Project** -> **Deploy from GitHub repo**.
3. Pilih repositori **KitaBelajar**.
4. Sebelum deploy berjalan selesai, masuk ke menu **Variables** pada service tersebut dan tambahkan semua Environment Variables di atas.
5. Railway akan mendeteksi [`Procfile`](Procfile) yang berisi `web: npm start` dan secara otomatis membangun serta menjalankan aplikasi Anda.
6. Setelah deployment selesai, buka tab **Settings** di Railway, cari bagian **Environment** -> **Domains**, lalu klik **Generate Domain** atau masukkan custom domain Anda.
7. Pastikan domain tersebut sudah dimasukkan ke dalam variabel `APP_URL` dan `CORS_ORIGIN` di tab **Variables**.

Aplikasi Anda kini sudah aktif dan siap digunakan secara online!
