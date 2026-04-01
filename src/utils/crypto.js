/**
 * src/utils/crypto.js
 * Enkripsi AES-256-GCM untuk pesan yang disimpan di database.
 * Pesan di-encrypt sebelum INSERT dan di-decrypt setelah SELECT,
 * sehingga data di Supabase tidak bisa dibaca tanpa ENCRYPTION_KEY.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX   = process.env.ENCRYPTION_KEY || '';

// Validasi key saat startup
if (!KEY_HEX || KEY_HEX.length !== 64) {
  console.warn('⚠️  ENCRYPTION_KEY tidak valid di .env — pesan TIDAK terenkripsi!');
  console.warn('   Jalankan perintah ini untuk generate key baru:');
  console.warn('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

const KEY = KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, 'hex') : null;

/**
 * Enkripsi teks plaintext.
 * Format hasil: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
function encrypt(plaintext) {
  if (!KEY || !plaintext) return plaintext;
  const iv      = crypto.randomBytes(12);                          // 96-bit IV untuk GCM
  const cipher  = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag     = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/**
 * Dekripsi teks yang sudah dienkripsi dengan encrypt().
 * Mengembalikan teks asli. Jika format tidak cocok (pesan lama/plaintext),
 * mengembalikan teks apa adanya — backward-compatible.
 */
function decrypt(encryptedText) {
  if (!KEY || !encryptedText) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText; // pesan lama, belum dienkripsi
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const iv       = Buffer.from(ivHex,   'hex');
    const tag      = Buffer.from(tagHex,  'hex');
    const data     = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  } catch {
    return encryptedText; // gagal decrypt — kembalikan apa adanya
  }
}

module.exports = { encrypt, decrypt };
