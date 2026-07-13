// =====================================================
//  seed_dummy.js — Isi akun & kelas DUMMY untuk uji lokal
//  Supaya bisa login TANPA OTP/email (login hanya cek email+password).
//
//  Prasyarat:
//   - .env terisi (SUPABASE_URL, SUPABASE_SERVICE_KEY, dll). Lihat .env.example
//   - schema.sql sudah dijalankan di Supabase
//   - migration_kode_guru.sql dijalankan (untuk akun kepala_sekolah)
//
//  Jalankan:  node seed_dummy.js
//  Idempoten — aman dijalankan berkali-kali (lewati yang sudah ada).
//
//  ⚠️ Pakai project Supabase TERPISAH untuk uji lokal bila tak mau data
//     dummy masuk ke database produksi.
// =====================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./src/supabase');

const PASSWORD = 'Dev12345'; // password sama untuk semua akun dummy

const AKUN = [
  { nama: 'Guru Dummy',   email: 'dev.guru@local.test',   role: 'guru',           avatar: '👩‍🏫' },
  { nama: 'Murid Dummy',  email: 'dev.murid@local.test',  role: 'murid',          avatar: '🦁' },
  { nama: 'Kepala Dummy', email: 'dev.kepala@local.test', role: 'kepala_sekolah', avatar: '🏫' },
];

async function findOrCreateUser({ nama, email, role, avatar }) {
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) {
    console.log(`  • ${role.padEnd(14)} sudah ada: ${email}`);
    return existing.id;
  }
  const id = uuidv4();
  const { error } = await supabase.from('users').insert({
    id, nama, email, password: bcrypt.hashSync(PASSWORD, 10),
    role, avatar, xp: 0, level: 1,
  });
  if (error) {
    console.warn(`  ✗ gagal buat ${role} (${email}): ${error.message}`);
    if (role === 'kepala_sekolah') console.warn('    → mungkin migration_kode_guru.sql belum dijalankan (role belum diizinkan).');
    return null;
  }
  console.log(`  ✓ ${role.padEnd(14)} dibuat : ${email}`);
  return id;
}

async function main() {
  console.log('\nSeed akun dummy KitaBelajar (uji lokal)\n');

  const ids = {};
  for (const akun of AKUN) ids[akun.role] = await findOrCreateUser(akun);

  // Kelas demo milik guru dummy + daftarkan murid dummy
  if (ids.guru) {
    const KODE = 'DEVKLS';
    let { data: kelas } = await supabase.from('kelas').select('id').eq('kode_akses', KODE).maybeSingle();
    if (!kelas) {
      const kelasId = uuidv4();
      const { error } = await supabase.from('kelas').insert({
        id: kelasId, nama: 'Kelas Demo Lokal', tahun_ajar: '2025/2026',
        mapel: 'Umum', guru_id: ids.guru, kode_akses: KODE,
      });
      if (error) console.warn(`  ✗ gagal buat kelas: ${error.message}`);
      else { kelas = { id: kelasId }; console.log(`  ✓ kelas demo dibuat (kode: ${KODE})`); }
    } else {
      console.log(`  • kelas demo sudah ada (kode: ${KODE})`);
    }

    if (kelas && ids.murid) {
      const { data: enrolled } = await supabase.from('kelas_murid')
        .select('murid_id').eq('kelas_id', kelas.id).eq('murid_id', ids.murid).maybeSingle();
      if (!enrolled) {
        await supabase.from('kelas_murid').insert({ kelas_id: kelas.id, murid_id: ids.murid });
        console.log('  ✓ murid dummy didaftarkan ke kelas demo');
      }
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(' Login di http://localhost:3000 (password sama):');
  console.log(`   Guru   → dev.guru@local.test   / ${PASSWORD}`);
  console.log(`   Murid  → dev.murid@local.test  / ${PASSWORD}`);
  console.log(`   Kepala → dev.kepala@local.test / ${PASSWORD}`);
  console.log('──────────────────────────────────────────\n');
  process.exit(0);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
