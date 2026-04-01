-- =====================================================
--  MIGRATION: Tambah tabel pesan_kelas (chat kelas)
--  Jalankan di Supabase > SQL Editor > New Query
-- =====================================================

CREATE TABLE IF NOT EXISTS pesan_kelas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kelas_id    UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  pengirim_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  isi         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pesan_kelas_kelas_id ON pesan_kelas(kelas_id);
