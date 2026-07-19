-- =====================================================
--  DIAGNOSTIK: Cek status RLS semua tabel
--  Jalankan di Supabase > SQL Editor > New Query
--  untuk melihat tabel mana yang sudah/belum RLS
-- =====================================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_aktif,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
