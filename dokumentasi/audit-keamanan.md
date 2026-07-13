# Audit Keamanan — KitaBelajar

> Tanggal: 2026-06-22 · Lingkup: 6 area yang diminta (SQLi, sanitasi input,
> upload Multer, IDOR, XSS konten, dependency). Status tiap temuan: ✅ aman /
> 🔧 sudah diperbaiki sesi ini / ⚠️ rekomendasi (belum diterapkan).

## Ringkasan

> **Update 2026-06-22 (sesi 2):** semua temuan utama SUDAH DIPERBAIKI & diuji
> (47/47 test lolos). Detail di bagian "Perbaikan yang diterapkan".

| # | Area | Status | Severity tertinggi |
|---|------|--------|--------------------|
| 1 | SQL / Filter Injection | 🔧 diperbaiki | Medium |
| 2 | Input Sanitization | 🔧 soal disanitasi, sisanya ✅ | Low |
| 3 | File Upload (Multer) | 🔧 magic-bytes ditambah | Medium |
| 4 | IDOR | 🔧 kode-guru, chat privat, **kelas chat/detail, materi** | **High** |
| 5 | XSS konten materi | ✅ aman di render, ⚠️ CSP (trade-off) | Medium |
| 6 | Dependency (npm audit) | 🔧 8/9 diperbaiki (`ws` high beres) | **High** (ws) |

---

## 1. SQL / Filter Injection

**✅ Aman secara umum:** seluruh akses DB lewat Supabase client (PostgREST,
parameterized). Tidak ada string SQL yang dirakit manual. RPC `redeem_kode_guru`
memakai parameter `p_kode`. Interpolasi seperti `.ilike('judul', `%${search}%`)`
dan `.eq('kode_akses', kode.toUpperCase())` mengirim nilai sebagai parameter ke
PostgREST — bukan concatenation ke SQL mentah → aman.

**🔧 DIPERBAIKI — filter injection di chat privat.**
[src/routes/chat.js:17](../src/routes/chat.js#L17) menginterpolasi `otherId`
(dari `req.params.userId`, dikontrol user) ke dalam string filter `.or()`
PostgREST tanpa validasi. Input non-UUID bisa menyuntik klausa filter.
→ Ditambahkan validasi `validator.isUUID(otherId)` di GET & POST `/private/:userId`.

**✅ Penggunaan `.or()` lain aman:** [misi.js:111](../src/routes/misi.js#L111),
[chat.js:103](../src/routes/chat.js#L103) hanya memakai nilai yang dibuat server
(tanggal / `req.user.id` dari JWT), bukan input mentah user.

**Aturan ke depan:** setiap `.or()` / `.filter()` yang memuat input user **wajib**
divalidasi/whitelist (UUID, enum, angka) sebelum dipakai.

---

## 2. Input Sanitization

**✅ Sudah disanitasi (`cleanText`, buang `< > " \``):**
- `nama` saat register & update profil ([auth.js](../src/routes/auth.js)).
- `judul`, `mapel`, `deskripsi` materi ([materi.js:45](../src/routes/materi.js#L45)).
- `label` kode guru (fitur baru, [kode-guru.js](../src/routes/kode-guru.js)).

**✅ Chat (`isi`)** tidak disanitasi di server, tapi **dienkripsi** saat disimpan
dan **di-escape saat render** (`escapeHtml(p.isi)` di
[belajar-seru.html:4643](../public/belajar-seru.html#L4643), 5425) → aman dari stored XSS.

**⚠️ Soal quiz** — `pertanyaan`, `opsi`, `jawaban` di
[soal.js:14](../src/routes/soal.js#L14) **tidak** di-`cleanText` (jawaban dienkripsi).
Hanya guru yang bisa membuat soal, dan render quiz memakai `escapeHtml`, jadi risiko
rendah. **Rekomendasi:** tetap `cleanText(pertanyaan)` sebagai defense-in-depth dan
pastikan SEMUA tempat render soal pakai `escapeHtml`.

**Catatan:** `antiJudolMiddleware` memblok kata judol/iklan di semua body request.

---

## 3. File Upload (Multer)

**✅ Yang sudah benar:**
- `memoryStorage` (tak menulis ke disk server) + batas ukuran:
  20MB materi ([materi.js:13](../src/routes/materi.js#L13)), 10MB submission
  ([quiz.js:21](../src/routes/quiz.js#L21)).
- `fileFilter` whitelist tipe (pdf/gambar/video/doc).
- File disimpan ke **Supabase Storage**, bukan dieksekusi di server Node →
  tidak ada risiko eksekusi server-side. `contentType` dipaksa saat upload.

**⚠️ Kelemahan — hanya cek `file.mimetype`** (Content-Type dari klien, **bisa
dipalsukan**). Tidak ada verifikasi *magic bytes* / cross-check ekstensi.
- `ext` diambil dari `originalname.split('.').pop()` (nama file dari user) lalu
  dipakai di path storage ([materi.js:23](../src/routes/materi.js#L23)).

**Risiko:** medium-rendah (file disajikan dengan contentType gambar/pdf, jadi
browser tak mengeksekusinya sebagai HTML/script).

**🔧 SUDAH DIPERBAIKI (sesi 2):** dibuat [src/utils/fileType.js](../src/utils/fileType.js)
(`sniffMime`/`validateUpload`, tanpa dependency baru). Upload materi & submission kini:
1. Diverifikasi *magic bytes* — isi file harus benar-benar termasuk allowlist.
2. Ekstensi & `contentType` diambil dari MIME **terdeteksi**, bukan nama/klaim klien.
3. Tetap pakai batas ukuran + bucket read-only publik.

---

## 4. IDOR (Insecure Direct Object Reference)

**🔧/✅ Sudah aman:**
- Endpoint kode-guru di-scope `dibuat_oleh = req.user.id` (kepala A tak bisa
  lihat/cabut kode kepala B) — [kode-guru.js](../src/routes/kode-guru.js).
- Chat privat: `.or()` membatasi ke percakapan peserta + kini divalidasi UUID.

**🔧 SUDAH DIPERBAIKI (sesi 2)** — guard `bolehAksesKelas()` ditambahkan; tabel di
bawah adalah temuan awal yang kini sudah ditutup:

| Endpoint | Masalah (sebelum) | Severity |
|----------|---------|----------|
| `GET /api/kelas/:id/chat` ([kelas.js:132](../src/routes/kelas.js#L132)) | **Siapa pun** yang login bisa baca chat kelas (sudah didekripsi) milik kelas mana pun, cukup ganti `:id`. | **High** |
| `POST /api/kelas/:id/chat` ([kelas.js:148](../src/routes/kelas.js#L148)) | Siapa pun bisa **mengirim** pesan ke kelas mana pun. | High |
| `GET /api/kelas/:id` ([kelas.js:78](../src/routes/kelas.js#L78)) | Siapa pun bisa lihat detail kelas + **daftar lengkap murid** kelas mana pun. | Medium |
| `GET /api/materi/:id` ([materi.js:209](../src/routes/materi.js#L209)) | Murid bisa baca materi apa pun by id, termasuk **draft** & materi kelas lain. | Medium |

**Rekomendasi perbaikan** — tambahkan helper keanggotaan dan jaga endpoint:
```js
// Guru pemilik kelas ATAU murid terdaftar di kelas tsb.
async function bolehAksesKelas(userId, role, kelasId) {
  if (role === 'guru') {
    const { data } = await supabase.from('kelas')
      .select('id').eq('id', kelasId).eq('guru_id', userId).maybeSingle();
    return !!data;
  }
  const { data } = await supabase.from('kelas_murid')
    .select('kelas_id').eq('kelas_id', kelasId).eq('murid_id', userId).maybeSingle();
  return !!data;
}
// di awal handler chat/detail: if (!(await bolehAksesKelas(...))) return res.status(403)...
```
Untuk `GET /api/materi/:id`: untuk murid, tolak bila `status !== 'aktif'` dan/atau
materi bukan dari kelas yang ia ikuti.

> ✅ Diterapkan & lolos regresi test (47/47). Perlu verifikasi manual di app
> nyata untuk memastikan flow guru/murid tetap mulus.

---

## 5. XSS via Konten Materi

**✅ Aman di sisi render.** `renderMarkdown`
([belajar-seru.html:2422](../public/belajar-seru.html#L2422)) **meng-escape HTML
dulu** (`escapeHtml`) lalu menambah tag markdown — sehingga `<script>`,
`<img onerror>` dari konten guru menjadi teks inert. Link markdown hanya cocok
`https?://` (tak bisa `javascript:`). `escapeHtml`
([:4651](../public/belajar-seru.html#L4651)) menutup `& < > " ' \``.

**⚠️ Kelemahan residual — CSP longgar.** [security.js:82](../src/middleware/security.js#L82)
mengizinkan `'unsafe-inline'` + `'unsafe-eval'` pada `scriptSrc` (diperlukan oleh
event handler inline `onclick` di HTML). Ini melemahkan pertahanan berlapis bila
suatu saat ada celah injeksi DOM.
**Rekomendasi (jangka panjang):** pindah ke CSP berbasis *nonce* + hapus inline
handler, atau bila konten pernah dirender sebagai HTML mentah, sanitasi dengan
DOMPurify. Saat ini render escape-first sudah memadai.

---

## 6. Dependency Vulnerabilities (`npm audit`)

`npm audit` per 2026-06-22 — **9 kerentanan (1 high, 8 moderate):**

| Paket | Severity | Masalah | Lewat |
|-------|----------|---------|-------|
| `ws` | **High** | Uninitialized memory disclosure + DoS | socket.io / engine.io |
| `qs` | Moderate | DoS `qs.stringify` | express / body-parser |
| `ip-address` | Moderate | XSS pada method HTML | express-rate-limit |
| `uuid` | Moderate | Buffer bounds (v3/v5/v6) | langsung |

**Rekomendasi:**
- Jalankan `npm audit fix` (memperbaiki `ws`, `qs`, `ip-address` tanpa breaking).
- `uuid` butuh upgrade mayor (breaking) — proyek hanya pakai `uuidv4()` yang
  tak terdampak; evaluasi sebelum bump.
- Setelah fix: `npm test` lalu redeploy. Jadwalkan audit berkala.

> Tidak dijalankan otomatis karena `npm audit fix` mengubah `package-lock.json`
> dan menyentuh deploy (Railway) — sebaiknya dijalankan & diuji oleh tim.

---

## Perbaikan yang diterapkan

**Sesi 1:**
| Berkas | Perubahan |
|--------|-----------|
| [src/routes/chat.js](../src/routes/chat.js) | Validasi UUID `otherId` (cegah filter injection `.or()`) di GET & POST chat privat |
| [src/server.js](../src/server.js) | `redactSensitive()` pada `error_logs` → password/OTP/token tak lagi tersimpan plaintext (bocor via `/api/error-logs`) |

**Sesi 2:**
| Berkas | Perubahan |
|--------|-----------|
| [src/routes/kelas.js](../src/routes/kelas.js) | Helper `bolehAksesKelas()` + guard pada `GET /:id`, `GET /:id/chat`, `POST /:id/chat` → hanya anggota kelas (IDOR **High** ditutup) |
| [src/routes/materi.js](../src/routes/materi.js) | `GET /:id`: murid hanya materi `aktif` (draft tak bocor), guru hanya materi miliknya. Upload divalidasi magic-bytes; ekstensi & contentType dari MIME terdeteksi |
| [src/routes/quiz.js](../src/routes/quiz.js) | Upload submission divalidasi magic-bytes; `GET /hasil/cek` pakai `order+limit(1)` (perbaiki error "multiple rows") |
| [src/utils/fileType.js](../src/utils/fileType.js) | **Baru** — `sniffMime()`/`validateUpload()` deteksi tipe dari isi file (anti-spoof), + `test/fileType.test.js` |
| [src/routes/soal.js](../src/routes/soal.js) | `cleanText` pada `pertanyaan`, `opsi`, `mapel` |
| `package-lock.json` | `npm audit fix` → `ws` (high), `qs`, `ip-address` ter-patch |

---

## Audit lapis kedua (analisis lanjutan)

Pemeriksaan kedua di luar 6 area awal. **Yang sudah aman:** zepquiz live tidak
mengirim `jawaban` ke pemain ([zepquiz.js:696](../src/socket/zepquiz.js#L696)),
enkripsi AES-256-GCM benar (IV acak + authTag, key tervalidasi), orangtua
memverifikasi relasi anak (tak ada IDOR).

**Temuan & status:**

| # | Temuan | Severity | Status |
|---|--------|----------|--------|
| 1 | `GET /api/soal/quiz` mengirim kolom `jawaban` ke **murid** | Low* | ↩️ **Di-REVERT** — endpoint ini hanya dipakai game kasual zep-world yang cek jawaban di klien; strip membuat semua jawaban murid login dianggap salah. *Severity turun: bukan jalur ujian bernilai. |
| 2 | Endpoint AI tanpa auth (`/api/ai/chat`, `/vision`, `/tts/kokoro`) → abuse kuota Groq/HF | **High** | 🔧 Sebagian — **vision** wajib auth (aman, hanya belajar-seru); **chat** di-REVERT ke tanpa-auth (NPC zep-world kirim tanpa token) + tetap rate-limit; **TTS** rate-limit |
| 3 | `/api/proxy/fetch` SSRF: blocklist tanpa `169.254.x`, cek string hostname (rawan DNS-rebinding) | Medium | 🔧 Diperbaiki — blocklist diperluas + resolusi DNS cek IP + rate-limit |
| 4 | Guru bisa tempel materi/quiz ke `kelas_id` milik guru lain (mass-assignment) | Medium | 🔧 Diperbaiki — verifikasi `kelas.guru_id === user.id` |
| 5 | `POST /api/log-error` tanpa auth (spam `error_logs`) | Low | ⚠️ Terbuka |
| 6 | JWT 30 hari tanpa revocation/logout | Low-Med | ⚠️ Terbuka (hardening) |

> **Catatan perilaku (#2, setelah revert):** hanya `/api/ai/vision` yang wajib login
> (hanya dipakai chatbot guru di belajar-seru yang selalu kirim token → aman).
> `/api/ai/chat` SENGAJA dibiarkan tanpa-auth karena NPC chatbot zep-world
> memanggilnya tanpa token (mode anonim didukung) — kalau diwajibkan auth, NPC mati
> untuk semua orang. Abuse `/api/ai/chat` ditahan `aiLimiter` (15/menit/IP). TTS pun
> tanpa-auth + rate-limit. **Pelajaran:** verifikasi pemakai endpoint di SEMUA
> frontend (belajar-seru + zep-world) sebelum menambah auth.

**Berkas sesi 3:**
[soal.js](../src/routes/soal.js) (strip jawaban + cek kelas quiz),
[server.js](../src/server.js) (auth AI + `isPrivateIp`/`hostnameAman` SSRF + rate-limit),
[materi.js](../src/routes/materi.js) (`guruMemilikiKelas`).

## Tindak lanjut yang masih terbuka

1. **`uuid`** moderate: butuh upgrade mayor (breaking) — proyek hanya pakai `uuidv4()`
   yang **tidak terdampak**; aman ditunda.
2. **CSP `unsafe-inline`/`unsafe-eval`**: trade-off untuk inline `onclick`.
   Jangka panjang → CSP berbasis nonce + hapus inline handler.
3. **`POST /api/log-error` tanpa auth** (lapis kedua #5): tambahkan rate-limit.
4. **JWT 30 hari** (lapis kedua #6): pertimbangkan expiry lebih pendek + refresh token.
5. **Konfigurasi eksternal (bukan kode):** lihat bagian di bawah.

## Catatan: error runtime dari log Railway (konfigurasi, bukan bug kode)

- **Brevo 401 "unrecognised IP 34.x"** → IP server Railway belum diizinkan di akun
  Brevo. Solusi: di Brevo → *Security → Authorised IPs*, tambahkan IP tsb. atau
  matikan pembatasan IP. (Railway bisa ganti IP saat redeploy — pertimbangkan SMTP
  relay tanpa IP-lock.)
- **Groq "Invalid API Key" (primary)** → `GROQ_API_KEY` primary tidak valid (perlu
  rotasi/ganti). Fallback `backup-1` sudah bekerja.
- **Groq "Request too large `qwen/qwen3-32b` TPM 6000"** → model lama TPM kecil.
  Chat & generate soal kini SERAGAM `openai/gpt-oss-120b` (production, 250K TPM,
  output $0.60/1M). Qwen3.6-27b ditinggalkan (status preview + output $3/1M).
- **HF TTS "fetch failed"** → endpoint HuggingFace Inference untuk `mms-tts-ind`
  gagal/diubah. Frontend sudah fallback otomatis; pertimbangkan provider TTS lain.
