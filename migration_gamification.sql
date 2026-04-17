-- ============================================================
-- MIGRATION: Gamification — Leaderboard + Misi + Badges
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Tambah kolom gamifikasi ke tabel users ──────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS streak       int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active  date,
  ADD COLUMN IF NOT EXISTS quiz_count   int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_skor     numeric DEFAULT 0;

-- ── 2. Tabel badges — definisi semua badge ─────────────────
CREATE TABLE IF NOT EXISTS badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        text NOT NULL,
  deskripsi   text,
  icon        text NOT NULL DEFAULT '🏅',
  tipe        text NOT NULL DEFAULT 'misi',
  -- tipe: 'misi' | 'streak' | 'level' | 'akurasi' | 'spesial'
  created_at  timestamptz DEFAULT now()
);

-- ── 3. Tabel murid_badges — badge yang sudah diraih murid ──
CREATE TABLE IF NOT EXISTS murid_badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id      uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  diperoleh_at  timestamptz DEFAULT now(),
  UNIQUE(murid_id, badge_id)
);

-- ── 4. Tabel misi_template — definisi semua misi ───────────
CREATE TABLE IF NOT EXISTS misi_template (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul            text NOT NULL,
  deskripsi        text,
  tipe             text NOT NULL DEFAULT 'harian',
  -- tipe: 'harian' | 'mingguan' | 'achievement'
  kondisi_tipe     text NOT NULL,
  -- kondisi_tipe: 'quiz_count' | 'xp_gained' | 'streak' | 'akurasi' | 'materi_count' | 'level'
  kondisi_target   int  NOT NULL DEFAULT 1,
  reward_xp        int  NOT NULL DEFAULT 0,
  reward_badge_id  uuid REFERENCES badges(id) ON DELETE SET NULL,
  icon             text DEFAULT '🎯',
  urutan           int  DEFAULT 0,
  aktif            boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- ── 5. Tabel misi_murid — progres misi per murid ───────────
CREATE TABLE IF NOT EXISTS misi_murid (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  misi_id         uuid NOT NULL REFERENCES misi_template(id) ON DELETE CASCADE,
  progres         int  NOT NULL DEFAULT 0,
  target          int  NOT NULL DEFAULT 1,
  selesai         boolean DEFAULT false,
  reward_claimed  boolean DEFAULT false,
  periode         date,
  -- harian  : tanggal hari ini
  -- mingguan: tanggal Senin minggu ini
  -- achievement: NULL
  selesai_at      timestamptz,
  created_at      timestamptz DEFAULT now()
  -- Unique constraint dihandle via index di bawah (karena NULL periode)
);

-- ── Index untuk performa query ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_misi_murid_user    ON misi_murid(murid_id);
CREATE INDEX IF NOT EXISTS idx_misi_murid_periode ON misi_murid(murid_id, periode);
CREATE INDEX IF NOT EXISTS idx_murid_badges_user  ON murid_badges(murid_id);

-- Unique index terpisah untuk harian/mingguan (periode NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_periode
  ON misi_murid(murid_id, misi_id, periode)
  WHERE periode IS NOT NULL;

-- Unique index terpisah untuk achievement (periode IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_achievement
  ON misi_murid(murid_id, misi_id)
  WHERE periode IS NULL;

-- ── 6. Seed: data badges awal ──────────────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Pemula Hebat',     'Selesaikan misi harian pertamamu',           '⭐', 'misi'),
  ('b1000000-0000-0000-0000-000000000002', 'Rajin Belajar',    'Pertahankan streak 7 hari berturut-turut',   '🔥', 'streak'),
  ('b1000000-0000-0000-0000-000000000003', 'Konsisten',        'Pertahankan streak 5 hari dalam seminggu',   '📅', 'streak'),
  ('b1000000-0000-0000-0000-000000000004', 'Quiz Master',      'Selesaikan 100 quiz',                        '🎓', 'misi'),
  ('b1000000-0000-0000-0000-000000000005', 'Sempurna',         'Raih akurasi 100% dalam 1 quiz',             '💯', 'akurasi'),
  ('b1000000-0000-0000-0000-000000000006', 'Sharp!',           'Raih akurasi 90%+ dalam 5 quiz berturut',    '🎯', 'akurasi'),
  ('b1000000-0000-0000-0000-000000000007', 'Bintang Kelas',    'Masuk top 3 leaderboard kelas',              '🌟', 'spesial'),
  ('b1000000-0000-0000-0000-000000000008', 'Pelajar Aktif',    'Capai level 5',                              '📚', 'level'),
  ('b1000000-0000-0000-0000-000000000009', 'Legenda',          'Capai level 10',                             '👑', 'level'),
  ('b1000000-0000-0000-0000-000000000010', 'Petualang Materi', 'Selesaikan 10 materi',                       '🗺️', 'misi'),
  -- v2 badges
  ('b2000000-0000-0000-0000-000000000001', 'Mulai Tumbuh',     'Capai level 3',                               '🌱', 'level'),
  ('b2000000-0000-0000-0000-000000000002', 'Pejuang',          'Capai level 7',                               '⚔️', 'level'),
  ('b2000000-0000-0000-0000-000000000003', 'Diamond',          'Capai level 15',                              '💎', 'level'),
  ('b2000000-0000-0000-0000-000000000004', 'Grandmaster',      'Capai level 20',                              '🎖️', 'level'),
  ('b2000000-0000-0000-0000-000000000005', 'Aktif',            'Selesaikan 10 quiz',                          '⚡', 'misi'),
  ('b2000000-0000-0000-0000-000000000006', 'Quiz Mania',       'Selesaikan 50 quiz',                          '🔥', 'misi'),
  ('b2000000-0000-0000-0000-000000000007', 'Legenda Quiz',     'Selesaikan 200 quiz',                         '🏆', 'misi'),
  ('b2000000-0000-0000-0000-000000000008', 'Pertama Kali',     'Selesaikan quiz pertamamu',                   '🎉', 'misi'),
  ('b2000000-0000-0000-0000-000000000009', 'Tepat Sasaran',    'Raih akurasi 90%+ sebanyak 5 kali',           '🎯', 'akurasi'),
  ('b2000000-0000-0000-0000-000000000010', 'Ahli',             'Rata-rata akurasi 85%+',                      '🧠', 'akurasi'),
  ('b2000000-0000-0000-0000-000000000011', 'Pantang Menyerah', 'Streak 3 hari berturut-turut',                '🌤️', 'streak'),
  ('b2000000-0000-0000-0000-000000000012', 'Dua Minggu',       'Streak 14 hari berturut-turut',               '📆', 'streak'),
  ('b2000000-0000-0000-0000-000000000013', 'Bulan Penuh',      'Streak 30 hari berturut-turut',               '🌕', 'streak'),
  ('b2000000-0000-0000-0000-000000000014', 'Pembaca Muda',     'Selesaikan 5 materi',                         '📗', 'misi'),
  ('b2000000-0000-0000-0000-000000000015', 'Kutu Buku',        'Selesaikan 20 materi',                        '🐛', 'misi'),
  ('b2000000-0000-0000-0000-000000000016', 'Sarjana Muda',     'Selesaikan 50 materi',                        '🎓', 'misi'),
  ('b2000000-0000-0000-0000-000000000017', 'Juara',            'Raih peringkat #1 di leaderboard kelas',      '🥇', 'spesial'),
  ('b2000000-0000-0000-0000-000000000018', 'Speed Runner',     'Kerjakan 5 quiz dalam 1 hari',                '🏃', 'spesial'),
  ('b2000000-0000-0000-0000-000000000019', 'Tak Terhentikan',  'Kerjakan quiz 7 hari berturut-turut',         '🌪️', 'spesial'),
  ('b2000000-0000-0000-0000-000000000020', 'Multitasker',      'Selesaikan quiz & materi di hari yang sama',  '⚙️', 'spesial'),
  ('b2000000-0000-0000-0000-000000000021', 'Pelopor',          'Murid pertama yang join kelas',               '🚀', 'spesial'),
  ('b2000000-0000-0000-0000-000000000022', 'XP Hunter',        'Kumpulkan total 5000 XP',                     '💰', 'spesial'),
  ('b2000000-0000-0000-0000-000000000023', 'XP Billionaire',   'Kumpulkan total 10000 XP',                    '💸', 'spesial'),
  ('b2000000-0000-0000-0000-000000000024', 'Comeback',         'Kembali belajar setelah tidak aktif',         '🔄', 'spesial'),
  ('b2000000-0000-0000-0000-000000000025', 'All Rounder',      'Selesaikan quiz di 3 mapel berbeda',          '🌈', 'spesial')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Seed: data misi_template awal ───────────────────────
INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES
  -- HARIAN
  ('Selesaikan 3 Quiz',         'Kerjakan 3 quiz hari ini',               'harian',      'quiz_count',   3,   50,  NULL, '⚡', 1),
  ('Raih Akurasi 80%+',         'Dapatkan akurasi minimal 80% di 1 quiz', 'harian',      'akurasi',      80,  30,  NULL, '🎯', 2),
  ('Pelajari 1 Materi',         'Baca dan selesaikan 1 materi hari ini',  'harian',      'materi_count', 1,   20,  NULL, '📖', 3),
  -- MINGGUAN
  ('10 Quiz Minggu Ini',        'Selesaikan 10 quiz dalam seminggu',      'mingguan',    'quiz_count',   10,  200, NULL, '🏆', 1),
  ('Streak 5 Hari',             'Login dan belajar 5 hari berturut',      'mingguan',    'streak',       5,   150, 'b1000000-0000-0000-0000-000000000003', '🔥', 2),
  ('Kumpulkan 500 XP',          'Dapatkan 500 XP dalam seminggu',         'mingguan',    'xp_gained',    500, 100, NULL, '⭐', 3),
  -- ACHIEVEMENT (satu kali seumur hidup)
  ('Level 5 Pertama',           'Capai level 5 untuk pertama kali',       'achievement', 'level',        5,   0,   'b1000000-0000-0000-0000-000000000008', '📚', 1),
  ('Level 10 Legenda',          'Capai level 10',                         'achievement', 'level',        10,  500, 'b1000000-0000-0000-0000-000000000009', '👑', 2),
  ('100 Quiz Diselesaikan',     'Kerjakan total 100 quiz',                'achievement', 'quiz_count',   100, 500, 'b1000000-0000-0000-0000-000000000004', '🎓', 3),
  ('Streak 7 Hari',             'Login 7 hari berturut-turut',            'achievement', 'streak',       7,   0,   'b1000000-0000-0000-0000-000000000002', '🔥', 4),
  ('Akurasi Sempurna',          'Raih 100% di 1 quiz',                    'achievement', 'akurasi',      100, 0,   'b1000000-0000-0000-0000-000000000005', '💯', 5),
  ('Petualang Materi',          'Selesaikan 10 materi',                   'achievement', 'materi_count', 10,  300, 'b1000000-0000-0000-0000-000000000010', '🗺️', 6)
ON CONFLICT DO NOTHING;
