// ============================================================
//  prototype/kode-guru/prototype.test.js
//  Test otomatis (node:test) untuk membuktikan prototype berjalan.
//  Jalankan:  node --test prototype/kode-guru/
//
//  Cakupan:
//   A. Alur kepala: generate / list / revoke kode
//   B. Validate kode (valid / tidak ditemukan / kadaluarsa / dicabut)
//   C. Register guru: sukses, kuota, anti over-redeem KONKUREN
//   D. Keamanan: otorisasi peran, kepemilikan kode, tanpa bocor hash
// ============================================================

const test = require('node:test');
const assert = require('node:assert');
const { once } = require('node:events');
const bcrypt = require('bcryptjs');

const { createStore } = require('./store');
const { createApp } = require('./app');

const JWT_SECRET = 'test-secret-kode-guru';

// ── Fixture: store + app + server (port acak) ────────────────
async function startFixture() {
  const store = createStore();
  store.createKepala({
    nama: 'Kepala Sekolah',
    email: 'kepala@sekolah.id',
    passwordHash: bcrypt.hashSync('Kepala123', 10)
  });
  const app = createApp({ store, jwtSecret: JWT_SECRET });
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise((r) => server.close(r));
  return { store, server, base, close };
}

async function api(base, method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const loginKepala = (base) =>
  api(base, 'POST', '/api/auth/login', { body: { email: 'kepala@sekolah.id', password: 'Kepala123' } })
    .then((r) => r.json.token);

// ============================================================
//  A. Alur kepala sekolah
// ============================================================
test('kepala bisa login & generate kode', async () => {
  const f = await startFixture();
  try {
    const token = await loginKepala(f.base);
    assert.ok(token, 'kepala dapat token');

    const { status, json } = await api(f.base, 'POST', '/api/kode-guru', {
      token,
      body: { max_uses: 5, expires_in_days: 7, label: 'Guru IPA' }
    });
    assert.equal(status, 201);
    assert.equal(json.data.status, 'active');
    assert.equal(json.data.maxUses, 5);
    assert.equal(json.data.usedCount, 0);
    assert.equal(json.data.sisaKuota, 5);
    assert.equal(json.data.kode.length, 8);
  } finally {
    await f.close();
  }
});

test('daftar kode hanya menampilkan milik kepala penerbit', async () => {
  const f = await startFixture();
  try {
    // kepala kedua
    f.store.createKepala({ nama: 'Kepala B', email: 'kepalab@sekolah.id', passwordHash: bcrypt.hashSync('KepalaB123', 10) });
    const tokenA = await loginKepala(f.base);
    const tokenB = await api(f.base, 'POST', '/api/auth/login', { body: { email: 'kepalab@sekolah.id', password: 'KepalaB123' } }).then((r) => r.json.token);

    await api(f.base, 'POST', '/api/kode-guru', { token: tokenA, body: { max_uses: 1 } });
    const listA = await api(f.base, 'GET', '/api/kode-guru', { token: tokenA });
    const listB = await api(f.base, 'GET', '/api/kode-guru', { token: tokenB });

    assert.equal(listA.json.data.length, 1);
    assert.equal(listB.json.data.length, 0, 'kepala B tidak melihat kode kepala A');
  } finally {
    await f.close();
  }
});

// ============================================================
//  B. Validate kode
// ============================================================
test('validate: kode valid, tidak ditemukan, dan dicabut', async () => {
  const f = await startFixture();
  try {
    const token = await loginKepala(f.base);
    const gen = await api(f.base, 'POST', '/api/kode-guru', { token, body: { max_uses: 1 } });
    const kode = gen.json.data.kode;

    const ok = await api(f.base, 'POST', '/api/auth/validate-kode-guru', { body: { kode } });
    assert.equal(ok.json.valid, true);

    const notFound = await api(f.base, 'POST', '/api/auth/validate-kode-guru', { body: { kode: 'ZZZZZZZZ' } });
    assert.equal(notFound.json.valid, false);
    assert.match(notFound.json.pesan, /tidak ditemukan/i);

    // cabut → validate jadi invalid
    await api(f.base, 'PATCH', `/api/kode-guru/${gen.json.data.id}/revoke`, { token });
    const revoked = await api(f.base, 'POST', '/api/auth/validate-kode-guru', { body: { kode } });
    assert.equal(revoked.json.valid, false);
    assert.match(revoked.json.pesan, /dicabut/i);
  } finally {
    await f.close();
  }
});

test('store: kode kadaluarsa ditolak (unit, tanpa HTTP)', () => {
  const store = createStore();
  const { user } = store.createKepala({ nama: 'K', email: 'k@s.id', passwordHash: 'x' });
  const { code } = store.generateCode({ dibuatOleh: user.id, maxUses: 1, expiresInDays: 1 });
  // Paksa kadaluarsa dengan menggeser expiresAt ke masa lalu.
  store._getCodeById(code.id).expiresAt = Date.now() - 1000;

  const v = store.validateCode(code.kode);
  assert.equal(v.valid, false);
  assert.match(v.reason, /kadaluarsa/i);
  assert.equal(store.redeemCode(code.kode, 'guru-x').ok, false);
});

// ============================================================
//  C. Register guru + kuota + konkurensi
// ============================================================
test('register guru dengan kode valid → sukses & kuota terpakai', async () => {
  const f = await startFixture();
  try {
    const token = await loginKepala(f.base);
    const gen = await api(f.base, 'POST', '/api/kode-guru', { token, body: { max_uses: 3 } });
    const kode = gen.json.data.kode;

    const reg = await api(f.base, 'POST', '/api/auth/register-guru', {
      body: { nama: 'Bu Sari', email: 'sari@guru.id', password: 'Password123', kode }
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.json.user.role, 'guru');
    assert.equal(reg.json.user.passwordHash, undefined, 'hash password TIDAK bocor');

    // kuota berkurang
    const list = await api(f.base, 'GET', '/api/kode-guru', { token });
    assert.equal(list.json.data[0].usedCount, 1);
    assert.equal(list.json.data[0].sisaKuota, 2);

    // guru muncul di daftar guru, tanpa hash
    const guruList = await api(f.base, 'GET', '/api/kepala/guru', { token });
    assert.equal(guruList.json.data.length, 1);
    assert.equal(guruList.json.data[0].passwordHash, undefined);
  } finally {
    await f.close();
  }
});

test('kuota habis → pendaftar berikutnya ditolak', async () => {
  const f = await startFixture();
  try {
    const token = await loginKepala(f.base);
    const kode = (await api(f.base, 'POST', '/api/kode-guru', { token, body: { max_uses: 2 } })).json.data.kode;

    const r1 = await api(f.base, 'POST', '/api/auth/register-guru', { body: { nama: 'G1', email: 'g1@x.id', password: 'Password123', kode } });
    const r2 = await api(f.base, 'POST', '/api/auth/register-guru', { body: { nama: 'G2', email: 'g2@x.id', password: 'Password123', kode } });
    const r3 = await api(f.base, 'POST', '/api/auth/register-guru', { body: { nama: 'G3', email: 'g3@x.id', password: 'Password123', kode } });

    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    // Berurutan: pendaftar ke-3 ditolak di pra-cek validateCode (400).
    // (Penolakan saat race ada di tahap redeem atomik → diuji test konkuren.)
    assert.equal(r3.status, 400);
    assert.match(r3.json.pesan, /habis/i);
    assert.equal(f.store.stats().users, 1 /*kepala*/ + 2 /*guru*/);
  } finally {
    await f.close();
  }
});

test('KONKUREN: kuota tidak pernah terlampaui (anti over-redeem)', async () => {
  const f = await startFixture();
  try {
    const token = await loginKepala(f.base);
    const gen = await api(f.base, 'POST', '/api/kode-guru', { token, body: { max_uses: 3 } });
    const kode = gen.json.data.kode;

    // 12 pendaftaran paralel, email berbeda, kode sama.
    const attempts = Array.from({ length: 12 }, (_, i) =>
      api(f.base, 'POST', '/api/auth/register-guru', {
        body: { nama: `G${i}`, email: `g${i}@x.id`, password: 'Password123', kode }
      })
    );
    const results = await Promise.all(attempts);
    const sukses = results.filter((r) => r.status === 201).length;

    assert.equal(sukses, 3, 'tepat 3 yang berhasil, sesuai kuota');
    assert.equal(f.store.listGuru().length, 3);
    assert.equal(f.store.listRedemptions(gen.json.data.id).length, 3);
    assert.equal(f.store._getCodeById(gen.json.data.id).usedCount, 3);
  } finally {
    await f.close();
  }
});

// ============================================================
//  D. Keamanan & otorisasi
// ============================================================
test('register ditolak tanpa kode / password lemah', async () => {
  const f = await startFixture();
  try {
    const noKode = await api(f.base, 'POST', '/api/auth/register-guru', { body: { nama: 'X', email: 'x@x.id', password: 'Password123' } });
    assert.equal(noKode.status, 400);

    const token = await loginKepala(f.base);
    const kode = (await api(f.base, 'POST', '/api/kode-guru', { token, body: { max_uses: 1 } })).json.data.kode;
    const weak = await api(f.base, 'POST', '/api/auth/register-guru', { body: { nama: 'X', email: 'x@x.id', password: 'lemah', kode } });
    assert.equal(weak.status, 400);
    // kode TIDAK terpakai karena password ditolak lebih dulu
    assert.equal(f.store._getCodeById((await api(f.base, 'GET', '/api/kode-guru', { token })).json.data[0].id).usedCount, 0);
  } finally {
    await f.close();
  }
});

test('endpoint kepala butuh token & peran kepala_sekolah', async () => {
  const f = await startFixture();
  try {
    // tanpa token → 401
    const noAuth = await api(f.base, 'POST', '/api/kode-guru', { body: { max_uses: 1 } });
    assert.equal(noAuth.status, 401);

    // token guru → 403
    const token = await loginKepala(f.base);
    const kode = (await api(f.base, 'POST', '/api/kode-guru', { token, body: { max_uses: 1 } })).json.data.kode;
    await api(f.base, 'POST', '/api/auth/register-guru', { body: { nama: 'Guru', email: 'guru@x.id', password: 'Password123', kode } });
    const guruToken = await api(f.base, 'POST', '/api/auth/login', { body: { email: 'guru@x.id', password: 'Password123' } }).then((r) => r.json.token);

    const forbidden = await api(f.base, 'POST', '/api/kode-guru', { token: guruToken, body: { max_uses: 1 } });
    assert.equal(forbidden.status, 403);
  } finally {
    await f.close();
  }
});

test('kepala lain tidak bisa mencabut kode bukan miliknya', async () => {
  const f = await startFixture();
  try {
    f.store.createKepala({ nama: 'Kepala B', email: 'kepalab@sekolah.id', passwordHash: bcrypt.hashSync('KepalaB123', 10) });
    const tokenA = await loginKepala(f.base);
    const tokenB = await api(f.base, 'POST', '/api/auth/login', { body: { email: 'kepalab@sekolah.id', password: 'KepalaB123' } }).then((r) => r.json.token);

    const codeId = (await api(f.base, 'POST', '/api/kode-guru', { token: tokenA, body: { max_uses: 1 } })).json.data.id;
    const revoke = await api(f.base, 'PATCH', `/api/kode-guru/${codeId}/revoke`, { token: tokenB });
    assert.equal(revoke.status, 404);
    assert.match(revoke.json.pesan, /milikmu/i);
  } finally {
    await f.close();
  }
});

test('login tidak membocorkan hash & memberi pesan seragam', async () => {
  const f = await startFixture();
  try {
    const ok = await api(f.base, 'POST', '/api/auth/login', { body: { email: 'kepala@sekolah.id', password: 'Kepala123' } });
    assert.equal(ok.json.user.passwordHash, undefined);

    const salahPass = await api(f.base, 'POST', '/api/auth/login', { body: { email: 'kepala@sekolah.id', password: 'salah' } });
    const emailTakAda = await api(f.base, 'POST', '/api/auth/login', { body: { email: 'tidakada@x.id', password: 'apa saja' } });
    assert.equal(salahPass.status, 401);
    assert.equal(emailTakAda.status, 401);
    assert.equal(salahPass.json.pesan, emailTakAda.json.pesan, 'pesan seragam → tak bocorkan email terdaftar');
  } finally {
    await f.close();
  }
});
