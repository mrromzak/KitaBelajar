-- ============================================================
-- MIGRATION: Badge Refactor — Cleanup duplicates + re-seed
-- Execute after all previous badge migrations
-- ============================================================

-- ── 1. Hapus badge duplikat / obsolete ──────────────────────
-- Pertama Kali (merged into Latihan Perdana)
-- Nilai Sempurna (duplicate of Sempurna)
-- Kutu Buku duplicate (b400...002, keep b200...015)
-- Pembaca Muda (not in new schema)
DELETE FROM misi_template      WHERE reward_badge_id IN (
  'b2000000-0000-0000-0000-000000000008',
  'b3000000-0000-0000-0000-000000000004',
  'b4000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000014'
);
DELETE FROM murid_badges       WHERE badge_id IN (
  'b2000000-0000-0000-0000-000000000008',
  'b3000000-0000-0000-0000-000000000004',
  'b4000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000014'
);
DELETE FROM badges             WHERE id IN (
  'b2000000-0000-0000-0000-000000000008',
  'b3000000-0000-0000-0000-000000000004',
  'b4000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000014'
);

-- ── 2. Update deskripsi badge yang kriterianya berubah ──────
-- ONBOARDING
UPDATE badges SET deskripsi = 'Selesaikan 5 latihan/quiz dengan skor ≥ 60%' WHERE id = 'b1000000-0000-0000-0000-000000000001';
-- STREAK / KONSISTENSI
UPDATE badges SET deskripsi = 'Login & belajar 3 hari berturut-turut' WHERE id = 'b2000000-0000-0000-0000-000000000005';
UPDATE badges SET nama = 'Bulan Penuh', deskripsi = 'Streak 30 hari berturut-turut' WHERE id = 'b1000000-0000-0000-0000-000000000003';
-- VOLUME
UPDATE badges SET deskripsi = 'Selesaikan 100 soal latihan total' WHERE id = 'b3000000-0000-0000-0000-000000000003';
UPDATE badges SET deskripsi = 'Selesaikan 1 bab/modul penuh materi' WHERE id = 'b2000000-0000-0000-0000-000000000016';
UPDATE badges SET deskripsi = 'Selesaikan seluruh modul dalam 1 mata pelajaran' WHERE id = 'b2000000-0000-0000-0000-000000000003';
UPDATE badges SET deskripsi = 'Kerjakan latihan di 3 mapel berbeda dalam 1 minggu' WHERE id = 'b2000000-0000-0000-0000-000000000020';
UPDATE badges SET deskripsi = 'Selesaikan minimal 1 modul di setiap mapel yang tersedia' WHERE id = 'b2000000-0000-0000-0000-000000000025';
-- AKURASI
UPDATE badges SET deskripsi = 'Raih skor 100% di 1 quiz' WHERE id = 'b2000000-0000-0000-0000-000000000009';
UPDATE badges SET deskripsi = 'Raih skor 100% di 5 quiz berbeda' WHERE id = 'b1000000-0000-0000-0000-000000000005';
UPDATE badges SET deskripsi = 'Jawab 10 soal berturut-turut dengan benar dalam 1 sesi' WHERE id = 'b1000000-0000-0000-0000-000000000006';
-- KECEPATAN
UPDATE badges SET deskripsi = 'Selesaikan quiz dalam waktu ≤ 50% median' WHERE id = 'b2000000-0000-0000-0000-000000000018';
-- MATERI
UPDATE badges SET deskripsi = 'Baca 10 materi/bab secara penuh' WHERE id = 'b2000000-0000-0000-0000-000000000015';
UPDATE badges SET deskripsi = 'Buka AyoBelajar untuk pertama kali' WHERE id = 'b4000000-0000-0000-0000-000000000001';
UPDATE badges SET deskripsi = 'Baca materi di 5 hari berbeda dalam 14 hari' WHERE id = 'b4000000-0000-0000-0000-000000000003';
UPDATE badges SET deskripsi = 'Buka materi di minimal 3 mapel berbeda' WHERE id = 'b1000000-0000-0000-0000-000000000010';
UPDATE badges SET deskripsi = 'Skor rata-rata ≥ 85% dalam 1 topik (min 5 latihan)' WHERE id = 'b2000000-0000-0000-0000-000000000010';
-- XP
UPDATE badges SET deskripsi = 'Kumpulkan total 1.000 XP' WHERE id = 'b2000000-0000-0000-0000-000000000022';
UPDATE badges SET deskripsi = 'Kumpulkan total 100.000 XP' WHERE id = 'b2000000-0000-0000-0000-000000000023';
-- UNIK
UPDATE badges SET deskripsi = 'Kerjakan 20 quiz dalam 1 minggu' WHERE id = 'b2000000-0000-0000-0000-000000000006';
UPDATE badges SET deskripsi = 'Kerjakan total 100 quiz' WHERE id = 'b2000000-0000-0000-0000-000000000007';
UPDATE badges SET deskripsi = 'Gagal remedial 3x lalu lulus di topik yang sama' WHERE id = 'b2000000-0000-0000-0000-000000000002';
UPDATE badges SET deskripsi = 'Selesaikan latihan pertama di tingkat pemula' WHERE id = 'b2000000-0000-0000-0000-000000000001';
UPDATE badges SET deskripsi = 'Akses aplikasi minimal 4 hari berbeda dalam 7 hari' WHERE id = 'b1000000-0000-0000-0000-000000000008';
UPDATE badges SET deskripsi = 'Total waktu belajar (materi + latihan) mencapai 20 jam' WHERE id = 'b1000000-0000-0000-0000-000000000002';
UPDATE badges SET deskripsi = 'Kerjakan quiz 60 hari berturut-turut' WHERE id = 'b2000000-0000-0000-0000-000000000019';
UPDATE badges SET deskripsi = 'Min 1 latihan tiap hari, 5 hari berbeda dalam 7 hari' WHERE id = 'b3000000-0000-0000-0000-000000000002';
UPDATE badges SET deskripsi = 'Streak putus >3 hari lalu streak baru ≥3 hari' WHERE id = 'b2000000-0000-0000-0000-000000000024';

-- ── 3. Insert badge baru yang belum ada di DB ───────────────
-- Pembaca Materi (b400...004)
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b4000000-0000-0000-0000-000000000004', 'Pembaca Materi', 'Baca materi di 5 hari berbeda dalam 14 hari terakhir', '📖', 'misi')
ON CONFLICT (id) DO NOTHING;

-- Pemburu Ilmu → overwrite icon & deskripsi (sebelumnya: buka pertama kali)
UPDATE badges SET icon = '⏱️' WHERE id = 'b4000000-0000-0000-0000-000000000001';

-- ── 4. Insert misi_template untuk badge achievement baru ────
INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES
  -- PEMBACA MATERI
  ('Pembaca Materi', 'Baca materi di 5 hari berbeda', 'achievement', 'belajar_count', 5, 150, 'b4000000-0000-0000-0000-000000000004', '📖', 35)
ON CONFLICT DO NOTHING;
