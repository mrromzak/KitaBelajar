-- ── Daily Reward: Badge spesial hari ke-7 ──────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'Seminggu Penuh', 'Klaim hadiah harian 7 hari berturut-turut!', '🌟', 'spesial')
ON CONFLICT (id) DO NOTHING;

-- ── Tabel daily_reward_klaim ────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reward_klaim (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal    DATE        NOT NULL,
  hari_ke    INTEGER     NOT NULL CHECK (hari_ke BETWEEN 1 AND 7),
  xp_dapat   INTEGER     NOT NULL DEFAULT 0,
  badge_id   UUID        REFERENCES badges(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (murid_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_daily_reward_murid
  ON daily_reward_klaim (murid_id, tanggal DESC);