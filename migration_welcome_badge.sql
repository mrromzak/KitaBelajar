-- ============================================================
-- MIGRATION: Welcome Badge + Fix Duplicate Achievement Rows
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Hapus baris duplikat di misi_murid (achievement / periode IS NULL) ──
-- Simpan hanya 1 baris per (murid_id, misi_id) — pilih yang paling progresif
DELETE FROM misi_murid
WHERE periode IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON (murid_id, misi_id) id
    FROM misi_murid
    WHERE periode IS NULL
    ORDER BY murid_id, misi_id,
             selesai DESC,          -- utamakan yang sudah selesai
             progres DESC,          -- lalu yang progresnya paling tinggi
             created_at DESC        -- lalu yang paling baru
  );

-- ── 2. Buat unique index (setelah duplikat dihapus) ────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_misi_murid_unique_achievement
  ON misi_murid(murid_id, misi_id)
  WHERE periode IS NULL;

-- ── 3. Tambah badge "Selamat Datang" ───────────────────────
INSERT INTO badges (id, nama, deskripsi, icon, tipe) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Selamat Datang', 'Selamat bergabung di KitaBelajar!', '🎊', 'spesial')
ON CONFLICT (id) DO NOTHING;
