// smoke_test.js — test semua endpoint utama
require('dotenv').config();
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d.slice(0, 120) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  let token = null;
  let pass = 0, fail = 0;
  const results = [];

  function check(label, res, expectStatus, expectField) {
    const statusOk = res.status === expectStatus;
    const fieldOk  = !expectField || (res.body && res.body[expectField] !== undefined);
    const ok = statusOk && fieldOk;
    const icon = ok ? '✅ PASS' : '❌ FAIL';
    const line = `${icon} [${res.status}] ${label}`;
    results.push(line);
    if (!ok) results.push(`   → body: ${JSON.stringify(res.body).slice(0, 200)}`);
    ok ? pass++ : fail++;
    return ok;
  }

  // ── 1. Halaman utama ─────────────────────────────────────
  let r = await req('GET', '/', null, null);
  check('GET / (halaman utama HTML)', r, 200);

  // ── 2. Login kepala ──────────────────────────────────────
  r = await req('POST', '/api/auth/login', {
    email:    process.env.KEPALA_EMAIL || 'kepala@sekolah.id',
    password: process.env.KEPALA_PASS  || 'KepalaProto2024!'
  });
  const loginOk = check('POST /api/auth/login (kepala)', r, 200, 'token');
  if (loginOk) token = r.body.token;

  // ── 3. Auth profile ──────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/auth/profile', null, token);
    check('GET /api/auth/profile', r, 200, 'data');  // route mengembalikan { data: {...} }
  }

  // ── 4. Dashboard ─────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/dashboard', null, token);
    check('GET /api/dashboard', r, 200);
  }

  // ── 5. Kelas ─────────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/kelas', null, token);
    check('GET /api/kelas', r, 200);
  }

  // ── 6. Materi ────────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/materi', null, token);
    check('GET /api/materi', r, 200);
  }

  // ── 7. Soal latihan (bukan guruOnly) ─────────────────────
  if (token) {
    r = await req('GET', '/api/soal/latihan', null, token);
    check('GET /api/soal/latihan', r, 200);
  }

  // ── 8. Quiz ──────────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/quiz', null, token);
    check('GET /api/quiz', r, 200);
  }

  // ── 9. Kode guru ─────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/kode-guru', null, token);
    check('GET /api/kode-guru', r, 200);
  }

  // ── 10. Notifikasi ───────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/notifikasi', null, token);
    check('GET /api/notifikasi', r, 200);
  }

  // ── 11. Misi ─────────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/misi', null, token);
    check('GET /api/misi', r, 200);
  }

  // ── 12. Badges ───────────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/misi/badges', null, token);
    check('GET /api/misi/badges', r, 200);
  }

  // ── 13. Latihan soal (route di soal.js) ──────────────────
  if (token) {
    r = await req('GET', '/api/soal/latihan/mapel', null, token);
    check('GET /api/soal/latihan/mapel', r, 200);
  }

  // ── 14. Chat inbox ───────────────────────────────────────
  if (token) {
    r = await req('GET', '/api/chat/inbox', null, token);
    check('GET /api/chat/inbox', r, 200);
  }

  // ── 15. Orangtua anak (kepala → 403 ok) ──────────────────
  if (token) {
    r = await req('GET', '/api/orangtua/anak', null, token);
    // kepala bukan orangtua, expect 403
    const ok = [200, 403].includes(r.status);
    const icon = ok ? '✅ PASS' : '❌ FAIL';
    results.push(`${icon} [${r.status}] GET /api/orangtua/anak (403 ok untuk kepala)`);
    ok ? pass++ : fail++;
  }

  // ── 16. Tanpa token → 401 ────────────────────────────────
  r = await req('GET', '/api/dashboard', null, null);
  check('GET /api/dashboard (no token → 401)', r, 401);

  // ── 17. Password salah → 401 ─────────────────────────────
  r = await req('POST', '/api/auth/login', { email: 'kepala@sekolah.id', password: 'salah123' });
  check('POST /api/auth/login (password salah → 401)', r, 401);

  // ── 18. Route tidak ada → 404 ────────────────────────────
  r = await req('GET', '/api/tidak-ada', null, null);
  check('GET /api/tidak-ada (→ 404)', r, 404);

  // ── Hasil ────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  results.forEach(l => console.log(l));
  console.log('══════════════════════════════════════════');
  console.log(`\nHasil: ${pass} PASS, ${fail} FAIL dari ${pass + fail} test`);
  if (fail === 0) console.log('🎉 Semua endpoint berjalan normal!');
  else console.log('⚠️  Ada ' + fail + ' endpoint yang perlu dicek.');
}

run().catch(console.error);
