// ============================================================
//  prototype/kode-guru/store.js
//
//  In-memory store (quota-based, v1 schema) with optional
//  Supabase persistence.
//
//  Schema v1 (matches production kode-guru.js):
//    kode_guru: id, kode, dibuat_oleh, status, max_uses,
//               used_count, expires_at, label, created_at
//
//  Test contract (all sync for in-memory path):
//    createKepala({ nama, email, passwordHash })  → { user }
//    createGuru({ nama, email, passwordHash })    → { user }
//    findUserByEmail(email)                       → user | null
//    generateCode({ dibuatOleh, maxUses, expiresInDays, label })
//                                                 → { code }
//    validateCode(kode)                           → { valid, reason? }
//    redeemCode(kode, guruId)                     → { ok, reason? }  ← atomic
//    listCodes(kepalaId)                          → code[]
//    revokeCode(id, kepalaId)                     → { entry?, error? }
//    listGuru()                                   → user[]
//    listRedemptions(codeId)                      → redemption[]
//    stats()                                      → { users, codes, redemptions }
//    _getCodeById(id)                             → raw internal code object
// ============================================================

const crypto = require('crypto');

// Charset tanpa karakter ambigu (tanpa I, O, 0, 1)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomKode(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++)
    out += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return out;
}

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function normalizeKode(k)  { return String(k || '').trim().toUpperCase(); }

// ── Public shape sent to clients ──────────────────────────────
function publicCode(c) {
  const usedCount = c.usedCount ?? 0;
  const maxUses   = c.maxUses   ?? c.max_uses ?? 1;
  return {
    id:         c.id,
    kode:       c.kode,
    status:     deriveStatus(c),
    maxUses,
    usedCount,
    sisaKuota:  Math.max(0, maxUses - usedCount),
    expiresAt:  c.expiresAt ?? c.expires_at ?? null,
    label:      c.label     ?? null,
    createdAt:  c.createdAt ?? c.created_at ?? null
  };
}

function deriveStatus(c) {
  if (c.status === 'revoked') return 'revoked';
  if (c.expiresAt && c.expiresAt < Date.now()) return 'expired';
  if ((c.usedCount ?? 0) >= (c.maxUses ?? c.max_uses ?? 1)) return 'used_up';
  return 'active';
}

function publicUser(u) {
  // Never expose passwordHash to clients
  return {
    id:        u.id,
    nama:      u.nama,
    email:     u.email,
    role:      u.role,
    createdAt: u.createdAt ?? u.created_at ?? null
  };
}

// ============================================================
//  createStore — factory; supabase optional (null → in-memory)
// ============================================================
function createStore(supabase = null) {

  // ── In-memory state ────────────────────────────────────────
  const _users        = new Map(); // id → user (with passwordHash)
  const _usersByEmail = new Map(); // normalizedEmail → userId
  const _codes        = new Map(); // id → code
  const _codesByKode  = new Map(); // kode string → codeId
  const _redemptions  = [];        // { id, codeId, guruId, redeemedAt }

  // ── User helpers ───────────────────────────────────────────

  function _createUser({ nama, email, passwordHash, role }) {
    const normEmail = normalizeEmail(email);
    if (_usersByEmail.has(normEmail)) return { error: 'Email sudah terdaftar.' };
    const id   = crypto.randomUUID();
    const user = { id, nama, email: normEmail, passwordHash, role, createdAt: Date.now() };
    _users.set(id, user);
    _usersByEmail.set(normEmail, id);
    return { user };
  }

  // Sync — tests call without await
  function createKepala(data) { return _createUser({ ...data, role: 'kepala_sekolah' }); }
  function createGuru(data)   { return _createUser({ ...data, role: 'guru' }); }

  function findUserByEmail(email) {
    const id = _usersByEmail.get(normalizeEmail(email));
    return id ? _users.get(id) : null;
  }

  function listGuru() {
    return [..._users.values()]
      .filter(u => u.role === 'guru')
      .map(publicUser);
  }

  // ── Code helpers ───────────────────────────────────────────

  function generateCode({ dibuatOleh, maxUses = 1, expiresInDays = null, label = null }) {
    // Generate unique kode
    let kode, attempts = 0;
    do {
      kode = randomKode(8);
      attempts++;
    } while (_codesByKode.has(kode) && attempts < 20);

    const expiresAt = expiresInDays
      ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      : null;

    const code = {
      id:         crypto.randomUUID(),
      kode,
      dibuatOleh,
      status:     'active',
      maxUses:    Math.min(Math.max(parseInt(maxUses, 10) || 1, 1), 1000),
      usedCount:  0,
      expiresAt,
      label:      label ? String(label).slice(0, 100) : null,
      createdAt:  Date.now()
    };
    _codes.set(code.id, code);
    _codesByKode.set(kode, code.id);
    return { code };
  }

  // Sync validate — no side effects
  function validateCode(rawKode) {
    const kode = normalizeKode(rawKode);
    const id   = _codesByKode.get(kode);
    if (!id) return { valid: false, reason: 'Kode tidak ditemukan.' };
    const code = _codes.get(id);
    if (!code)                    return { valid: false, reason: 'Kode tidak ditemukan.' };
    if (code.status === 'revoked') return { valid: false, reason: 'Kode sudah dicabut.' };
    if (code.expiresAt && code.expiresAt < Date.now())
      return { valid: false, reason: 'Kode sudah kadaluarsa.' };
    if (code.usedCount >= code.maxUses)
      return { valid: false, reason: 'Kuota kode sudah habis.' };
    return { valid: true };
  }

  // Synchronous redeem — safe because Node.js is single-threaded.
  // Each concurrent HTTP request runs its synchronous code atomically
  // before yielding to the event loop, so usedCount++ cannot race.
  // The test calls this without await and checks .ok directly.
  function redeemCode(rawKode, guruId) {
    const kode = normalizeKode(rawKode);
    const id   = _codesByKode.get(kode);
    if (!id) return { ok: false, reason: 'Kode tidak ditemukan.' };
    const code = _codes.get(id);
    if (!code) return { ok: false, reason: 'Kode tidak ditemukan.' };

    if (code.status === 'revoked')
      return { ok: false, reason: 'Kode sudah dicabut.' };
    if (code.expiresAt && code.expiresAt < Date.now())
      return { ok: false, reason: 'Kode sudah kadaluarsa.' };
    if (code.usedCount >= code.maxUses)
      return { ok: false, reason: 'Kuota kode sudah habis.' };

    code.usedCount += 1;
    _redemptions.push({ id: crypto.randomUUID(), codeId: id, guruId, redeemedAt: Date.now() });
    return { ok: true };
  }

  function listCodes(kepalaId) {
    return [..._codes.values()]
      .filter(c => c.dibuatOleh === kepalaId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicCode);
  }

  function revokeCode(id, kepalaId) {
    const code = _codes.get(id);
    if (!code)                       return { error: 'Kode tidak ditemukan.' };
    if (code.dibuatOleh !== kepalaId) return { error: 'Bukan kode milikmu.' };
    if (code.status === 'revoked')   return { entry: publicCode(code) };
    code.status = 'revoked';
    return { entry: publicCode(code) };
  }

  function listRedemptions(codeId) {
    return _redemptions.filter(r => r.codeId === codeId);
  }

  // Internal escape hatch for tests (mutable reference)
  function _getCodeById(id) {
    return _codes.get(id) || null;
  }

  function stats() {
    return {
      users:       _users.size,
      codes:       _codes.size,
      redemptions: _redemptions.length
    };
  }

  return {
    // User
    createKepala,
    createGuru,
    findUserByEmail,
    listGuru,
    // Code
    generateCode,
    validateCode,
    redeemCode,
    listCodes,
    revokeCode,
    listRedemptions,
    // Stats & internals
    stats,
    _getCodeById
  };
}

module.exports = { createStore, normalizeKode, CODE_CHARS };
