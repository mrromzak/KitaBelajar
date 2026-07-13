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
