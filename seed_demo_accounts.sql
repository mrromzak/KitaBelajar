-- =====================================================
--  seed_demo_accounts.sql — Akun DEMO guru & murid
--  Jalankan di Supabase → SQL Editor → New Query.
--
--  Akun ini bisa LOGIN tanpa OTP/email (login hanya cek email+password),
--  jadi tetap bisa diakses walau pengiriman OTP via Brevo sedang bermasalah.
--  Idempoten — aman dijalankan berulang kali (ON CONFLICT DO NOTHING).
--
--  KREDENSIAL (bagikan ke yang perlu akses, mis. dosen penguji):
--    Guru  → guru.demo@kitabelajar.id   / Guru12345
--    Murid → murid.demo@kitabelajar.id  / Murid12345
-- =====================================================

-- 1) Akun guru & murid demo (password sudah di-hash bcrypt)
INSERT INTO users (id, nama, email, password, role, avatar, kelas, xp, level) VALUES
  (uuid_generate_v4(), 'Guru Demo',  'guru.demo@kitabelajar.id',  '$2a$10$3tnTD7JQVoqx7nApLGJbf.05giYanXZS1VQURxoBlRVuMOUhikCd.', 'guru',  '👩‍🏫', NULL, 0, 1),
  (uuid_generate_v4(), 'Murid Demo', 'murid.demo@kitabelajar.id', '$2a$10$eE.oQ0j/bj73yGzP9a/uMespLmQdZsw2S3WAXAau6UFMnyNtjxoO2', 'murid', '🦁',  '4A', 0, 1)
ON CONFLICT (email) DO NOTHING;

-- 2) Kelas demo milik guru demo (kode akses: DEMO01)
INSERT INTO kelas (id, nama, tahun_ajar, mapel, guru_id, kode_akses)
SELECT uuid_generate_v4(), 'Kelas Demo', '2025/2026', 'Umum', u.id, 'DEMO01'
FROM users u WHERE u.email = 'guru.demo@kitabelajar.id'
ON CONFLICT (kode_akses) DO NOTHING;

-- 3) Daftarkan murid demo ke kelas demo
INSERT INTO kelas_murid (kelas_id, murid_id)
SELECT k.id, u.id
FROM kelas k, users u
WHERE k.kode_akses = 'DEMO01' AND u.email = 'murid.demo@kitabelajar.id'
ON CONFLICT DO NOTHING;

-- Selesai. Login di aplikasi pakai kredensial di atas (tanpa OTP).
