-- =====================================================
--  MIGRATION: RLS Lengkap — Semua Tabel KitaBelajar
--  Jalankan di Supabase > SQL Editor > New Query
--
--  Strategi per tabel:
--  ┌─────────────────────────────────────────────────┐
--  │  Backend (Node.js) pakai SUPABASE_SERVICE_KEY   │
--  │  → bypass RLS otomatis (Supabase default)       │
--  │  → TIDAK perlu policy khusus untuk backend      │
--  │                                                 │
--  │  Anon / authenticated (browser langsung)        │
--  │  → hanya boleh akses data miliknya sendiri      │
--  │  → via auth.uid() dari Supabase Auth            │
--  └─────────────────────────────────────────────────┘
--
--  CATATAN: Aplikasi KitaBelajar pakai custom JWT
--  (bukan Supabase Auth), sehingga auth.uid() tidak
--  tersedia untuk user biasa. Ini berarti semua akses
--  data dari browser harus lewat backend API.
--  Policy di bawah memastikan akses langsung browser
--  ke Supabase DITOLAK untuk semua tabel sensitif.
-- =====================================================

-- ══════════════════════════════════════════════════
--  HELPER: Aktifkan RLS + hapus policy lama
-- ══════════════════════════════════════════════════

-- ── 1. users ─────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_deny_direct" ON users;
-- Tidak ada policy → anon/authenticated tidak bisa akses langsung
-- Backend (service key) bypass RLS otomatis

-- ── 2. kelas ─────────────────────────────────────
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kelas_deny_direct" ON kelas;

-- ── 3. kelas_murid ───────────────────────────────
ALTER TABLE kelas_murid ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kelas_murid_deny_direct" ON kelas_murid;

-- ── 4. materi ────────────────────────────────────
ALTER TABLE materi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materi_deny_direct" ON materi;

-- ── 5. soal ──────────────────────────────────────
ALTER TABLE soal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soal_deny_direct" ON soal;

-- ── 6. quiz ──────────────────────────────────────
ALTER TABLE quiz ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz_deny_direct" ON quiz;

-- ── 7. quiz_soal ─────────────────────────────────
ALTER TABLE quiz_soal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz_soal_deny_direct" ON quiz_soal;

-- ── 8. hasil_quiz ────────────────────────────────
ALTER TABLE hasil_quiz ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hasil_quiz_deny_direct" ON hasil_quiz;

-- ── 9. detail_jawaban ────────────────────────────
ALTER TABLE detail_jawaban ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detail_jawaban_deny_direct" ON detail_jawaban;

-- ── 10. progres_materi ───────────────────────────
ALTER TABLE progres_materi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progres_materi_deny_direct" ON progres_materi;

-- ── 11. notifikasi ───────────────────────────────
ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifikasi_deny_direct" ON notifikasi;

-- ── 12. pesan_kelas ──────────────────────────────
ALTER TABLE pesan_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pesan_kelas_deny_direct" ON pesan_kelas;

-- ── 13. pesan_private ────────────────────────────
ALTER TABLE pesan_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pesan_private_deny_direct" ON pesan_private;

-- ── 14. tugas_submission ─────────────────────────
ALTER TABLE tugas_submission ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tugas_submission_deny_direct" ON tugas_submission;

-- ── 15. parent_student ───────────────────────────
ALTER TABLE parent_student ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parent_student_deny_direct" ON parent_student;

-- ── 16. push_subscriptions ───────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_deny_direct" ON push_subscriptions;

-- ── 17. badges ───────────────────────────────────
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_deny_direct" ON badges;

-- ── 18. murid_badges ─────────────────────────────
ALTER TABLE murid_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "murid_badges_deny_direct" ON murid_badges;

-- ── 19. misi_template ────────────────────────────
ALTER TABLE misi_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "misi_template_deny_direct" ON misi_template;

-- ── 20. misi_murid ───────────────────────────────
ALTER TABLE misi_murid ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "misi_murid_deny_direct" ON misi_murid;

-- ── 21. daily_reward_klaim ───────────────────────
ALTER TABLE daily_reward_klaim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_reward_klaim_deny_direct" ON daily_reward_klaim;

-- ── 22. kode_guru ────────────────────────────────
ALTER TABLE kode_guru ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kode_guru_deny_direct" ON kode_guru;

-- ── 23. kode_guru_login_log ──────────────────────
ALTER TABLE kode_guru_login_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kode_guru_login_log_deny_direct" ON kode_guru_login_log;

-- ── 24. error_logs ────────────────────────────────
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_deny_direct" ON error_logs;

-- ══════════════════════════════════════════════════
--  VERIFIKASI: Cek semua tabel sudah RLS ON
-- ══════════════════════════════════════════════════
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ══════════════════════════════════════════════════
--  CATATAN PENTING
-- ══════════════════════════════════════════════════
--
--  Setelah RLS aktif:
--  ✅ Backend (SUPABASE_SERVICE_KEY) → tetap bisa akses semua (bypass RLS)
--  ❌ Anon key dari browser → DITOLAK untuk semua tabel
--  ❌ Authenticated Supabase user → DITOLAK (karena tidak ada policy SELECT/INSERT)
--
--  Ini adalah pola "backend-only" yang paling aman:
--  Browser → Backend API (Node.js) → Supabase (service key)
--
--  Jika di masa depan ingin pakai Supabase Auth (bukan custom JWT),
--  tambahkan policy seperti:
--    CREATE POLICY "users_read_own" ON users
--      FOR SELECT USING (auth.uid() = id);
--  Tapi untuk sekarang, semua akses lewat backend saja.
