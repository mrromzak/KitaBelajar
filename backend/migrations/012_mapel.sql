-- 012_mapel
-- Tabel mapel milik guru agar daftar mata pelajaran tersinkron lintas device.

CREATE TABLE IF NOT EXISTS mapel (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guru_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '📌',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapel_guru_id ON mapel(guru_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mapel_guru_nama ON mapel(guru_id, lower(nama));
