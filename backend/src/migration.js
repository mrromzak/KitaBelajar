require('dotenv').config();

async function runMigrations() {
  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) {
    console.log('ℹ️  DATABASE_URL tidak diset — skip migrasi.');
    return;
  }

  const fs = require('fs');
  const path = require('path');
  const dns = require('dns');
  const { Pool } = require('pg');

  // Resolve hostname manual untuk IPv6-only host
  const urlObj = new URL(DB_URL);
  const hostname = urlObj.hostname;

  let resolvedUrl = DB_URL;
  try {
    const addrs = await dns.promises.resolve6(hostname);
    if (addrs && addrs.length > 0) {
      resolvedUrl = DB_URL.replace(hostname, `[${addrs[0]}]`);
      console.log(`🔗  Resolve ${hostname} → ${addrs[0]}`);
    }
  } catch {
    // Fallback: coba resolve4 atau langsung pakai hostname asli
    try {
      const addrs = await dns.promises.resolve4(hostname);
      if (addrs && addrs.length > 0) {
        resolvedUrl = DB_URL.replace(hostname, addrs[0]);
        console.log(`🔗  Resolve ${hostname} → ${addrs[0]}`);
      }
    } catch {
      console.log(`ℹ️  Tidak bisa resolve ${hostname}, coba langsung...`);
    }
  }

  const pool = new Pool({
    connectionString: resolvedUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  const client = await pool.connect();

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    const { rows: applied } = await client.query('SELECT name FROM _migrations ORDER BY name');
    const appliedSet = new Set(applied.map(r => r.name));

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️  Folder migrations/ tidak ditemukan.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️  Tidak ada file migrasi.');
      return;
    }

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏭  ${file} — sudah dijalankan`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`▶  Menjalankan ${file}...`);
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`✔  ${file} selesai`);
    }

    console.log('✅ Semua migrasi up-to-date');
  } catch (err) {
    console.error('❌ Migrasi gagal:', err.message.slice(0, 300));
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = runMigrations;
