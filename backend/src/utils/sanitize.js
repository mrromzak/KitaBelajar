// ============================================================
//  src/utils/sanitize.js
//  Sanitasi input teks pengguna untuk mencegah stored XSS.
//  Dipakai pada field yang nanti dirender di frontend
//  (nama, judul, dll) dan pada avatar (URL/emoji).
// ============================================================

// Karakter kontrol non-printable (ASCII 0x00-0x1F dan 0x7F).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
// Karakter berbahaya untuk teks: pembentuk tag & breakout atribut.
const TEXT_DANGER = new RegExp('[<>"`]', 'g');
// Untuk avatar: tambahan kutip tunggal & whitespace.
const AVATAR_DANGER = new RegExp('["\'<>`\\s]', 'g');

// Hapus karakter yang bisa membentuk tag HTML / keluar dari atribut.
// Apostrof (') sengaja DIBIARKAN pada teks agar nama seperti "O'Brien"
// tetap valid; frontend wajib tetap meng-escape saat render (defense-in-depth).
function cleanText(input, maxLen = 200) {
  if (input === undefined || input === null) return input;
  let s = String(input).replace(TEXT_DANGER, '').replace(CONTROL_CHARS, '').trim();
  if (maxLen) s = s.slice(0, maxLen);
  return s;
}

// Avatar boleh berupa emoji, data URI gambar, atau URL http(s).
// Buang karakter yang memungkinkan breakout atribut src="...".
function cleanAvatar(input, maxLen = 200000) {
  if (input === undefined || input === null) return input;
  let s = String(input).replace(AVATAR_DANGER, '').replace(CONTROL_CHARS, '').trim();
  if (maxLen) s = s.slice(0, maxLen);
  return s;
}

// ── Bcrypt-based kode_guru lookup ──────────────────────────────
// Digunakan ketika kode_guru sudah di-hash dengan bcrypt (bukan plaintext).
// Ambil semua kode aktif, lalu bcrypt-compare input sampai match.
async function findKodeGuruByBcrypt(supabase, inputKode, bcrypt) {
  if (!inputKode || typeof inputKode !== 'string') return null;
  const safeKode = inputKode.trim().toUpperCase();
  // Ambil semua kode yang statusnya active
  const { data: entries } = await supabase
    .from('kode_guru')
    .select('*')
    .eq('status', 'active');
  if (!entries || entries.length === 0) return null;
  for (const entry of entries) {
    try {
      if (await bcrypt.compare(safeKode, entry.kode)) {
        return entry;
      }
    } catch (_) { /* skip invalid hash */ }
  }
  return null;
}

module.exports = { cleanText, cleanAvatar, findKodeGuruByBcrypt };
