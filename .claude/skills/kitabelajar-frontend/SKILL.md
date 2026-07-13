---
name: kitabelajar-frontend
description: Konvensi & arsitektur frontend KitaBelajar (SPA satu file HTML + CSS + JS terbagi). Baca skill ini SEBELUM mengubah UI di public/ — cara kerja page system, helper (toast, api, showPage), lokasi file, dan cache-busting versi asset. Trigger: edit apa pun di public/belajar-seru.html, public/css/, atau public/js/.
---

# Frontend KitaBelajar — Konvensi Wajib

KitaBelajar adalah LMS. Frontend murid/guru/orangtua adalah **Single Page App** di
`public/belajar-seru.html` — semua "halaman" ada di satu file HTML, ditampilkan/disembunyikan
lewat class `.page.active`. Halaman lain (`kita-latihan.html`, `kita-materi.html`,
`belajar-game-v6.html`, `zep-world.html`) adalah file terpisah.

## Peta File
| File | Isi |
|------|-----|
| `public/belajar-seru.html` | Markup semua page (landing, login, register, dashboard murid/guru/orangtua, leaderboard, Kita Quiz). ~2500 baris. |
| `public/css/belajar-seru.css` | Seluruh style app utama. Variabel warna di `:root`. Media query mobile di `@media (max-width:640px)` & `(max-width:400px)`. |
| `public/js/app-config.js` | Config + error logger. Dimuat paling awal. |
| `public/js/app-core.js` | Auth, page system, helper (`toast`, `api`, `showPage`, `goHome`, `isValidEmail`), dashboard, load handler `window.addEventListener('load', ...)`. |
| `public/js/app-extra1.js`, `app-extra2.js` | Fitur tambahan (kelas, materi, quiz, dst). |

## Page System
- Tampilkan halaman: `showPage('page-<nama>')` — meng-toggle `.active` & scroll ke atas.
- `goHome()` — klik logo navbar; arahkan ke dashboard sesuai `currentUser.role`, atau landing kalau belum login.
- Jangan pakai `location.href` untuk pindah antar page di dalam `belajar-seru.html`; itu hanya untuk file HTML terpisah.

## Helper yang WAJIB dipakai (jangan bikin ulang)
- `toast(msg, type)` — notifikasi. `type`: `'success' | 'error' | 'info' | ''`. Muncul dari **atas** layar.
- `api(method, path, body)` — fetch ke backend, auto-attach Bearer token, auto-handle 401/403.
- `showLoading(bool, msg)` — spinner overlay.
- `isValidEmail(email)` — validasi format email SEBELUM submit login/register.
- Escape user-generated content dengan helper sanitize yang ada (lihat `src/utils/sanitize.js` & pola `escapeHtml`) — proyek ini pernah kena stored-XSS.

## Cache-busting (PENTING)
Setiap kali mengubah `belajar-seru.css` atau file `js/`, **naikkan nomor versi** di query string
`<link ...css?v=N>` / `<script ...js?v=N>` pada `belajar-seru.html`. Kalau tidak, browser user
memuat versi lama dari cache dan perubahan "tidak muncul".

## Aturan Style
- Warna lewat variabel CSS (`var(--orange)`, `var(--blue)`, dst) — jangan hardcode hex baru sembarangan.
- Font: `Nunito` (body) & `Fredoka One` (heading).
- Navbar punya `min-height: 76px` supaya konsisten di semua page — jangan bikin navbar dengan tinggi berbeda.
- Prinsip visual/anti-"AI look": lihat skill **kitabelajar-design**.

## Verifikasi perubahan
Cara menjalankan lokal ada di `dokumentasi/menjalankan-lokal.md`. Untuk cek cepat sintaks JS:
`node --check public/js/app-core.js`. Test backend: `npm test`.
