-- 005_messaging
-- Consolidated from: migration_pesan_private, migration_pesan_kelas, migration_fixes_v3

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

ALTER TABLE pesan_private ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS pesan_kelas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kelas_id    UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  pengirim_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  isi         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pesan_kelas_kelas_id ON pesan_kelas(kelas_id);
