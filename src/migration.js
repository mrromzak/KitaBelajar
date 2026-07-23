require('dotenv').config();

async function runMigrations() {
  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) {
    console.log('ℹ️  DATABASE_URL tidak diset — skip migrasi. Jalankan SQL manual jika perlu: ALTER TABLE quiz ADD COLUMN IF NOT EXISTS max_attempt INTEGER DEFAULT 1;');
    return;
  }

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    const client = await pool.connect();

    console.log('📦 Menjalankan migrasi database...');
    await client.query('ALTER TABLE quiz ADD COLUMN IF NOT EXISTS max_attempt INTEGER DEFAULT 1;');
    console.log('✅ Migrasi selesai: kolom max_attempt ditambahkan ke tabel quiz.');

    client.release();
    await pool.end();
  } catch (e) {
    console.warn('⚠️  Migrasi gagal, jalankan SQL manual:', e.message.slice(0, 120));
  }
}

module.exports = runMigrations;
