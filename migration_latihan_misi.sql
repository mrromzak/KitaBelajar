-- ============================================================
-- MIGRATION: Misi Kita Latihan
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Tambah kolom latihan_count ke users ─────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latihan_count int DEFAULT 0;

-- ── 2. Badge untuk Kita Latihan ────────────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b3000000-0000-0000-0000-000000000001', 'Latihan Perdana',   'Selesaikan sesi Kita Latihan pertamamu',  '🚀', 'misi'),
  ('b3000000-0000-0000-0000-000000000002', 'Rajin Latihan',     'Selesaikan 10 sesi Kita Latihan',         '💪', 'misi'),
  ('b3000000-0000-0000-0000-000000000003', 'Spartan Latihan',   'Selesaikan 50 sesi Kita Latihan',         '🛡️', 'misi'),
  ('b3000000-0000-0000-0000-000000000004', 'Nilai Sempurna',    'Raih skor 100% di Kita Latihan',          '💯', 'akurasi')
ON CONFLICT (id) DO NOTHING;

-- ── 3. Misi template untuk Kita Latihan ────────────────────
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
