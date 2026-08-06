-- 011_reopen_tugas
-- Fitur "Aktifkan Kembali" (reopen) tugas/kuis yang lewat tenggat (deadline).
-- Hanya MENAMBAH tabel baru untuk audit trail — TIDAK mengubah tabel
-- quiz/submission/hasil existing (non-destruktif).

CREATE TABLE IF NOT EXISTS quiz_reopen_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id       UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  guru_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deadline_lama TIMESTAMPTZ,
  deadline_baru TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_reopen_log_quiz  ON quiz_reopen_log(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_reopen_log_guru  ON quiz_reopen_log(guru_id);
