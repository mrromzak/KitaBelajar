-- ============================================================
-- MIGRATION: Misi Kita Latihan + AyoBelajar
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Kolom latihan_count & belajar_count di tabel users ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latihan_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS belajar_count int DEFAULT 0;

-- ── 2. Badge untuk Kita Latihan ────────────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b3000000-0000-0000-0000-000000000001', 'Latihan Perdana',   'Selesaikan sesi Kita Latihan pertamamu',  '🚀', 'misi'),
  ('b3000000-0000-0000-0000-000000000002', 'Rajin Latihan',     'Selesaikan 10 sesi Kita Latihan',         '💪', 'misi'),
  ('b3000000-0000-0000-0000-000000000003', 'Spartan Latihan',   'Selesaikan 50 sesi Kita Latihan',         '🛡️', 'misi')
ON CONFLICT (id) DO NOTHING;

-- ── 3. Badge untuk AyoBelajar ──────────────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b4000000-0000-0000-0000-000000000001', 'Pemburu Ilmu',      'Buka AyoBelajar untuk pertama kali',      '📚', 'misi'),
  ('b4000000-0000-0000-0000-000000000002', 'Kutu Buku',         'Buka AyoBelajar 7 hari berturut-turut',   '🔖', 'misi'),
  ('b4000000-0000-0000-0000-000000000003', 'Penjelajah Materi', 'Buka AyoBelajar 30 kali',                 '🌍', 'misi')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Misi template Kita Latihan ──────────────────────────
INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES
  -- HARIAN
  ('Selesaikan 1 Latihan',   'Kerjakan 1 sesi Kita Latihan hari ini',     'harian',      'latihan_count', 1,   40,  NULL,                                       '🚀', 4),
  ('Selesaikan 3 Latihan',   'Kerjakan 3 sesi Kita Latihan hari ini',     'harian',      'latihan_count', 3,   120, NULL,                                       '🔥', 5),
  -- MINGGUAN
  ('5 Latihan Minggu Ini',   'Selesaikan 5 sesi Kita Latihan minggu ini', 'mingguan',    'latihan_count', 5,   200, NULL,                                       '💪', 4),
  -- ACHIEVEMENT
  ('Latihan Pertama',        'Selesaikan sesi Kita Latihan pertamamu',    'achievement', 'latihan_count', 1,   50,  'b3000000-0000-0000-0000-000000000001',     '🚀', 30),
  ('10 Sesi Latihan',        'Selesaikan total 10 sesi Kita Latihan',     'achievement', 'latihan_count', 10,  200, 'b3000000-0000-0000-0000-000000000002',     '💪', 31),
  ('50 Sesi Latihan',        'Selesaikan total 50 sesi Kita Latihan',     'achievement', 'latihan_count', 50,  600, 'b3000000-0000-0000-0000-000000000003',     '🛡️', 32)
ON CONFLICT DO NOTHING;

-- ── 5. Misi template AyoBelajar ────────────────────────────
INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES
  -- HARIAN
  ('Buka AyoBelajar',        'Kunjungi halaman AyoBelajar hari ini',       'harian',      'belajar_count', 1,  20,  NULL,                                       '📚', 6),
  -- MINGGUAN
  ('7x Buka AyoBelajar',     'Buka AyoBelajar 7 kali minggu ini',          'mingguan',    'belajar_count', 7,  100, 'b4000000-0000-0000-0000-000000000002',     '🔖', 5),
  -- ACHIEVEMENT
  ('Pemburu Ilmu',           'Buka AyoBelajar untuk pertama kali',         'achievement', 'belajar_count', 1,  30,  'b4000000-0000-0000-0000-000000000001',     '📚', 33),
  ('Penjelajah Materi',      'Buka AyoBelajar sebanyak 30 kali',           'achievement', 'belajar_count', 30, 400, 'b4000000-0000-0000-0000-000000000003',     '🌍', 34)
ON CONFLICT DO NOTHING;
