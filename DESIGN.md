# Design System — KitaBelajar

<!-- impeccable:design-schema 1 -->

## Direction

**Visual world:** Rapor sekolah Indonesia — kertas putih bersih, border merah sebagai aksen otoritas, angka besar tegas, garis tabel sebagai struktur. Bukan card-grid-dengan-gradient. Objek yang setiap murid dan guru Indonesia kenal betul.

**Seed:** bc3f8915 · direction index 5 · mode operate

**Refuses:** card grid of equal-sized icon+heading+text as primary structure; gradient text; hero-metric template (big number + decorative backdrop); colored border-left >1px on list items.

## Palette

```
--rapor-white:   #FFFFFF   /* ground — kertas rapor */
--rapor-red:     #B91C1C   /* aksen utama — border merah rapor, cap stempel */
--rapor-red-bg:  #FEF2F2   /* latar merah muda tipis */
--rapor-ink:     #1E293B   /* teks utama — tinta rapor */
--rapor-rule:    #E2E8F0   /* garis tabel, divider */
--rapor-muted:   #64748B   /* label sekunder, keterangan */
--rapor-stamp:   #FF6B35   /* cap/stempel orange — brand accent, XP fill */
--rapor-green:   #15803D   /* nilai bagus, selesai, lulus */
--rapor-bg:      #F8FAFC   /* background halaman — kertas sedikit off-white */
```

Warna yang dipertahankan dari brand: orange (`--rapor-stamp`) sebagai XP/progress accent. Merah (`--rapor-red`) menggantikan peran merah sebelumnya tapi lebih dark dan authoritative.

## Typography

- **Heading/nilai:** `Fredoka One` — angka XP, level, nama kelas (seperti angka nilai besar di rapor)
- **Body/label:** `Nunito` — semua teks konten, label, tombol
- **Data/kode:** `monospace` — kode kelas, kode guru

Scale: `11px label` → `13px body` → `15px body-lg` → `18px subheading` → `24px heading` → `32px display`

## Component Language

### Surface & Ground
- Background: `--rapor-bg` (#F8FAFC) — bukan cream, bukan putih murni
- Cards: `background: white; border: 1px solid var(--rapor-rule)` — tidak ada shadow berat, tidak ada radius >16px untuk konten utama
- Section break: `border-top: 2px solid var(--rapor-red)` di heading section penting

### Navbar
- Background: white, `border-bottom: 2px solid var(--rapor-red)` — seperti header rapor dengan garis merah
- No shadow, no blur

### Hero / Welcome Banner
- Background: `--rapor-red` dengan pola garis diagonal tipis (bukan gradient blobby)
- Layout 2-kolom: teks kiri, kotak "nilai" kanan (XP+level dalam border box)
- Avatar dalam lingkaran dengan border merah

### Stats Box (XP/Level)
- Kotak putih dengan border `2px solid var(--rapor-red)`, radius 8px
- Angka besar `Fredoka One`, label kecil `Nunito uppercase tracked`
- Seperti kolom nilai di rapor

### Kelas List
- **Table-like rows** bukan card grid — setiap kelas adalah satu baris dengan: emoji mapel, nama kelas, guru, jumlah materi, badge status
- Hover: background `--rapor-red-bg`
- Separator: `border-bottom: 1px solid var(--rapor-rule)`

### Tab Bar
- `border-bottom: 1px solid var(--rapor-rule)` sebagai container
- Active: `color: var(--rapor-red); border-bottom: 2px solid var(--rapor-red)` — seperti garis bawah pen merah guru
- Tidak ada pill background di active state

### Buttons
- Primary: `background: var(--rapor-red); color: white` — tegas, tidak ada gradient
- Secondary: `border: 1.5px solid var(--rapor-rule); background: white`
- Radius: `8px` — bukan pill (pill hanya untuk badge/status)

### Badges / Status Pills
- Selesai: `background: #DCFCE7; color: var(--rapor-green)` — cap hijau "LULUS"
- Aktif: `background: #FEF2F2; color: var(--rapor-red)` — perhatian
- Neutral: `background: var(--rapor-bg); color: var(--rapor-muted)`

### Dark Mode
- Background: `#0F172A` (slate-900 — tinta malam)
- Surface: `#1E293B` (slate-800)
- Border: `#334155` (slate-700)
- Accent tetap `--rapor-red` tapi lebih terang: `#EF4444`

## Motion

Satu authored moment per transisi:
- Tab switch: konten fade-in dari bawah 8px, 180ms ease-out
- Kelas row hover: background slide dari kiri, 120ms
- XP fill: animasi width 600ms ease-out saat load
- Toast: slide dari atas 300ms cubic-bezier(0.22,1,0.36,1)

Tidak ada entrance animation pada setiap section — hanya satu signature transition.

## Rules

1. Gradient hanya pada hero banner kelas (bukan di card konten, bukan di navbar)
2. Border-left >1px dilarang pada list item — gunakan background hover sebagai gantinya
3. Shadow maximum: `0 1px 3px rgba(0,0,0,0.08)` — tidak ada purple glow, tidak ada colored shadow
4. Radius maksimum: 16px untuk card utama, 8px untuk tombol/input
5. Angka XP/level selalu `Fredoka One`, tidak pernah dimasukkan dalam gradient text
6. Setiap section heading punya pembeda — salah satu dari: border-top merah, uppercase label, atau scale contrast — bukan tracked uppercase eyebrow di mana-mana
