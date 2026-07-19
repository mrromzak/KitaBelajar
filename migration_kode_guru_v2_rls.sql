-- =====================================================
--  MIGRATION: RLS Policies — Kode Guru Permanen (v2)
--  Jalankan di Supabase > SQL Editor > New Query
--  SETELAH migration_kode_guru_v2.sql
--
--  Strategi RLS:
--  - Service role key (backend) → bypass RLS otomatis (Supabase default)
--  - Anon / authenticated key → TIDAK bisa akses langsung dari browser
--  - Semua akses data hanya lewat backend (Node.js) dengan service key
--
--  Ini adalah pola "backend-only" yang paling aman untuk data sensitif.
-- =====================================================

-- ── 1. Aktifkan RLS pada tabel kode_guru ─────────────────────
ALTER TABLE kode_guru ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "kode_guru_service_only" ON kode_guru;
DROP POLICY IF EXISTS "kode_guru_no_direct_access" ON kode_guru;

-- Tidak ada policy untuk anon/authenticated → akses langsung dari browser DITOLAK.
-- Service role key (dipakai backend) bypass RLS secara otomatis.
-- Ini berarti: hanya backend yang bisa baca/tulis kode_guru.

-- ── 2. Aktifkan RLS pada tabel kode_guru_login_log ───────────
ALTER TABLE kode_guru_login_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kode_guru_login_log_service_only" ON kode_guru_login_log;
DROP POLICY IF EXISTS "kode_guru_login_log_no_direct_access" ON kode_guru_login_log;

-- Sama: tidak ada policy → anon/authenticated tidak bisa akses langsung.

-- ── 3. RLS pada tabel users (untuk role kepala_sekolah & guru) ─
--  CATATAN: Jika tabel users sudah punya RLS dari schema utama,
--  tambahkan policy berikut tanpa menghapus yang sudah ada.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Hapus policy prototype jika ada (agar tidak duplikat)
DROP POLICY IF EXISTS "users_kepala_read_own" ON users;
DROP POLICY IF EXISTS "users_guru_read_own"   ON users;

-- Kepala sekolah bisa baca data dirinya sendiri (via JWT auth Supabase)
-- CATATAN: Ini hanya berlaku jika pakai Supabase Auth (bukan custom JWT).
-- Prototype pakai custom JWT → akses users hanya via service key (backend).
-- Policy ini sebagai dokumentasi; service key tetap bypass.

-- ── 4. Verifikasi ────────────────────────────────────────────
-- Jalankan query ini untuk memastikan RLS aktif:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('kode_guru', 'kode_guru_login_log', 'users');
--
-- Hasilnya harus: rowsecurity = true untuk semua tabel di atas.

-- ── 5. Catatan penting ────────────────────────────────────────
-- Backend (Node.js) menggunakan SUPABASE_SERVICE_KEY yang:
--   - Bypass RLS secara otomatis (Supabase behavior)
--   - TIDAK boleh di-expose ke browser/frontend
--   - Hanya ada di .env server-side
--
-- Frontend (browser) TIDAK punya akses langsung ke Supabase.
-- Semua request browser → backend API → Supabase (via service key).
--
-- Ini adalah arsitektur yang benar untuk data sensitif seperti kode guru.
