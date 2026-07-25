-- =====================================================
--  MIGRATION: Analitik Guru — pelacakan login murid
--  Jalankan di Supabase > SQL Editor > New Query
--
--  Catatan jujur: kolom ini mulai kosong (NULL) untuk semua
--  user lama. Data "terakhir aktif" baru mulai terisi sejak
--  migration ini dijalankan — tren aktivitas baru bisa dilihat
--  setelah beberapa minggu data terkumpul, bukan langsung hari ini.
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);

-- Selesai. Cek: SELECT id, nama, last_login_at FROM users LIMIT 5;
