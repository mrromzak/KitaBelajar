# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Murid SD, SMP, dan SMA (usia ~7–18) yang belajar lewat kelas online yang dibuat guru mereka. Mengakses dari HP maupun laptop secara seimbang.

**Secondary:** Guru SD/SMP/SMA yang membuat kelas, mengelola materi, soal, kuis, dan memantau perkembangan murid.

**Tertiary:** Orang tua (memantau aktivitas belajar anak) dan Kepala Sekolah (melihat data seluruh sekolah via portal terpisah).

## Product Purpose

KitaBelajar adalah platform LMS all-in-one untuk sekolah Indonesia yang menggabungkan kelas online, chat, materi, kuis, dan mini-game edukatif dalam satu tempat. Murid belajar sambil mendapatkan XP, naik level, mengumpulkan badge, dan bersaing di leaderboard. Guru mendapatkan analitik otomatis dan semua tools mengajar tanpa perlu berpindah platform.

Sukses = murid aktif login setiap hari, menyelesaikan materi, dan guru bisa memantau progres dengan mudah.

## Positioning

All-in-one LMS dengan elemen gamifikasi penuh (XP, level, badge, leaderboard, quiz kilat, KitaQuiz multiplayer, dan 15+ mini game) yang tidak ditemukan di Google Classroom atau platform LMS standar lain. Satu-satunya platform yang menggabungkan fitur belajar serius dengan pengalaman game.

## Operating Context

- Murid menggunakan dari HP dan laptop, sering dalam kondisi koneksi terbatas
- Guru membuat konten (materi markdown, soal bank, kuis terjadwal) dari laptop
- Kelas berjalan secara async (materi + chat) dan sync (video meeting, KitaQuiz live)
- XP diberikan otomatis saat murid membaca materi, mengerjakan kuis, dan menyelesaikan misi harian
- Guru mendapat sinyal analitik per murid (tren nilai, ketepatan tugas, aktivitas login)

## Capabilities and Constraints

- Stack: Node.js/Express, Supabase (PostgreSQL), Socket.io, vanilla JS + CSS (no framework)
- Single-page app (SPA) dengan show/hide div, bukan routing library
- File aset: `/assets/maskot-icon.png`, `/assets/maskot.png`, `/assets/badge/*.png`
- Dark mode: class `body.dark-mode`, persisted di `localStorage('kb_dark_mode')`
- Role-based: `murid`, `guru`, `orangtua`, `kepala_sekolah`
- PWA dengan service worker

## Brand Commitments

- **Nama:** KitaBelajar — tidak berubah
- **Primary color:** Orange (`#FF6B35` existing, dapat disesuaikan tonnya)
- **Maskot:** File `maskot-icon.png` dan `maskot.png` dipakai di seluruh app
- **Heading font:** Fredoka One (sudah di-load dari Google Fonts)
- **Body font:** Nunito (sudah di-load)
- **Tone:** Clean & friendly — bersih dan profesional tapi tetap ramah dan tidak kaku

## Evidence on Hand

- Codebase lengkap di `frontend/public/`
- CSS utama: `frontend/public/css/belajar-seru.css` (2600+ baris)
- 400+ badge PNG tersedia di `/assets/badge/`
- Tidak ada user research formal, testimonial, atau analytics data yang tersedia

## Product Principles

1. **Belajar harus terasa maju** — setiap interaksi memberi feedback progres (XP, badge, streak) agar murid tahu usahanya dihargai
2. **Guru tidak boleh kewalahan** — fitur teacher harus bisa dioperasikan dengan cepat, tanpa setup rumit
3. **Satu pintu, semua ada** — murid tidak perlu buka 3 app berbeda; semua materi, kuis, chat, dan game ada di satu tempat
4. **Mobile bukan second-class** — desain harus nyaman di layar 360px, bukan sekedar "responsif"
5. **Bersih dulu, seru kemarin** — visual harus clean dan mudah dibaca sebelum diberi warna dan animasi

## Accessibility & Inclusion

- Teks harus terbaca di layar outdoor (kontras minimal WCAG AA)
- Animasi harus menghormati `prefers-reduced-motion`
- Bahasa Indonesia seluruhnya (tidak ada konten dalam bahasa Inggris)
