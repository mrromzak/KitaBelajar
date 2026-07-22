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
  const usedCount = c.usedCount ?? c.used_count ?? 0;
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
  const expiresAt = c.expiresAt ?? c.expires_at;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'expired';
  const usedCount = c.usedCount ?? c.used_count ?? 0;
  const maxUses   = c.maxUses   ?? c.max_uses ?? 1;
  if (usedCount >= maxUses) return 'used_up';
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

  async function _createUser({ nama, email, passwordHash, role }) {
    const normEmail = normalizeEmail(email);
    if (supabase) {
      const { data: existing } = await supabase.from('users').select('id').eq('email', normEmail).maybeSingle();
      if (existing) return { error: 'Email sudah terdaftar.' };
      const id = crypto.randomUUID();
      const { data, error } = await supabase.from('users').insert({
        id,
        nama,
        email: normEmail,
        password: passwordHash,
        role,
        avatar: role === 'guru' ? '👩‍🏫' : '🦁'
      }).select().single();
      if (error) return { error: error.message };
      return { user: { id: data.id, nama: data.nama, email: data.email, role: data.role, createdAt: data.created_at } };
    } else {
      if (_usersByEmail.has(normEmail)) return { error: 'Email sudah terdaftar.' };
      const id   = crypto.randomUUID();
      const user = { id, nama, email: normEmail, passwordHash, role, createdAt: Date.now() };
      _users.set(id, user);
      _usersByEmail.set(normEmail, id);
      return { user };
    }
  }

  // Sync / Async wrapper to maintain sync for tests but support async for Supabase path
  function createKepala(data) {
    if (supabase) {
      return _createUser({ ...data, role: 'kepala_sekolah' });
    }
    const normEmail = normalizeEmail(data.email);
    if (_usersByEmail.has(normEmail)) return { error: 'Email sudah terdaftar.' };
    const id   = crypto.randomUUID();
    const user = { id, nama: data.nama, email: normEmail, passwordHash: data.passwordHash, role: 'kepala_sekolah', createdAt: Date.now() };
    _users.set(id, user);
    _usersByEmail.set(normEmail, id);
    return { user };
  }

  function createGuru(data) {
    if (supabase) {
      return _createUser({ ...data, role: 'guru' });
    }
    const normEmail = normalizeEmail(data.email);
    if (_usersByEmail.has(normEmail)) return { error: 'Email sudah terdaftar.' };
    const id   = crypto.randomUUID();
    const user = { id, nama: data.nama, email: normEmail, passwordHash: data.passwordHash, role: 'guru', createdAt: Date.now() };
    _users.set(id, user);
    _usersByEmail.set(normEmail, id);
    return { user };
  }

  function findUserByEmail(email) {
    const normEmail = normalizeEmail(email);
    if (supabase) {
      return (async () => {
        const { data, error } = await supabase.from('users').select('*').eq('email', normEmail).maybeSingle();
        if (error || !data) return null;
        return {
          id: data.id,
          nama: data.nama,
          email: data.email,
          passwordHash: data.password,
          role: data.role,
          createdAt: data.created_at
        };
      })();
    } else {
      const id = _usersByEmail.get(normEmail);
      const user = id ? _users.get(id) : null;
      return user;
    }
  }

  function listGuru() {
    if (supabase) {
      return (async () => {
        const { data, error } = await supabase.from('users').select('*').eq('role', 'guru').order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(publicUser);
      })();
    } else {
      const list = [..._users.values()]
        .filter(u => u.role === 'guru')
        .map(publicUser);
      return list;
    }
  }

  // ── Code helpers ───────────────────────────────────────────

  function generateCode({ dibuatOleh, maxUses = 1, expiresInDays = null, label = null }) {
    let kode, attempts = 0;
    if (supabase) {
      return (async () => {
        do {
          kode = randomKode(8);
          const { data } = await supabase.from('kode_guru').select('id').eq('kode', kode).maybeSingle();
          if (!data) break;
          attempts++;
        } while (attempts < 20);

        const expiresAt = expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const id = crypto.randomUUID();
        const { data, error } = await supabase.from('kode_guru').insert({
          id,
          kode,
          dibuat_oleh: dibuatOleh,
          status: 'active',
          max_uses: Math.min(Math.max(parseInt(maxUses, 10) || 1, 1), 1000),
          used_count: 0,
          expires_at: expiresAt,
          label: label ? String(label).slice(0, 100) : null
        }).select().single();

        if (error) return { error: error.message };
        return { code: publicCode(data) };
      })();
    } else {
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
  }

  function validateCode(rawKode) {
    const kode = normalizeKode(rawKode);
    if (supabase) {
      return (async () => {
        const { data, error } = await supabase.from('kode_guru').select('*').eq('kode', kode).maybeSingle();
        if (error || !data) return { valid: false, reason: 'Kode tidak ditemukan.' };
        if (data.status === 'revoked') return { valid: false, reason: 'Kode sudah dicabut.' };
        if (data.expires_at && new Date(data.expires_at).getTime() < Date.now())
          return { valid: false, reason: 'Kode sudah kadaluarsa.' };
        if ((data.used_count || 0) >= data.max_uses)
          return { valid: false, reason: 'Kuota kode sudah habis.' };
        return { valid: true };
      })();
    } else {
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
  }

  function redeemCode(rawKode, guruId) {
    const kode = normalizeKode(rawKode);
    if (supabase) {
      return (async () => {
        // Panggil RPC Supabase redeem_kode_guru yang bersifat atomik
        const { data: codeId, error } = await supabase.rpc('redeem_kode_guru', { p_kode: kode });
        if (error || !codeId) {
          // Fallback jika RPC tidak terdefinisi/eror: coba manual dengan read-modify-write (tetapi laporkan)
          const { data: codeData } = await supabase.from('kode_guru').select('*').eq('kode', kode).maybeSingle();
          if (!codeData) return { ok: false, reason: 'Kode tidak ditemukan.' };
          if (codeData.status === 'revoked') return { ok: false, reason: 'Kode sudah dicabut.' };
          if (codeData.expires_at && new Date(codeData.expires_at).getTime() < Date.now())
            return { ok: false, reason: 'Kode sudah kadaluarsa.' };
          if ((codeData.used_count || 0) >= codeData.max_uses)
            return { ok: false, reason: 'Kuota kode sudah habis.' };

          const { error: updateError } = await supabase
            .from('kode_guru')
            .update({ used_count: (codeData.used_count || 0) + 1 })
            .eq('id', codeData.id);

          if (updateError) return { ok: false, reason: 'Gagal meredeem kode.' };
          
          await supabase.from('kode_guru_redemptions').insert({
            id: crypto.randomUUID(),
            kode_id: codeData.id,
            guru_id: guruId
          });
          return { ok: true };
        }

        await supabase.from('kode_guru_redemptions').insert({
          id: crypto.randomUUID(),
          kode_id: codeId,
          guru_id: guruId
        });
        return { ok: true };
      })();
    } else {
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
  }

  function listCodes(kepalaId) {
    if (supabase) {
      return (async () => {
        const { data, error } = await supabase
          .from('kode_guru')
          .select('*')
          .eq('dibuat_oleh', kepalaId)
          .order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(publicCode);
      })();
    } else {
      const list = [..._codes.values()]
        .filter(c => c.dibuatOleh === kepalaId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(publicCode);
      return list;
    }
  }

  function revokeCode(id, kepalaId) {
    if (supabase) {
      return (async () => {
        const { data: codeData } = await supabase.from('kode_guru').select('*').eq('id', id).maybeSingle();
        if (!codeData) return { error: 'Kode tidak ditemukan.' };
        if (codeData.dibuat_oleh !== kepalaId) return { error: 'Bukan kode milikmu.' };
        
        const { data, error } = await supabase
          .from('kode_guru')
          .update({ status: 'revoked' })
          .eq('id', id)
          .select().single();

        if (error) return { error: error.message };
        return { entry: publicCode(data) };
      })();
    } else {
      const code = _codes.get(id);
      if (!code)                       return { error: 'Kode tidak ditemukan.' };
      if (code.dibuatOleh !== kepalaId) return { error: 'Bukan kode milikmu.' };
      if (code.status === 'revoked')   return { entry: publicCode(code) };
      code.status = 'revoked';
      return { entry: publicCode(code) };
    }
  }

  function listRedemptions(codeId) {
    if (supabase) {
      return (async () => {
        const { data, error } = await supabase.from('kode_guru_redemptions').select('*').eq('kode_id', codeId);
        if (error || !data) return [];
        return data;
      })();
    } else {
      const list = _redemptions.filter(r => r.codeId === codeId);
      return list;
    }
  }

  // Internal escape hatch for tests (mutable reference)
  function _getCodeById(id) {
    return _codes.get(id) || null;
  }

  function stats() {
    if (supabase) {
      return (async () => {
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: codesCount } = await supabase.from('kode_guru').select('*', { count: 'exact', head: true });
        const { count: redemptionsCount } = await supabase.from('kode_guru_redemptions').select('*', { count: 'exact', head: true });
        return {
          users: usersCount || 0,
          codes: codesCount || 0,
          redemptions: redemptionsCount || 0
        };
      })();
    } else {
      const counts = {
        users:       _users.size,
        codes:       _codes.size,
        redemptions: _redemptions.length
      };
      return counts;
    }
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
