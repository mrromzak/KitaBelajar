-- ============================================================
-- MIGRATION: Tracking Waktu Belajar Aktif
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Tabel sesi_baca_materi ─────────────────────────────
CREATE TABLE IF NOT EXISTS sesi_baca_materi (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  materi_id           uuid REFERENCES materi(id) ON DELETE SET NULL,
  mulai_at            timestamptz NOT NULL DEFAULT now(),
  selesai_at          timestamptz,
  durasi_aktif_detik  integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sesi_belajar_murid
  ON sesi_baca_materi(murid_id, mulai_at DESC);

CREATE INDEX IF NOT EXISTS idx_sesi_belajar_abandoned
  ON sesi_baca_materi(murid_id)
  WHERE selesai_at IS NULL;

-- ── 2. Kolom akumulasi di users ──────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_waktu_belajar_detik integer DEFAULT 0;
