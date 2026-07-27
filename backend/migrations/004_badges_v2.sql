-- 004_badges_v2
-- Consolidated from: migration_badges_v2, migration_latihan_misi, migration_misi_latihan_belajar

ALTER TABLE users ADD COLUMN IF NOT EXISTS latihan_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS belajar_count INTEGER DEFAULT 0;

INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'Mulai Tumbuh',     'Capai level 3',                               '🌱', 'level'),
  ('b2000000-0000-0000-0000-000000000002', 'Pejuang',          'Capai level 7',                               '⚔️', 'level'),
  ('b2000000-0000-0000-0000-000000000003', 'Diamond',          'Capai level 15',                              '💎', 'level'),
  ('b2000000-0000-0000-0000-000000000004', 'Grandmaster',      'Capai level 20',                              '🎖️', 'level'),
  ('b2000000-0000-0000-0000-000000000005', 'Aktif',            'Selesaikan 10 quiz',                          '⚡', 'misi'),
  ('b2000000-0000-0000-0000-000000000006', 'Quiz Mania',       'Selesaikan 50 quiz',                          '🔥', 'misi'),
  ('b2000000-0000-0000-0000-000000000007', 'Legenda Quiz',     'Selesaikan 200 quiz',                         '🏆', 'misi'),
  ('b2000000-0000-0000-0000-000000000008', 'Pertama Kali',     'Selesaikan quiz pertamamu',                   '🎉', 'misi'),
  ('b2000000-0000-0000-0000-000000000009', 'Tepat Sasaran',    'Raih akurasi 90%+ sebanyak 5 kali',           '🎯', 'akurasi'),
  ('b2000000-0000-0000-0000-000000000010', 'Ahli',             'Rata-rata akurasi 85%+ dari semua quiz',      '🧠', 'akurasi'),
  ('b2000000-0000-0000-0000-000000000011', 'Pantang Menyerah', 'Streak 3 hari berturut-turut',                '🌤️', 'streak'),
  ('b2000000-0000-0000-0000-000000000012', 'Dua Minggu',       'Streak 14 hari berturut-turut',               '📆', 'streak'),
  ('b2000000-0000-0000-0000-000000000013', 'Bulan Penuh',      'Streak 30 hari berturut-turut',               '🌕', 'streak'),
  ('b2000000-0000-0000-0000-000000000014', 'Pembaca Muda',     'Selesaikan 5 materi',                         '📗', 'misi'),
  ('b2000000-0000-0000-0000-000000000015', 'Kutu Buku',        'Selesaikan 20 materi',                        '🐛', 'misi'),
  ('b2000000-0000-0000-0000-000000000016', 'Sarjana Muda',     'Selesaikan 50 materi',                        '🎓', 'misi'),
  ('b2000000-0000-0000-0000-000000000017', 'Juara',            'Raih peringkat #1 di leaderboard kelas',      '🥇', 'spesial'),
  ('b2000000-0000-0000-0000-000000000018', 'Speed Runner',     'Kerjakan 5 quiz dalam 1 hari',                '🏃', 'spesial'),
  ('b2000000-0000-0000-0000-000000000019', 'Tak Terhentikan',  'Kerjakan quiz 7 hari berturut-turut',         '🌪️', 'spesial'),
  ('b2000000-0000-0000-0000-000000000020', 'Multitasker',      'Selesaikan quiz DAN materi di hari yang sama','⚙️', 'spesial'),
  ('b2000000-0000-0000-0000-000000000021', 'Pelopor',          'Murid pertama yang join kelas',                '🚀', 'spesial'),
  ('b2000000-0000-0000-0000-000000000022', 'XP Hunter',        'Kumpulkan total 5000 XP',                     '💰', 'spesial'),
  ('b2000000-0000-0000-0000-000000000023', 'XP Billionaire',   'Kumpulkan total 10000 XP',                    '💸', 'spesial'),
  ('b2000000-0000-0000-0000-000000000024', 'Comeback',         'Kembali belajar setelah 3 hari tidak aktif',  '🔄', 'spesial'),
  ('b2000000-0000-0000-0000-000000000025', 'All Rounder',      'Selesaikan quiz di 3 mapel berbeda',          '🌈', 'spesial'),
  ('b3000000-0000-0000-0000-000000000001', 'Latihan Perdana',  'Selesaikan sesi Kita Latihan pertamamu',      '🚀', 'misi'),
  ('b3000000-0000-0000-0000-000000000002', 'Rajin Latihan',    'Selesaikan 10 sesi Kita Latihan',             '💪', 'misi'),
  ('b3000000-0000-0000-0000-000000000003', 'Spartan Latihan',  'Selesaikan 50 sesi Kita Latihan',             '🛡️', 'misi'),
  ('b3000000-0000-0000-0000-000000000004', 'Nilai Sempurna',   'Raih skor 100% di Kita Latihan',              '💯', 'akurasi'),
  ('b4000000-0000-0000-0000-000000000001', 'Pemburu Ilmu',     'Buka AyoBelajar untuk pertama kali',          '📚', 'misi'),
  ('b4000000-0000-0000-0000-000000000002', 'Kutu Buku',        'Buka AyoBelajar 7 hari berturut-turut',       '🔖', 'misi'),
  ('b4000000-0000-0000-0000-000000000003', 'Penjelajah Materi','Buka AyoBelajar 30 kali',                     '🌍', 'misi')
ON CONFLICT (id) DO NOTHING;

INSERT INTO misi_template (judul, deskripsi, tipe, kondisi_tipe, kondisi_target, reward_xp, reward_badge_id, icon, urutan) VALUES
  ('Level 3: Mulai Tumbuh',       'Capai level 3',                        'achievement', 'level',        3,   0,   'b2000000-0000-0000-0000-000000000001', '🌱', 10),
  ('Level 7: Pejuang',            'Capai level 7',                        'achievement', 'level',        7,   200, 'b2000000-0000-0000-0000-000000000002', '⚔️', 11),
  ('Level 15: Diamond',           'Capai level 15',                       'achievement', 'level',        15,  500, 'b2000000-0000-0000-0000-000000000003', '💎', 12),
  ('Level 20: Grandmaster',       'Capai level 20',                       'achievement', 'level',        20,  1000,'b2000000-0000-0000-0000-000000000004', '🎖️', 13),
  ('Quiz Pertama',                'Selesaikan quiz pertamamu',             'achievement', 'quiz_count',   1,   30,  'b2000000-0000-0000-0000-000000000008', '🎉', 14),
  ('10 Quiz Pertama',             'Selesaikan 10 quiz',                   'achievement', 'quiz_count',   10,  100, 'b2000000-0000-0000-0000-000000000005', '⚡', 15),
  ('50 Quiz Diselesaikan',        'Kerjakan total 50 quiz',               'achievement', 'quiz_count',   50,  300, 'b2000000-0000-0000-0000-000000000006', '🔥', 16),
  ('200 Quiz Diselesaikan',       'Kerjakan total 200 quiz',              'achievement', 'quiz_count',   200, 1000,'b2000000-0000-0000-0000-000000000007', '🏆', 17),
  ('Streak 3 Hari',               'Login 3 hari berturut-turut',          'achievement', 'streak',       3,   0,   'b2000000-0000-0000-0000-000000000011', '🌤️', 18),
  ('Streak 14 Hari',              'Login 14 hari berturut-turut',         'achievement', 'streak',       14,  300, 'b2000000-0000-0000-0000-000000000012', '📆', 19),
  ('Streak 30 Hari',              'Login 30 hari berturut-turut',         'achievement', 'streak',       30,  1000,'b2000000-0000-0000-0000-000000000013', '🌕', 20),
  ('5 Materi Selesai',            'Selesaikan 5 materi',                  'achievement', 'materi_count', 5,   100, 'b2000000-0000-0000-0000-000000000014', '📗', 21),
  ('20 Materi Selesai',           'Selesaikan 20 materi',                 'achievement', 'materi_count', 20,  400, 'b2000000-0000-0000-0000-000000000015', '🐛', 22),
  ('50 Materi Selesai',           'Selesaikan 50 materi',                 'achievement', 'materi_count', 50,  800, 'b2000000-0000-0000-0000-000000000016', '🎓', 23),
  ('Kumpulkan 5000 XP',           'Total XP mencapai 5000',               'achievement', 'level',        5,   0,   'b2000000-0000-0000-0000-000000000022', '💰', 24),
  ('Kumpulkan 10000 XP',          'Total XP mencapai 10000',              'achievement', 'level',        10,  0,   'b2000000-0000-0000-0000-000000000023', '💸', 25),
  ('Selesaikan 1 Latihan',        'Kerjakan 1 sesi Kita Latihan hari ini','harian',      'latihan_count', 1,   40,  NULL, '🚀', 4),
  ('Selesaikan 3 Latihan',        'Kerjakan 3 sesi Kita Latihan hari ini','harian',      'latihan_count', 3,   120, NULL, '🔥', 5),
  ('5 Latihan Minggu Ini',        'Selesaikan 5 sesi Kita Latihan mi.ini','mingguan',    'latihan_count', 5,   200, NULL, '💪', 4),
  ('Latihan Pertama',             'Selesaikan sesi Kita Latihan pertamamu','achievement', 'latihan_count', 1,  50,  'b3000000-0000-0000-0000-000000000001', '🚀', 30),
  ('10 Sesi Latihan',             'Selesaikan total 10 sesi Kita Latihan','achievement', 'latihan_count', 10, 200, 'b3000000-0000-0000-0000-000000000002', '💪', 31),
  ('50 Sesi Latihan',             'Selesaikan total 50 sesi Kita Latihan','achievement', 'latihan_count', 50, 600, 'b3000000-0000-0000-0000-000000000003', '🛡️', 32),
  ('Buka AyoBelajar',             'Kunjungi halaman AyoBelajar hari ini',  'harian',      'belajar_count',1,  20,  NULL, '📚', 6),
  ('7x Buka AyoBelajar',          'Buka AyoBelajar 7 kali minggu ini',     'mingguan',    'belajar_count',7,  100, 'b4000000-0000-0000-0000-000000000002', '🔖', 5),
  ('Pemburu Ilmu',                'Buka AyoBelajar untuk pertama kali',    'achievement', 'belajar_count',1,  30,  'b4000000-0000-0000-0000-000000000001', '📚', 33),
  ('Penjelajah Materi',           'Buka AyoBelajar sebanyak 30 kali',      'achievement', 'belajar_count',30, 400, 'b4000000-0000-0000-0000-000000000003', '🌍', 34)
ON CONFLICT DO NOTHING;
