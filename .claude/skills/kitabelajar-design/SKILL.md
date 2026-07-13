---
name: kitabelajar-design
description: Prinsip desain UI/UX KitaBelajar untuk menghilangkan kesan "dibuat AI" dan menjaga konsistensi. Baca SEBELUM membuat/mengubah tampilan (landing, login, dashboard, cards, tombol CTA, animasi). Trigger: styling komponen, memilih warna/gradient/shadow, menambah emoji sebagai ikon, membuat card/CTA, atau menggarap item di dokumentasi/progres-perbaikan.md.
---

# Prinsip Desain KitaBelajar

Tujuan: tampilan terasa **dirancang manusia**, dinamis, dan konsisten — bukan template generik.
Feedback pemilik proyek menandai beberapa "AI tell" yang harus dihindari.

## Yang HARUS dihindari ("AI look")
1. **Emoji sebagai ikon fungsional.** Emoji boleh untuk aksen/keceriaan (target audiens anak), TAPI
   jangan jadikan satu-satunya ikon untuk elemen penting. Untuk ikon UI nyata, pakai SVG inline.
   Kurangi kepadatan emoji, jangan setiap elemen diberi emoji.
2. **Gradient + drop-shadow di SETIAP CTA.** Batasi gradient hanya untuk 1 aksi primer per layar.
   Tombol sekunder cukup flat/outline. Hindari box-shadow berwarna tebal di semua tombol.
3. **Card di mana-mana.** Jangan bungkus segala sesuatu dalam card ber-shadow. Gunakan whitespace,
   pemisah tipis, atau grouping. Card dipakai kalau memang butuh batas visual.
4. **Border-top berwarna tebal di card** (mis. `border-top: 5px solid`) — pola template khas AI.
   Sudah dihapus dari feature-card landing; jangan ditambahkan lagi.
5. **Layout statis/simetris sempurna.** Bikin lebih dinamis: variasi ukuran, alignment, ritme.

## Konsistensi & branding
- **Jangan ulang kata "KitaBelajar" berlebihan.** Cukup di logo navbar. Hapus label "KitaBelajar"
  yang menempel di atas CTA seperti "Kita Latihan!"/"AyoBelajar!" dan di dashboard.
- **Navbar konsisten** tinggi & isinya di semua page (`min-height: 76px`). Logo navbar clickable → beranda.
- **Toast/alert dari atas layar**, bukan dari bawah.
- **Satu tombol "Masuk"** untuk semua peran (pola SSO seperti LMS Tel-U): user login dengan
  kredensial apa pun, backend menyalurkan ke role yang benar. Hindari tombol terpisah "Portal Guru" /
  "Masuk sebagai Murid" di landing.

## Form & validasi
- Validasi input di sisi klien SEBELUM submit: email harus format valid (`isValidEmail`), password
  minimal 8 karakter, beri pesan `toast(..., 'error')` yang jelas & ramah.
- Field kelas saat registrasi murid tidak boleh free-text yang bikin data berantakan pada skala besar
  (mis. ribuan murid di "12A"). Pertimbangkan dropdown/gabung-via-kode guru, bukan ketik bebas.

## Animasi
- Hindari easing kaku (`linear`, `ease` default) untuk gerakan UI. Pakai kurva halus, mis.
  `cubic-bezier(0.22, 1, 0.36, 1)`, durasi 0.2–0.35s. Hormati `prefers-reduced-motion`.

## Leaderboard & misi (pola konten)
- Kalau podium top-3 sudah ditampilkan, **jangan** ulangi #1–3 di list peringkat bawahnya (mulai dari #4).
- Misi: kategorikan/filter (harian/mingguan/achievement) supaya user memilih apa yang ditampilkan,
  bukan menumpuk semuanya sekaligus.

## Palet warna (di `:root`)
`--yellow #FFD93D · --orange #FF6B35 · --green #6BCB77 · --blue #4D96FF · --pink #FF6B9D ·
--purple #C77DFF · --red #FF4757`. Background `--bg #FFF9F0`. Gunakan variabel ini, jangan hex acak.

Daftar lengkap backlog perbaikan & statusnya ada di `dokumentasi/progres-perbaikan.md`.
