# Arsitektur Sistem Kode Undangan Guru (Teacher Invitation Code)

> Status: **rancangan + prototype** (belum terintegrasi ke aplikasi utama).
> Tanggal: 2026-06-22 · Versi: 1.0
> Prototype mandiri ada di [`prototype/kode-guru/`](../prototype/kode-guru/).

---

## 1. Latar Belakang & Tujuan

Pada sistem sekarang, **siapa pun bisa mendaftar sebagai guru** hanya dengan memilih
tab "Guru" pada form registrasi (`public/belajar-seru.html`, fungsi `switchRegRole`)
dan tidak ada verifikasi apa pun di backend (`src/routes/auth.js` → `POST /send-otp`).
Ini membuka celah: orang tak berwenang bisa mendapat akses guru (membuat kelas,
menilai murid, melihat data murid).

**Tujuan:** registrasi guru hanya boleh berhasil bila pendaftar memasukkan
**kode undangan** yang sah. Kode diterbitkan oleh **kepala sekolah** (otoritas tertinggi).

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| Pilih role guru | Bebas | Wajib kode undangan valid |
| Penerbit otoritas | Tidak ada | Kepala sekolah |
| Jejak audit | Tidak ada | Tercatat (kode → guru → waktu) |
| Pencabutan akses | Tidak bisa | Kode dapat dicabut / kadaluarsa |

### Keputusan desain yang disepakati
1. **Cakupan: satu sekolah** — tanpa multi-tenant, tidak perlu kolom `sekolah_id` di mana-mana.
2. **Bootstrap: admin buat kepala sekolah secara manual** — lewat seed/secret, tanpa role `admin` di aplikasi.
3. **Tipe kode: fleksibel** — tiap kode punya `max_uses` (kuota) + `expires_at` (kadaluarsa) opsional.

---

## 2. Hierarki Peran (Role)

Peran saat ini: `murid`, `guru`, `orangtua`. Ditambah satu peran baru: **`kepala_sekolah`**.

```
 (bootstrap manual: seed / endpoint ber-secret)
        │
        ▼
 kepala_sekolah  ──menerbitkan──►  kode_guru
        │                              │
        │                              ▼
        │                     guru mendaftar pakai kode
        │                              │
        ▼                              ▼
 mengelola kode & daftar guru     murid / orangtua (tidak berubah)
```

Karena hanya **satu sekolah**, tidak diperlukan peran `admin` di dalam aplikasi.
"Admin" cukup berupa proses bootstrap satu kali untuk membuat akun kepala sekolah.

---

## 3. Masalah Bootstrap (ayam & telur)

Jika guru butuh kode dari kepala sekolah, siapa membuat kepala sekolah pertama?
**Solusi yang dipilih: dibuat manual oleh admin/developer**, salah satu dari:

- **Seed script** (`seed_kepala.js`) yang dijalankan sekali untuk meng-insert satu
  user `kepala_sekolah`. Paling aman karena tidak meninggalkan endpoint menganggur.
- **Endpoint ber-secret** `POST /api/admin/kepala-sekolah`, dijaga header
  `x-admin-secret` yang dicocokkan dengan `process.env.ADMIN_SECRET`.

Setelah akun kepala sekolah ada, seluruh proses berikutnya berjalan mandiri.

---

## 4. Model Data

### 4.1 Perubahan tabel `users`
Cukup menambah satu nilai pada kolom `role`: `kepala_sekolah`.
(Tidak perlu `sekolah_id` karena hanya satu sekolah.)

### 4.2 Tabel baru `kode_guru`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid PK | |
| `kode` | text UNIQUE | kode undangan, charset tanpa karakter ambigu |
| `dibuat_oleh` | uuid → users.id | kepala sekolah penerbit |
| `status` | text | `active` \| `revoked` |
| `max_uses` | int (default 1) | 1 = sekali pakai, N = kuota |
| `used_count` | int (default 0) | jumlah sudah terpakai |
| `expires_at` | timestamptz (null) | null = tanpa batas waktu |
| `label` | text (null) | catatan, mis. "Guru IPA gel. 1" |
| `created_at` | timestamptz | default now() |

### 4.3 Tabel baru `kode_guru_redemptions` (audit)

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid PK | |
| `kode_id` | uuid → kode_guru.id | |
| `guru_id` | uuid → users.id | guru yang memakai |
| `redeemed_at` | timestamptz | default now() |

> Catatan: kolom turunan seperti "kadaluarsa" / "habis" **tidak disimpan**;
> dihitung saat validasi (lazy) agar tidak perlu timer/cron — menghindari memory leak.

---

## 5. Siklus Hidup Kode (State Machine)

```
 [generate] ──► active ──redeem──► used_count++
                  │                    │
                  │                    └─(used_count == max_uses)─► HABIS
                  ├─(now > expires_at)──────────────────────────► KADALUARSA
                  └─(kepala revoke)────────────────────────────► DICABUT
```

Sebuah kode **dapat dipakai (redeemable)** hanya bila **SEMUA** benar:
`status = 'active'` **dan** `used_count < max_uses` **dan**
(`expires_at IS NULL` **atau** `expires_at > now()`).

---

## 6. Endpoint API

### Kepala sekolah (perlu role `kepala_sekolah`)
| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/api/kode-guru` | buat kode `{ max_uses, expires_in_days, label }` |
| GET | `/api/kode-guru` | daftar kode milik kepala + status terpakai |
| PATCH | `/api/kode-guru/:id/revoke` | cabut kode |
| GET | `/api/kepala/guru` | daftar guru terdaftar |

### Registrasi (publik)
| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/api/auth/validate-kode-guru` | cek kode sebelum OTP (UX, di-rate-limit) |
| POST | `/api/auth/send-otp` | jika `role=guru`, **wajib** kode valid (kalau tidak → 400, OTP tak dikirim) |
| POST | `/api/auth/register` | verifikasi OTP **lalu konsumsi kode secara atomik** |
| POST | `/api/auth/google` | guru via Google juga diminta kode |

Tambahkan middleware `kepalaOnly` meniru pola `guruOnly` di `src/middleware/auth.js`.

---

## 7. Alur Registrasi Guru (Sequence)

```
Frontend            send-otp                         register
  │ role=guru,kode ───►│ kode redeemable?
  │                    │   tidak → 400 (kode invalid/kadaluarsa/habis/dicabut)
  │                    │   ya   → kirim OTP, simpan kode di otpStore
  │◄── "OTP terkirim" ─│
  │ email + otp ───────────────────────────────────►│ verifikasi OTP
  │                                                  │ KONSUMSI kode (atomik)
  │                                                  │   gagal → 409, akun TIDAK dibuat
  │                                                  │   sukses → buat user guru
  │                                                  │   used_count++, catat redemption
  │◄──────────────── token + akun guru ──────────────│
```

Pola ini meniru validasi data diri guru yang sudah ada di `send-otp`
(`sanitizeDataDiri(..., { strict: true })`), jadi hanya menambah satu pemeriksaan.

---

## 8. Konsumsi Kode Atomik (anti race condition kuota)

Risiko: dua guru memakai sisa kuota terakhir bersamaan → keduanya lolos (over-redeem).
Solusi: **conditional update** dalam satu langkah, bukan "baca lalu tulis".

Di PostgreSQL/Supabase, dibungkus sebagai RPC `redeem_kode_guru(p_kode text)`:

```sql
create or replace function redeem_kode_guru(p_kode text)
returns uuid
language plpgsql
as $$
declare v_id uuid;
begin
  update kode_guru
     set used_count = used_count + 1
   where kode = p_kode
     and status = 'active'
     and used_count < max_uses
     and (expires_at is null or expires_at > now())
  returning id into v_id;     -- NULL bila tidak ada baris cocok
  return v_id;                 -- pemanggil: NULL → tolak, jangan buat akun guru
end;
$$;
```

Pada prototype (in-memory, single-thread Node.js), fungsi `redeem()` ditulis
**sinkron** sehingga otomatis atomik; test konkurensi membuktikan kuota tak terlampaui.

---

## 9. Pertimbangan Keamanan

| Area | Tindakan |
|------|----------|
| **Brute force kode** | charset tanpa ambigu `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, panjang ≥ 8, + rate-limit endpoint `validate-kode-guru` & `send-otp` |
| **Pembangkitan acak** | `crypto.randomInt` (CSPRNG), bukan `Math.random` |
| **Data leak** | response tidak pernah memuat hash password; daftar kode hanya untuk kepala penerbit; `validate` hanya balas `{ valid, reason }` (tanpa label/penerbit) |
| **Otorisasi** | hanya `kepala_sekolah` boleh generate/revoke/list; guru via `kepalaOnly` ditolak |
| **Over-redeem** | konsumsi atomik (poin 8) |
| **Memory leak** | tidak ada `setInterval`/timer untuk kadaluarsa — dihitung lazy; OTP store yang ada perlu cleanup (lihat catatan) |
| **Audit** | tabel `kode_guru_redemptions` mencatat kode → guru → waktu |

> **Catatan temuan pada kode lama:** `otpStore` & `resetOtpStore` di `src/routes/auth.js`
> hanya menghapus entri kadaluarsa **saat diakses**. Entri yang tak pernah diverifikasi
> akan menumpuk di memori (memory leak ringan). Saat integrasi, tambahkan pembersihan
> berkala dengan `setInterval(...).unref()` atau hapus saat lookup gagal.

---

## 10. Tahapan Implementasi

| Fase | Isi |
|------|-----|
| **0** | Migration SQL (`kode_guru`, `kode_guru_redemptions`, RPC `redeem_kode_guru`) + seed kepala sekolah |
| **1** | Endpoint kepala (generate/list/revoke/daftar guru) + middleware `kepalaOnly` |
| **2** | Wajibkan kode pada `send-otp` + `register` + `google` |
| **3** | Frontend: input "Kode Guru" di tab guru + dashboard kepala sekolah |

### Kompatibilitas mundur
Guru yang sudah ada sebelum fitur ini tidak punya jejak kode. Karena hanya satu sekolah,
mereka cukup di-*grandfather* (dianggap sah) tanpa migrasi tambahan.

---

## 11. Pemetaan ke Prototype

Prototype mandiri ([`prototype/kode-guru/`](../prototype/kode-guru/)) membuktikan inti
sistem **tanpa** menyentuh aplikasi/Supabase:

| Konsep dokumen | Berkas prototype |
|----------------|------------------|
| Model data + redeem atomik | `store.js` |
| Endpoint kepala & registrasi | `app.js` |
| Server lokal untuk uji manual | `server.js` |
| Bukti semua alur + keamanan | `prototype.test.js` |

Jalankan: `node --test prototype/kode-guru/` (lihat `prototype/kode-guru/README.md`).
