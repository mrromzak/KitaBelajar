# Menjalankan KitaBelajar di Lokal (sebelum deploy Railway)

Panduan menjalankan aplikasi **persis seperti versi Railway**, tapi di komputer
sendiri, dengan **Supabase** dan **login dummy** (tanpa OTP/email). Cocok untuk uji
coba sebelum push & deploy.

> Kunci pemahaman: **login TIDAK butuh OTP/email** — yang butuh OTP hanya
> *registrasi*. Jadi cukup isi akun dummy ke database, lalu login biasa.

---

## 1. Prasyarat
- Node.js 18+ (proyek diuji di Node 22).
- Satu project **Supabase** (gratis). **Disarankan project khusus uji**, agar data
  dummy tidak tercampur dengan produksi.

## 2. Clone & install
```bash
git clone <repo-url> kitabelajar
cd kitabelajar
npm install
```

## 3. Siapkan database Supabase
Di Supabase → **SQL Editor → New Query**, jalankan berurutan:
1. `schema.sql` (tabel inti + data demo)
2. Semua `migration_*.sql` yang relevan — minimal:
   - `migration_features_v2.sql` (role orangtua, parent_student, dll)
   - `migration_data_diri.sql`
   - `migration_kode_guru.sql` (role `kepala_sekolah` + tabel kode guru)
   - (lainnya sesuai fitur yang ingin diuji)

## 4. Konfigurasi `.env`
```bash
cp .env.example .env
```
Isi minimal yang **wajib** (lihat komentar di `.env.example`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` → dari Supabase (Settings → API)
- `JWT_SECRET` → `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `ENCRYPTION_KEY` → `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Sisanya (Brevo, Groq, Google, dll) **opsional** — fitur terkait mati dengan aman
bila kosong, tapi aplikasi tetap jalan.

## 5. Isi akun dummy (login tanpa OTP)
```bash
npm run seed:dummy
```
Membuat 3 akun + 1 kelas demo (idempoten, aman diulang):

| Peran | Email | Password |
|-------|-------|----------|
| Guru | `dev.guru@local.test` | `Dev12345` |
| Murid | `dev.murid@local.test` | `Dev12345` |
| Kepala sekolah | `dev.kepala@local.test` | `Dev12345` |

Murid dummy otomatis terdaftar di "Kelas Demo Lokal" milik guru dummy.

> Akun demo bawaan `schema.sql` juga bisa dipakai: `guru@demo.com / guru123`,
> `andi@demo.com / murid123`.

## 6. Jalankan
```bash
npm run dev      # auto-reload saat file berubah (nodemon)
# atau: npm start
```
Buka **http://localhost:3000**, pilih tab peran, login dengan akun di atas.

---

## Yang bisa diuji lokal vs butuh layanan eksternal

| Fitur | Lokal tanpa key eksternal? |
|-------|----------------------------|
| Login, kelas, materi (teks), quiz, chat, dashboard | ✅ Ya |
| **Registrasi via OTP** | ❌ Butuh `BREVO_API_KEY` (atau pakai akun seed) |
| Chatbot AI / generate soal AI | ❌ Butuh `GROQ_API_KEY` |
| Text-to-speech | ❌ Butuh `HF_TOKEN` |
| Login Google | ❌ Butuh `GOOGLE_CLIENT_ID` |
| Video meeting | ❌ Butuh `DAILY_API_KEY` |
| Upload file materi | ✅ Ya (butuh bucket `materi-files` di Supabase — dibuat oleh `schema.sql`) |

## Catatan
- `.env` tidak akan ter-commit (sudah di `.gitignore`).
- Untuk akun **kepala sekolah** sungguhan (bukan dummy), pakai `npm run seed:kepala`.
- Beda dengan Railway hanya pada **environment variables** — kode-nya identik.
  Set variabel yang sama di Railway → Variables saat deploy.
- Folder `test/` dan `prototype/` di-`.gitignore` (tidak ikut ter-push).
