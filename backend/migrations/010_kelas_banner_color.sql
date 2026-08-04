-- 010_kelas_banner_color
-- Menambahkan kolom banner_color ke tabel kelas untuk menyimpan
-- pilihan warna preset banner (misal 'bg-c1', 'bg-c3', dst).
-- Kolom cover_url (untuk fitur upload gambar banner) sudah dihapus
-- dari frontend dan tidak pernah dipakai di production — jangan dipakai lagi.

ALTER TABLE kelas ADD COLUMN IF NOT EXISTS banner_color TEXT;
