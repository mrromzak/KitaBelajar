-- =====================================================
--  MIGRATION: code_guru untuk Guru Lama (Legacy Support)
--  Jalankan di Supabase > SQL Editor > New Query
--
--  Perubahan:
--  1. Tambah kolom `code_guru` TEXT UNIQUE di tabel users
--     (hanya untuk role='guru'; NULL untuk role lain)
--  2. Tambah kolom `code_guru_generated_at` TIMESTAMPTZ
--  3. Auto-generate code_guru untuk semua guru lama
--     yang belum punya (code_guru IS NULL)
--  4. Index untuk lookup cepat
--
--  Flow:
--  - Guru lama: code_guru di-generate otomatis oleh migration ini
--  - Guru baru (setelah fitur): code_guru di-generate saat register
--  - Login guru lama: skip validasi code_guru (sudah punya akun)
--  - Login guru baru: wajib code_guru (kode undangan kepala sekolah)
--  - Lihat code_guru di profil: wajib verifikasi email (OTP)
-- =====================================================

-- 1. Tambah kolom code_guru ke tabel users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS code_guru TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS code_guru_generated_at TIMESTAMPTZ;

-- 2. Index untuk lookup code_guru
CREATE INDEX IF NOT EXISTS idx_users_code_guru ON users(code_guru) WHERE code_guru IS NOT NULL;

-- 3. Fungsi helper: generate kode acak 8 karakter (charset tanpa ambiguitas)
CREATE OR REPLACE FUNCTION generate_code_guru_value()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  charset TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result  TEXT := '';
  i       INTEGER;
  attempt INTEGER := 0;
  candidate TEXT;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;

    -- Pastikan unik di kolom users.code_guru
    IF NOT EXISTS (SELECT 1 FROM users WHERE code_guru = candidate) THEN
      RETURN candidate;
    END IF;

    attempt := attempt + 1;
    IF attempt > 20 THEN
      -- Fallback: tambah prefix timestamp untuk memastikan unik
      RETURN 'G' || to_char(NOW(), 'SSMS') || substr(candidate, 1, 3);
    END IF;
  END LOOP;
END;
$$;

-- 4. Auto-generate code_guru untuk semua guru lama yang belum punya
DO $$
DECLARE
  guru_rec RECORD;
  new_code TEXT;
BEGIN
  FOR guru_rec IN
    SELECT id FROM users WHERE role = 'guru' AND code_guru IS NULL
  LOOP
    new_code := generate_code_guru_value();
    UPDATE users
       SET code_guru = new_code,
           code_guru_generated_at = NOW()
     WHERE id = guru_rec.id;
  END LOOP;
END;
$$;

-- 5. RPC: generate_code_guru_for_user(p_user_id UUID)
--    Dipanggil backend saat guru baru register (jika belum punya code_guru).
CREATE OR REPLACE FUNCTION generate_code_guru_for_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  existing TEXT;
BEGIN
  -- Cek apakah sudah punya
  SELECT code_guru INTO existing FROM users WHERE id = p_user_id;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  new_code := generate_code_guru_value();

  UPDATE users
     SET code_guru = new_code,
         code_guru_generated_at = NOW()
   WHERE id = p_user_id;

  RETURN new_code;
END;
$$;

-- 6. Verifikasi hasil migration
SELECT
  COUNT(*) FILTER (WHERE role = 'guru' AND code_guru IS NOT NULL) AS guru_dengan_code,
  COUNT(*) FILTER (WHERE role = 'guru' AND code_guru IS NULL)     AS guru_tanpa_code,
  COUNT(*) FILTER (WHERE role = 'guru')                           AS total_guru
FROM users;

-- Selesai!
-- Setelah ini, deploy ulang backend agar:
--   - Login guru lama: skip validasi code_guru
--   - Register guru baru: auto-generate code_guru
--   - Profil guru: tampilkan code_guru setelah verifikasi OTP
