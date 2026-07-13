// =====================================================
//  seed_kepala.js — Bootstrap akun KEPALA SEKOLAH (Fase 0)
//  "Admin buat manual": dijalankan SEKALI untuk membuat akun
//  kepala sekolah yang berwenang menerbitkan kode undangan guru.
//
//  Prasyarat: jalankan migration_kode_guru.sql di Supabase dulu,
//  dan pastikan .env berisi SUPABASE_URL + SUPABASE_SERVICE_KEY.
//
//  Cara pakai:
//    node seed_kepala.js "<nama>" <email> <password>
//  atau lewat env:
//    KEPALA_NAMA="..." KEPALA_EMAIL="..." KEPALA_PASS="..." node seed_kepala.js
// =====================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const supabase = require('./src/supabase');

const [, , argNama, argEmail, argPass] = process.argv;
const nama = argNama || process.env.KEPALA_NAMA;
const emailRaw = argEmail || process.env.KEPALA_EMAIL;
const password = argPass || process.env.KEPALA_PASS;

function gagal(msg) {
  console.error('❌ ' + msg);
  console.error('\nCara pakai: node seed_kepala.js "<nama>" <email> <password>');
  process.exit(1);
}

function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(pw)) return 'Password harus mengandung huruf kapital.';
  if (!/[0-9]/.test(pw)) return 'Password harus mengandung angka.';
  return null;
}

async function main() {
  if (!nama || !emailRaw || !password)
    gagal('Nama, email, dan password wajib diisi.');

  const email = (validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase().trim());
  if (!validator.isEmail(email)) gagal('Format email tidak valid.');

  const pwErr = validatePassword(password);
  if (pwErr) gagal(pwErr);

  // Jangan timpa akun yang sudah ada.
  const { data: existing, error: cekErr } = await supabase
    .from('users').select('id, role').eq('email', email).maybeSingle();
  if (cekErr) gagal('Gagal cek email: ' + cekErr.message);
  if (existing) gagal(`Email "${email}" sudah terdaftar (role: ${existing.role}). Batal.`);

  const id = uuidv4();
  const { error } = await supabase.from('users').insert({
    id,
    nama: String(nama).trim().slice(0, 100),
    email,
    password: bcrypt.hashSync(password, 10),
    role: 'kepala_sekolah',
    avatar: '🏫',
    xp: 0,
    level: 1
  });
  if (error) gagal('Gagal membuat akun: ' + error.message);

  console.log('✅ Akun kepala sekolah dibuat.');
  console.log(`   Nama  : ${nama}`);
  console.log(`   Email : ${email}`);
  console.log(`   Role  : kepala_sekolah`);
  console.log('\nSimpan kredensial ini dengan aman. Login lalu terbitkan kode guru.');
  process.exit(0);
}

main().catch((e) => gagal(e.message));
