-- =====================================================
--  BELAJARSERU — SQL SCHEMA + SEED DATA
--  Jalankan ini di Supabase > SQL Editor > New Query
-- =====================================================

-- Aktifkan UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
--  1. TABEL USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('guru', 'murid')),
  avatar      TEXT DEFAULT '🦁',
  kelas       TEXT,
  xp          INTEGER DEFAULT 0,
  level       INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  2. TABEL KELAS
-- =====================================================
CREATE TABLE IF NOT EXISTS kelas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama        TEXT NOT NULL,
  tahun_ajar  TEXT NOT NULL,
  guru_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kode_akses  TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  3. KELAS_MURID (relasi murid - kelas)
-- =====================================================
CREATE TABLE IF NOT EXISTS kelas_murid (
  kelas_id    UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  murid_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (kelas_id, murid_id)
);

-- =====================================================
--  4. MATERI
-- =====================================================
CREATE TABLE IF NOT EXISTS materi (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judul       TEXT NOT NULL,
  deskripsi   TEXT,
  mapel       TEXT NOT NULL,
  jenis       TEXT NOT NULL CHECK (jenis IN ('pdf', 'video', 'teks', 'gambar')),
  konten      TEXT,
  file_url    TEXT,
  guru_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kelas_id    UUID REFERENCES kelas(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'draft')),
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  5. SOAL (Bank Soal)
-- =====================================================
CREATE TABLE IF NOT EXISTS soal (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pertanyaan  TEXT NOT NULL,
  emoji       TEXT DEFAULT '❓',
  mapel       TEXT NOT NULL,
  jenis       TEXT NOT NULL CHECK (jenis IN ('pilihan_ganda', 'isian', 'benar_salah')),
  opsi        JSONB,         -- array pilihan, contoh: ["A","B","C","D"]
  jawaban     TEXT NOT NULL,
  poin        INTEGER DEFAULT 100,
  tingkat     TEXT DEFAULT 'mudah' CHECK (tingkat IN ('mudah', 'sedang', 'sulit')),
  guru_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  6. QUIZ
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judul       TEXT NOT NULL,
  deskripsi   TEXT,
  mapel       TEXT NOT NULL,
  guru_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kelas_id    UUID REFERENCES kelas(id) ON DELETE SET NULL,
  durasi      INTEGER DEFAULT 15,
  status      TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  7. QUIZ_SOAL (relasi quiz - soal)
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_soal (
  quiz_id     UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  soal_id     UUID NOT NULL REFERENCES soal(id) ON DELETE CASCADE,
  urutan      INTEGER DEFAULT 1,
  PRIMARY KEY (quiz_id, soal_id)
);

-- =====================================================
--  8. HASIL_QUIZ
-- =====================================================
CREATE TABLE IF NOT EXISTS hasil_quiz (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  murid_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  skor          INTEGER DEFAULT 0,
  benar         INTEGER DEFAULT 0,
  total_soal    INTEGER DEFAULT 0,
  durasi_detik  INTEGER DEFAULT 0,
  selesai_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  9. DETAIL_JAWABAN
-- =====================================================
CREATE TABLE IF NOT EXISTS detail_jawaban (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hasil_id      UUID NOT NULL REFERENCES hasil_quiz(id) ON DELETE CASCADE,
  soal_id       UUID NOT NULL REFERENCES soal(id) ON DELETE CASCADE,
  jawaban_user  TEXT,
  benar         BOOLEAN DEFAULT FALSE,
  poin_dapat    INTEGER DEFAULT 0
);

-- =====================================================
--  10. PROGRES_MATERI
-- =====================================================
CREATE TABLE IF NOT EXISTS progres_materi (
  murid_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  materi_id   UUID NOT NULL REFERENCES materi(id) ON DELETE CASCADE,
  selesai     BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (murid_id, materi_id)
);

-- =====================================================
--  11. NOTIFIKASI
-- =====================================================
CREATE TABLE IF NOT EXISTS notifikasi (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  judul       TEXT NOT NULL,
  pesan       TEXT NOT NULL,
  dibaca      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
--  SUPABASE STORAGE BUCKET (untuk upload file materi)
-- =====================================================
-- Jalankan ini juga untuk membuat bucket penyimpanan file:
INSERT INTO storage.buckets (id, name, public)
VALUES ('materi-files', 'materi-files', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: semua orang bisa baca file (public)
CREATE POLICY "Public read materi-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materi-files');

-- Policy: hanya user terautentikasi bisa upload
CREATE POLICY "Auth upload materi-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'materi-files');

-- =====================================================
--  SEED DATA DEMO
--  (password sudah di-hash: "guru123" dan "murid123")
-- =====================================================
DO $$
DECLARE
  v_guru_id   UUID := uuid_generate_v4();
  v_murid1_id UUID := uuid_generate_v4();
  v_murid2_id UUID := uuid_generate_v4();
  v_murid3_id UUID := uuid_generate_v4();
  v_kelas_id  UUID := uuid_generate_v4();
  v_s1_id     UUID := uuid_generate_v4();
  v_s2_id     UUID := uuid_generate_v4();
  v_s3_id     UUID := uuid_generate_v4();
  v_s4_id     UUID := uuid_generate_v4();
  v_s5_id     UUID := uuid_generate_v4();
  v_quiz_id   UUID := uuid_generate_v4();
BEGIN

  -- USERS
  -- Password hash: "guru123"  → $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
  -- Password hash: "murid123" → $2a$10$P9LJgEJLmSEMJQONf2q0LeRnPJXhRd5FH.JNnBgQ4DqvPPLYDg0Oy
  INSERT INTO users (id, nama, email, password, role, avatar, kelas, xp, level) VALUES
    (v_guru_id,   'Bu Sari Rahayu', 'guru@demo.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'guru',  '👩‍🏫', '4A', 0,   1),
    (v_murid1_id, 'Andi Saputra',   'andi@demo.com',  '$2a$10$P9LJgEJLmSEMJQONf2q0LeRnPJXhRd5FH.JNnBgQ4DqvPPLYDg0Oy', 'murid', '🦁',  '4A', 980, 7),
    (v_murid2_id, 'Sari Dewi',      'sari@demo.com',  '$2a$10$P9LJgEJLmSEMJQONf2q0LeRnPJXhRd5FH.JNnBgQ4DqvPPLYDg0Oy', 'murid', '🐯',  '4A', 870, 6),
    (v_murid3_id, 'Budi Santoso',   'budi@demo.com',  '$2a$10$P9LJgEJLmSEMJQONf2q0LeRnPJXhRd5FH.JNnBgQ4DqvPPLYDg0Oy', 'murid', '🐻',  '4A', 820, 6)
  ON CONFLICT (email) DO NOTHING;

  -- KELAS
  INSERT INTO kelas (id, nama, tahun_ajar, guru_id, kode_akses) VALUES
    (v_kelas_id, 'Kelas 4A', '2024/2025', v_guru_id, 'KELAS4A')
  ON CONFLICT DO NOTHING;

  -- KELAS_MURID
  INSERT INTO kelas_murid (kelas_id, murid_id) VALUES
    (v_kelas_id, v_murid1_id),
    (v_kelas_id, v_murid2_id),
    (v_kelas_id, v_murid3_id)
  ON CONFLICT DO NOTHING;

  -- MATERI
  INSERT INTO materi (judul, deskripsi, mapel, jenis, konten, guru_id, kelas_id, status) VALUES
    ('Perkalian & Pembagian', 'Belajar perkalian 1-100 dan pembagian sederhana.', 'Matematika', 'teks',
     'Perkalian adalah penjumlahan berulang. Contoh: 3 × 4 = 12. Pembagian adalah kebalikannya. Contoh: 12 ÷ 4 = 3.',
     v_guru_id, v_kelas_id, 'aktif'),
    ('Ekosistem & Rantai Makanan', 'Hubungan antar makhluk hidup dalam ekosistem.', 'IPA', 'teks',
     'Ekosistem adalah hubungan timbal balik antara makhluk hidup dan lingkungannya. Rantai makanan menggambarkan aliran energi dari produsen ke konsumen.',
     v_guru_id, v_kelas_id, 'aktif'),
    ('Teks Deskripsi', 'Cara menulis teks deskripsi yang baik.', 'Bahasa Indonesia', 'teks',
     'Teks deskripsi menggambarkan suatu objek secara detail sehingga pembaca dapat membayangkannya.',
     v_guru_id, v_kelas_id, 'draft');

  -- SOAL
  INSERT INTO soal (id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin, tingkat, guru_id) VALUES
    (v_s1_id, 'Berapa hasil dari 7 × 8?',                         '🔢', 'Matematika',      'pilihan_ganda', '["54","56","64","48"]',                           '56',          100, 'mudah',  v_guru_id),
    (v_s2_id, 'Berapa hasil 144 ÷ 12?',                           '➗', 'Matematika',      'pilihan_ganda', '["11","13","12","14"]',                           '12',          100, 'mudah',  v_guru_id),
    (v_s3_id, 'Hewan apa yang bernapas dengan insang?',           '🐟', 'IPA',             'pilihan_ganda', '["Katak","Ikan","Buaya","Lumba-lumba"]',          'Ikan',        100, 'mudah',  v_guru_id),
    (v_s4_id, 'Apa nama proses tumbuhan membuat makanan sendiri?','🌿', 'IPA',             'pilihan_ganda', '["Respirasi","Transpirasi","Fotosintesis","Evaporasi"]', 'Fotosintesis', 100, 'sedang', v_guru_id),
    (v_s5_id, 'Apa ibu kota provinsi Jawa Timur?',                '🗺️', 'IPS',             'pilihan_ganda', '["Bandung","Semarang","Surabaya","Malang"]',      'Surabaya',    100, 'mudah',  v_guru_id);

  -- QUIZ
  INSERT INTO quiz (id, judul, deskripsi, mapel, guru_id, kelas_id, durasi) VALUES
    (v_quiz_id, 'Quiz Campuran Minggu 1', 'Soal campuran Matematika, IPA, dan IPS', 'Umum', v_guru_id, v_kelas_id, 15);

  -- RELASI QUIZ - SOAL
  INSERT INTO quiz_soal (quiz_id, soal_id, urutan) VALUES
    (v_quiz_id, v_s1_id, 1),
    (v_quiz_id, v_s2_id, 2),
    (v_quiz_id, v_s3_id, 3),
    (v_quiz_id, v_s4_id, 4),
    (v_quiz_id, v_s5_id, 5);

  -- NOTIFIKASI
  INSERT INTO notifikasi (user_id, judul, pesan) VALUES
    (v_murid1_id, '🎉 Selamat Datang!', 'Halo Andi! Selamat bergabung di BelajarSeru!'),
    (v_murid1_id, '📚 Materi Baru!',   'Guru menambahkan materi: "Perkalian & Pembagian"'),
    (v_murid1_id, '⚡ Quiz Baru!',      'Ada quiz baru: "Quiz Campuran Minggu 1". Ayo kerjakan!');

END $$;

-- Selesai! Cek hasilnya di Table Editor Supabase.
-- Akun demo:
--   Guru  : guru@demo.com  / guru123
--   Murid : andi@demo.com  / murid123
