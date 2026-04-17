-- ============================================================
-- MIGRATION: Tambah Badge & Misi Baru (v2)
-- Jalankan di Supabase SQL Editor setelah migration_gamification.sql
-- ============================================================

-- ── Fix UNIQUE constraint untuk achievement (periode NULL) ──
-- Hapus constraint lama jika ada, ganti dengan partial index
ALTER TABLE misi_murid DROP CONSTRAINT IF EXISTS misi_murid_murid_id_misi_id_periode_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_periode
  ON misi_murid(murid_id, misi_id, periode)
  WHERE periode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_achievement
  ON misi_murid(murid_id, misi_id)
  WHERE periode IS NULL;

-- ── Tambah badge baru ──────────────────────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES

  -- LEVEL
  ('b2000000-0000-0000-0000-000000000001', 'Mulai Tumbuh',     'Capai level 3',                               '🌱', 'level'),
  ('b2000000-0000-0000-0000-000000000002', 'Pejuang',          'Capai level 7',                               '⚔️', 'level'),
  ('b2000000-0000-0000-0000-000000000003', 'Diamond',          'Capai level 15',                              '💎', 'level'),
  ('b2000000-0000-0000-0000-000000000004', 'Grandmaster',      'Capai level 20',                              '🎖️', 'level'),

  -- QUIZ VOLUME
  ('b2000000-0000-0000-0000-000000000005', 'Aktif',            'Selesaikan 10 quiz',                          '⚡', 'misi'),
  ('b2000000-0000-0000-0000-000000000006', 'Quiz Mania',       'Selesaikan 50 quiz',                          '🔥', 'misi'),
  ('b2000000-0000-0000-0000-000000000007', 'Legenda Quiz',     'Selesaikan 200 quiz',                         '🏆', 'misi'),
  ('b2000000-0000-0000-0000-000000000008', 'Pertama Kali',     'Selesaikan quiz pertamamu',                   '🎉', 'misi'),

  -- AKURASI
  ('b2000000-0000-0000-0000-000000000009', 'Tepat Sasaran',    'Raih akurasi 90%+ sebanyak 5 kali',           '🎯', 'akurasi'),
  ('b2000000-0000-0000-0000-000000000010', 'Ahli',             'Rata-rata akurasi 85%+ dari semua quiz',      '🧠', 'akurasi'),

  -- STREAK
  ('b2000000-0000-0000-0000-000000000011', 'Pantang Menyerah', 'Streak 3 hari berturut-turut',                '🌤️', 'streak'),
  ('b2000000-0000-0000-0000-000000000012', 'Dua Minggu',       'Streak 14 hari berturut-turut',               '📆', 'streak'),
  ('b2000000-0000-0000-0000-000000000013', 'Bulan Penuh',      'Streak 30 hari berturut-turut',               '🌕', 'streak'),

  -- MATERI
  ('b2000000-0000-0000-0000-000000000014', 'Pembaca Muda',     'Selesaikan 5 materi',                         '📗', 'misi'),
  ('b2000000-0000-0000-0000-000000000015', 'Kutu Buku',        'Selesaikan 20 materi',                        '🐛', 'misi'),
  ('b2000000-0000-0000-0000-000000000016', 'Sarjana Muda',     'Selesaikan 50 materi',                        '🎓', 'misi'),

  -- SPESIAL
  ('b2000000-0000-0000-0000-000000000017', 'Juara',            'Raih peringkat #1 di leaderboard kelas',      '🥇', 'spesial'),
  ('b2000000-0000-0000-0000-000000000018', 'Speed Runner',     'Kerjakan 5 quiz dalam 1 hari',                '🏃', 'spesial'),
  ('b2000000-0000-0000-0000-000000000019', 'Tak Terhentikan',  'Kerjakan quiz 7 hari berturut-turut',         '🌪️', 'spesial'),
  ('b2000000-0000-0000-0000-000000000020', 'Multitasker',      'Selesaikan quiz DAN materi di hari yang sama','⚙️', 'spesial'),
  ('b2000000-0000-0000-0000-000000000021', 'Pelopor',          'Murid pertama yang join kelas',                '🚀', 'spesial'),
  ('b2000000-0000-0000-0000-000000000022', 'XP Hunter',        'Kumpulkan total 5000 XP',                     '💰', 'spesial'),
  ('b2000000-0000-0000-0000-000000000023', 'XP Billionaire',   'Kumpulkan total 10000 XP',                    '💸', 'spesial'),
  ('b2000000-0000-0000-0000-000000000024', 'Comeback',         'Kembali belajar setelah 3 hari tidak aktif',  '🔄', 'spesial'),
  ('b2000000-0000-0000-0000-000000000025', 'All Rounder',      'Selesaikan quiz di 3 mata pelajaran berbeda', '🌈', 'spesial')

ON CONFLICT (id) DO NOTHING;

-- ── Tambah achievement baru yang terhubung ke badge baru ───
INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES

  -- LEVEL
  ('Level 3: Mulai Tumbuh',       'Capai level 3',                        'achievement', 'level',        3,   0,   'b2000000-0000-0000-0000-000000000001', '🌱', 10),
  ('Level 7: Pejuang',            'Capai level 7',                        'achievement', 'level',        7,   200, 'b2000000-0000-0000-0000-000000000002', '⚔️', 11),
  ('Level 15: Diamond',           'Capai level 15',                       'achievement', 'level',        15,  500, 'b2000000-0000-0000-0000-000000000003', '💎', 12),
  ('Level 20: Grandmaster',       'Capai level 20',                       'achievement', 'level',        20,  1000,'b2000000-0000-0000-0000-000000000004', '🎖️', 13),

  -- QUIZ VOLUME
  ('Quiz Pertama',                'Selesaikan quiz pertamamu',             'achievement', 'quiz_count',   1,   30,  'b2000000-0000-0000-0000-000000000008', '🎉', 14),
  ('10 Quiz Pertama',             'Selesaikan 10 quiz',                   'achievement', 'quiz_count',   10,  100, 'b2000000-0000-0000-0000-000000000005', '⚡', 15),
  ('50 Quiz Diselesaikan',        'Kerjakan total 50 quiz',               'achievement', 'quiz_count',   50,  300, 'b2000000-0000-0000-0000-000000000006', '🔥', 16),
  ('200 Quiz Diselesaikan',       'Kerjakan total 200 quiz',              'achievement', 'quiz_count',   200, 1000,'b2000000-0000-0000-0000-000000000007', '🏆', 17),

  -- STREAK
  ('Streak 3 Hari',               'Login 3 hari berturut-turut',          'achievement', 'streak',       3,   0,   'b2000000-0000-0000-0000-000000000011', '🌤️', 18),
  ('Streak 14 Hari',              'Login 14 hari berturut-turut',         'achievement', 'streak',       14,  300, 'b2000000-0000-0000-0000-000000000012', '📆', 19),
  ('Streak 30 Hari',              'Login 30 hari berturut-turut',         'achievement', 'streak',       30,  1000,'b2000000-0000-0000-0000-000000000013', '🌕', 20),

  -- MATERI
  ('5 Materi Selesai',            'Selesaikan 5 materi',                  'achievement', 'materi_count', 5,   100, 'b2000000-0000-0000-0000-000000000014', '📗', 21),
  ('20 Materi Selesai',           'Selesaikan 20 materi',                 'achievement', 'materi_count', 20,  400, 'b2000000-0000-0000-0000-000000000015', '🐛', 22),
  ('50 Materi Selesai',           'Selesaikan 50 materi',                 'achievement', 'materi_count', 50,  800, 'b2000000-0000-0000-0000-000000000016', '🎓', 23),

  -- XP TOTAL (pakai level sebagai proxy karena xp_total tidak di-track per-achievement)
  ('Kumpulkan 5000 XP',           'Total XP mencapai 5000',               'achievement', 'level',        5,   0,   'b2000000-0000-0000-0000-000000000022', '💰', 24),
  ('Kumpulkan 10000 XP',          'Total XP mencapai 10000',              'achievement', 'level',        10,  0,   'b2000000-0000-0000-0000-000000000023', '💸', 25)

ON CONFLICT DO NOTHING;
