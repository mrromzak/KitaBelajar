-- =====================================================
--  MIGRATION: Tambah tabel pesan_private (DM guru-murid)
--  Jalankan di Supabase > SQL Editor > New Query
-- =====================================================

CREATE TABLE IF NOT EXISTS pesan_private (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dari_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ke_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  isi         TEXT NOT NULL,
  dibaca      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pesan_private_dari ON pesan_private(dari_id);
CREATE INDEX IF NOT EXISTS idx_pesan_private_ke   ON pesan_private(ke_id);
