// ============================================================
//  src/utils/fileType.js
//  Deteksi tipe file dari "magic bytes" (isi nyata), BUKAN dari
//  Content-Type yang dikirim klien (yang bisa dipalsukan).
//  Dipakai untuk memvalidasi upload Multer (materi & submission).
//  Tanpa dependency eksternal.
// ============================================================

// Cocokkan signature di awal buffer. Mengembalikan MIME kanonik atau null.
function sniffMime(buf) {
  if (!buf || buf.length < 4) return null;
  const b = buf;

  // PDF — "%PDF"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  // JPEG — FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  // PNG — 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  // GIF — "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  // WEBP — "RIFF"...."WEBP"
  if (b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  // WEBM / Matroska — 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  // MP4 / ISO BMFF — "ftyp" pada offset 4
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
  // DOC (OLE2) — D0 CF 11 E0
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'application/msword';
  // ZIP (mencakup DOCX) — "PK\x03\x04"
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'application/zip';
  // RAR
  if (b.length >= 6 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 && b[4] === 0x1a && b[5] === 0x07) return 'application/x-rar-compressed';
  // 7z
  if (b.length >= 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c) return 'application/x-7z-compressed';
  // Text
  let isText = true;
  for (let i = 0; i < Math.min(b.length, 128); i++) {
    if (b[i] < 9 || (b[i] > 13 && b[i] < 32)) { isText = false; break; }
  }
  if (isText && b[0] !== 0x3c) return 'text/plain';

  return null;
}

// Ekstensi aman berdasarkan MIME terdeteksi (mengabaikan nama file user).
const EXT_FOR_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/msword': 'doc',
  'application/zip': 'docx',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'text/plain': 'txt'
};

// Validasi buffer: kembalikan { ok, mime } jika isi nyata termasuk allowed.
function validateUpload(buffer, allowedMimes) {
  const mime = sniffMime(buffer);
  if (!mime || !allowedMimes.includes(mime)) return { ok: false, mime };
  return { ok: true, mime };
}

module.exports = { sniffMime, validateUpload, EXT_FOR_MIME };
