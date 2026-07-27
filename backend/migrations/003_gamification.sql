-- 003_gamification
-- Consolidated from: migration_gamification, migration_badges_v2, migration_welcome_badge, migration_daily_reward

CREATE TABLE IF NOT EXISTS badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        TEXT NOT NULL,
  deskripsi   TEXT,
  icon        TEXT NOT NULL DEFAULT '🏅',
  tipe        TEXT NOT NULL DEFAULT 'misi',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS murid_badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id      UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  diperoleh_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(murid_id, badge_id)
);

CREATE TABLE IF NOT EXISTS misi_template (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul            TEXT NOT NULL,
  deskripsi        TEXT,
  tipe             TEXT NOT NULL DEFAULT 'harian',
  kondisi_tipe     TEXT NOT NULL,
  kondisi_target   INTEGER NOT NULL DEFAULT 1,
  reward_xp        INTEGER NOT NULL DEFAULT 0,
  reward_badge_id  UUID REFERENCES badges(id) ON DELETE SET NULL,
  icon             TEXT DEFAULT '🎯',
  urutan           INTEGER DEFAULT 0,
  aktif            BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS misi_murid (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  misi_id         UUID NOT NULL REFERENCES misi_template(id) ON DELETE CASCADE,
  progres         INTEGER NOT NULL DEFAULT 0,
  target          INTEGER NOT NULL DEFAULT 1,
  selesai         BOOLEAN DEFAULT FALSE,
  reward_claimed  BOOLEAN DEFAULT FALSE,
  periode         DATE,
  selesai_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_misi_murid_user    ON misi_murid(murid_id);
CREATE INDEX IF NOT EXISTS idx_misi_murid_periode ON misi_murid(murid_id, periode);
CREATE INDEX IF NOT EXISTS idx_murid_badges_user  ON murid_badges(murid_id);

DELETE FROM misi_murid WHERE periode IS NULL AND id NOT IN (
  SELECT DISTINCT ON (murid_id, misi_id) id FROM misi_murid
  WHERE periode IS NULL ORDER BY murid_id, misi_id, selesai DESC, progres DESC, created_at DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_periode
  ON misi_murid(murid_id, misi_id, periode) WHERE periode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_achievement
  ON misi_murid(murid_id, misi_id) WHERE periode IS NULL;

INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Selamat Datang',  'Selamat bergabung di KitaBelajar!',          '🎊', 'spesial'),
  ('b0000000-0000-0000-0000-000000000010', 'Seminggu Penuh',  'Klaim hadiah harian 7 hari berturut-turut!', '🌟', 'spesial'),
  ('b1000000-0000-0000-0000-000000000001', 'Pemula Hebat',    'Selesaikan misi harian pertamamu',           '⭐', 'misi'),
  ('b1000000-0000-0000-0000-000000000002', 'Rajin Belajar',   'Pertahankan streak 7 hari berturut-turut',   '🔥', 'streak'),
  ('b1000000-0000-0000-0000-000000000003', 'Konsisten',       'Pertahankan streak 5 hari dalam seminggu',   '📅', 'streak'),
  ('b1000000-0000-0000-0000-000000000004', 'Quiz Master',     'Selesaikan 100 quiz',                        '🎓', 'misi'),
  ('b1000000-0000-0000-0000-000000000005', 'Sempurna',        'Raih akurasi 100% dalam 1 quiz',             '💯', 'akurasi'),
  ('b1000000-0000-0000-0000-000000000006', 'Sharp!',          'Raih akurasi 90%+ dalam 5 quiz berturut',    '🎯', 'akurasi'),
  ('b1000000-0000-0000-0000-000000000007', 'Bintang Kelas',   'Masuk top 3 leaderboard kelas',              '🌟', 'spesial'),
  ('b1000000-0000-0000-0000-000000000008', 'Pelajar Aktif',   'Capai level 5',                              '📚', 'level'),
  ('b1000000-0000-0000-0000-000000000009', 'Legenda',         'Capai level 10',                             '👑', 'level'),
  ('b1000000-0000-0000-0000-000000000010', 'Petualang Materi','Selesaikan 10 materi',                       '🗺️', 'misi')
ON CONFLICT (id) DO NOTHING;

INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES
  ('Selesaikan 3 Quiz',         'Kerjakan 3 quiz hari ini',               'harian',      'quiz_count',   3,   50,  NULL, '⚡', 1),
  ('Raih Akurasi 80%+',         'Dapatkan akurasi minimal 80% di 1 quiz', 'harian',      'akurasi',      80,  30,  NULL, '🎯', 2),
  ('Pelajari 1 Materi',         'Baca dan selesaikan 1 materi hari ini',  'harian',      'materi_count', 1,   20,  NULL, '📖', 3),
  ('10 Quiz Minggu Ini',        'Selesaikan 10 quiz dalam seminggu',      'mingguan',    'quiz_count',   10,  200, NULL, '🏆', 1),
  ('Streak 5 Hari',             'Login dan belajar 5 hari berturut',      'mingguan',    'streak',       5,   150, 'b1000000-0000-0000-0000-000000000003', '🔥', 2),
  ('Kumpulkan 500 XP',          'Dapatkan 500 XP dalam seminggu',         'mingguan',    'xp_gained',    500, 100, NULL, '⭐', 3),
  ('Level 5 Pertama',           'Capai level 5 untuk pertama kali',       'achievement', 'level',        5,   0,   'b1000000-0000-0000-0000-000000000008', '📚', 1),
  ('Level 10 Legenda',          'Capai level 10',                         'achievement', 'level',        10,  500, 'b1000000-0000-0000-0000-000000000009', '👑', 2),
  ('100 Quiz Diselesaikan',     'Kerjakan total 100 quiz',                'achievement', 'quiz_count',   100, 500, 'b1000000-0000-0000-0000-000000000004', '🎓', 3),
  ('Streak 7 Hari',             'Login 7 hari berturut-turut',            'achievement', 'streak',       7,   0,   'b1000000-0000-0000-0000-000000000002', '🔥', 4),
  ('Akurasi Sempurna',          'Raih 100% di 1 quiz',                    'achievement', 'akurasi',      100, 0,   'b1000000-0000-0000-0000-000000000005', '💯', 5),
  ('Petualang Materi',          'Selesaikan 10 materi',                   'achievement', 'materi_count', 10,  300, 'b1000000-0000-0000-0000-000000000010', '🗺️', 6)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS daily_reward_klaim (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal    DATE NOT NULL,
  hari_ke    INTEGER NOT NULL CHECK (hari_ke BETWEEN 1 AND 7),
  xp_dapat   INTEGER NOT NULL DEFAULT 0,
  badge_id   UUID REFERENCES badges(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (murid_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_daily_reward_murid ON daily_reward_klaim (murid_id, tanggal DESC);
