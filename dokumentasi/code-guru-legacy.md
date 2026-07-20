# Code Guru — Legacy Support & Email Verification

## Ringkasan Fitur

Fitur ini menambahkan `code_guru` permanen per guru langsung di tabel `users`,
dengan dua jalur berbeda untuk guru lama dan guru baru.

---

## Flow Lengkap

### Guru Lama (sudah terdaftar sebelum fitur ini)

```
Migration SQL dijalankan
  → users.code_guru di-generate otomatis untuk semua guru yang code_guru IS NULL
  → Login: skip validasi kode undangan (users.code_guru sudah ada)
  → Lihat code di profil: wajib verifikasi email (OTP 6 digit, 10 menit)
```

### Guru Baru (mendaftar setelah fitur ini)

```
Kepala sekolah generate kode undangan (tabel kode_guru, flow lama)
  → Guru daftar dengan kode undangan kepala sekolah (POST /api/auth/send-otp)
  → OTP registrasi dikirim ke email
  → Verifikasi OTP → akun dibuat (POST /api/auth/register)
  → code_guru di-generate otomatis via RPC generate_code_guru_for_user()
  → Login: skip validasi kode undangan (users.code_guru sudah ada)
  → Lihat code di profil: wajib verifikasi email (OTP)
```

---

## Perubahan Database

### File: [`migration_code_guru_legacy.sql`](../migration_code_guru_legacy.sql)

| Perubahan | Detail |
|-----------|--------|
| `ALTER TABLE users ADD COLUMN code_guru TEXT UNIQUE` | Kode permanen per guru |
| `ALTER TABLE users ADD COLUMN code_guru_generated_at TIMESTAMPTZ` | Timestamp generate |
| `CREATE INDEX idx_users_code_guru` | Index untuk lookup cepat |
| `FUNCTION generate_code_guru_value()` | Helper: generate kode 8 char unik |
| `FUNCTION generate_code_guru_for_user(p_user_id UUID)` | RPC: generate & simpan ke users |
| `DO $$ ... $$` block | Auto-generate untuk semua guru lama |

**Cara menjalankan:**
```sql
-- Di Supabase > SQL Editor > New Query
-- Paste isi migration_code_guru_legacy.sql lalu Run
```

---

## Perubahan Backend

### File: [`src/routes/auth.js`](../src/routes/auth.js)

#### 1. In-memory store baru (line ~77)

```js
const codeGuruOtpStore = new Map(); // email → { otp, userId, expiresAt }
```

#### 2. `POST /api/auth/login` — Skip validasi untuk guru lama (line ~524)

**Sebelum:** Semua guru wajib kirim `code_guru` saat login (kode undangan kepala sekolah).

**Sesudah:**
- Jika `user.code_guru` ada di DB → **skip** validasi, langsung login ✅
- Jika `user.code_guru` NULL (edge case) → coba auto-generate via RPC, jika gagal tolak dengan pesan jelas

```js
if (user.role === 'guru') {
  if (user.code_guru) {
    // ✅ Guru lama → skip validasi kode undangan
  } else {
    // ⚠️ Coba auto-generate, jika gagal tolak
  }
}
```

#### 3. `POST /api/auth/register` — Auto-generate `code_guru` untuk guru baru (line ~417)

Setelah akun guru berhasil dibuat, langsung panggil RPC:

```js
if (role === 'guru') {
  await supabase.rpc('generate_code_guru_for_user', { p_user_id: id })
    .catch(async () => { /* fallback manual */ });
}
```

#### 4. `GET /api/auth/profile` — Flag `has_code_guru` (line ~579)

Response untuk guru **tidak** menyertakan `code_guru` langsung.
Hanya flag boolean:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "nama": "Bu Sari",
    "role": "guru",
    "has_code_guru": true,
    "code_guru": undefined
  }
}
```

#### 5. `POST /api/auth/send-code-guru-otp` *(baru)* (line ~895)

| | |
|---|---|
| **Auth** | `authMiddleware` (wajib login) |
| **Role** | `guru` saja |
| **Aksi** | Kirim OTP 6 digit ke email guru, simpan di `codeGuruOtpStore` (10 menit) |
| **Response sukses** | `{ success: true, pesan: "Kode OTP dikirim ke email kamu. Berlaku 10 menit." }` |

**Request:**
```http
POST /api/auth/send-code-guru-otp
Authorization: Bearer <token>
```

**Response:**
```json
{ "success": true, "pesan": "Kode OTP dikirim ke email kamu. Berlaku 10 menit." }
```

#### 6. `POST /api/auth/verify-code-guru-otp` *(baru)* (line ~960)

| | |
|---|---|
| **Auth** | `authMiddleware` (wajib login) |
| **Role** | `guru` saja |
| **Body** | `{ "otp": "123456" }` |
| **Aksi** | Verifikasi OTP → kembalikan `code_guru` |
| **OTP** | Sekali pakai, dihapus setelah verifikasi berhasil |

**Response sukses:**
```json
{
  "success": true,
  "pesan": "Verifikasi berhasil! Berikut Code Guru kamu.",
  "data": {
    "code_guru": "ABCD1234",
    "generated_at": "2025-07-20T09:00:00.000Z"
  }
}
```

**Response error:**
```json
{ "success": false, "pesan": "Kode OTP salah." }
{ "success": false, "pesan": "Kode OTP sudah kedaluwarsa. Minta ulang kode." }
{ "success": false, "pesan": "Hanya guru yang bisa mengakses fitur ini." }
```

---

## Alur Frontend (Profil Guru)

```
1. GET /api/auth/profile
   → Cek has_code_guru === true

2. Tampilkan tombol "Lihat Code Guru 🔑" (tersembunyi di balik verifikasi)

3. User klik tombol → POST /api/auth/send-code-guru-otp
   → Tampilkan form input OTP

4. User masukkan OTP → POST /api/auth/verify-code-guru-otp
   → Tampilkan code_guru (misal: "ABCD1234")
   → Sembunyikan lagi setelah beberapa detik (opsional)
```

---

## Keamanan

| Aspek | Implementasi |
|-------|-------------|
| `code_guru` tidak pernah dikirim di `/profile` | `delete responseData.code_guru` sebelum response |
| OTP 6 digit, berlaku 10 menit | `codeGuruOtpStore` dengan `expiresAt` |
| OTP sekali pakai | `codeGuruOtpStore.delete(email)` setelah verifikasi |
| OTP terikat ke `userId` | Cek `entry.userId !== user.id` |
| `code_guru` unik per guru | `UNIQUE` constraint di DB + loop cek duplikat |
| Charset tanpa karakter ambigu | `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (tanpa I, O, 0, 1) |

---

## Urutan Deployment

1. **Jalankan SQL migration** di Supabase SQL Editor:
   ```
   migration_code_guru_legacy.sql
   ```
2. **Deploy ulang backend** (Railway / server) — tidak perlu restart manual jika auto-deploy.
3. **Verifikasi** di Supabase Table Editor:
   - Kolom `code_guru` dan `code_guru_generated_at` ada di tabel `users`
   - Semua guru lama sudah punya `code_guru` (tidak NULL)
