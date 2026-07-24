const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, guruOnly, muridOnly } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const { cleanText } = require('../utils/sanitize');

// Cek akses kelas (anti-IDOR): guru pemilik ATAU murid terdaftar di kelas.
async function bolehAksesKelas(user, kelasId) {
  if (!kelasId) return false;
  if (user.role === 'guru') {
    const { data } = await supabase.from('kelas')
      .select('id').eq('id', kelasId).eq('guru_id', user.id).maybeSingle();
    return !!data;
  }
  if (user.role === 'murid') {
    const { data } = await supabase.from('kelas_murid')
      .select('kelas_id').eq('kelas_id', kelasId).eq('murid_id', user.id).maybeSingle();
    return !!data;
  }
  return false;
}

// POST /api/kelas — Guru buat kelas baru
router.post('/', authMiddleware, guruOnly, async (req, res) => {
  try {
    let { nama, tahun_ajar, mapel } = req.body;
    if (!nama || !tahun_ajar)
      return res.status(400).json({ success: false, pesan: 'Nama kelas dan tahun ajaran wajib diisi.' });

    nama = cleanText(nama, 100);
    tahun_ajar = cleanText(tahun_ajar, 20);

    const id = uuidv4();
    const safeMapel = cleanText(mapel || '', 60);

    // Generate kode unik 6 karakter (huruf kapital + angka), cek duplikat ke DB
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // hapus karakter ambigu (I,O,0,1)
    let kode_akses;
    let attempts = 0;
    do {
      kode_akses = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      const { data: existing } = await supabase.from('kelas').select('id').eq('kode_akses', kode_akses).maybeSingle();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const { error } = await supabase.from('kelas').insert({ id, nama, tahun_ajar, mapel: safeMapel, guru_id: req.user.id, kode_akses });
    if (error) throw error;

    res.status(201).json({ success: true, pesan: `Kelas "${nama}" berhasil dibuat!`, data: { id, nama, tahun_ajar, mapel: safeMapel, kode_akses } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/kelas — List kelas
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query;
    if (req.user.role === 'guru') {
      const { data } = await supabase.from('kelas').select('*').eq('guru_id', req.user.id).order('created_at', { ascending: false });
      query = data || [];
    } else {
      const { data } = await supabase
        .from('kelas_murid')
        .select('kelas:kelas_id(*, guru:guru_id(nama))')
        .eq('murid_id', req.user.id);
      query = data?.map(d => d.kelas) || [];
    }

    // Hitung total_materi per kelas secara batch
    if (query.length > 0) {
      const kelasIds = query.map(k => k.id);
      const { data: materiRows } = await supabase
        .from('materi')
        .select('kelas_id')
        .in('kelas_id', kelasIds);
      const materiCount = {};
      for (const m of (materiRows || [])) {
        materiCount[m.kelas_id] = (materiCount[m.kelas_id] || 0) + 1;
      }
      query = query.map(k => ({ ...k, total_materi: materiCount[k.id] || 0 }));
    }

    res.json({ success: true, data: query });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/kelas/:id — Detail kelas + murid
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [
      { data: kelas },
      { data: muridList },
      { count: totalMateri }
    ] = await Promise.all([
      supabase.from('kelas').select('*, guru:guru_id(nama, avatar)').eq('id', req.params.id).single(),
      supabase.from('kelas_murid').select('murid:murid_id(id, nama, avatar, xp, level)').eq('kelas_id', req.params.id),
      supabase.from('materi').select('id', { count: 'exact', head: true }).eq('kelas_id', req.params.id)
    ]);

    if (!kelas) return res.status(404).json({ success: false, pesan: 'Kelas tidak ditemukan.' });

    const murid = muridList?.map(m => m.murid) || [];
    // Anti-IDOR: hanya guru pemilik atau murid terdaftar yang boleh lihat detail.
    const bolehGuru = req.user.role === 'guru' && kelas.guru_id === req.user.id;
    const bolehMurid = req.user.role === 'murid' && murid.some(m => m && m.id === req.user.id);
    if (!bolehGuru && !bolehMurid)
      return res.status(403).json({ success: false, pesan: 'Kamu tidak punya akses ke kelas ini.' });

    res.json({ success: true, data: { ...kelas, murid, total_murid: murid.length, total_materi: totalMateri || 0 } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/kelas/join — Murid join kelas dengan kode
router.post('/join', authMiddleware, muridOnly, async (req, res) => {
  try {
    const { kode_akses } = req.body;
    if (!kode_akses)
      return res.status(400).json({ success: false, pesan: 'Kode akses wajib diisi.' });

    const { data: kelas } = await supabase
      .from('kelas').select('*').eq('kode_akses', kode_akses.toUpperCase()).single();
    if (!kelas)
      return res.status(404).json({ success: false, pesan: 'Kode kelas tidak valid.' });

    // Cek sudah bergabung
    const { data: existing } = await supabase
      .from('kelas_murid').select('kelas_id')
      .eq('kelas_id', kelas.id).eq('murid_id', req.user.id).single();
    if (existing)
      return res.status(409).json({ success: false, pesan: 'Kamu sudah bergabung di kelas ini.' });

    await supabase.from('kelas_murid').insert({ kelas_id: kelas.id, murid_id: req.user.id });
    await supabase.from('notifikasi').insert({
      id: uuidv4(), user_id: req.user.id,
      judul: '🏫 Bergabung Kelas Baru!',
      pesan: `Kamu berhasil bergabung ke ${kelas.nama}. Semangat belajar!`
    });

    res.json({ success: true, pesan: `Berhasil bergabung ke ${kelas.nama}!`, data: { kelas_id: kelas.id, nama: kelas.nama } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/kelas/:id/chat — Ambil pesan chat kelas (decrypt isi)
router.get('/:id/chat', authMiddleware, async (req, res) => {
  try {
    // Anti-IDOR: hanya anggota kelas yang boleh membaca chat.
    if (!(await bolehAksesKelas(req.user, req.params.id)))
      return res.status(403).json({ success: false, pesan: 'Kamu tidak punya akses ke kelas ini.' });

    const { data } = await supabase
      .from('pesan_kelas')
      .select('*, pengirim:pengirim_id(id, nama, avatar, role)')
      .eq('kelas_id', req.params.id)
      .order('created_at', { ascending: true })
      .limit(100);
    const result = (data || []).map(p => ({ ...p, isi: decrypt(p.isi) }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/kelas/:id/chat — Kirim pesan chat kelas (encrypt isi)
router.post('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ success: false, pesan: 'Pesan tidak boleh kosong.' });
    // Anti-IDOR: hanya anggota kelas yang boleh mengirim pesan.
    if (!(await bolehAksesKelas(req.user, req.params.id)))
      return res.status(403).json({ success: false, pesan: 'Kamu tidak punya akses ke kelas ini.' });
    const plainIsi = isi.trim();
    const id = uuidv4();
    const { error } = await supabase.from('pesan_kelas').insert({
      id, kelas_id: req.params.id, pengirim_id: req.user.id, isi: encrypt(plainIsi)
    });
    if (error) throw error;
    res.status(201).json({
      success: true,
      data: { id, kelas_id: req.params.id, pengirim_id: req.user.id, isi: plainIsi, created_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// PUT /api/kelas/:id/chat/:msgId — Edit pesan (hanya pengirim atau guru)
router.put('/:id/chat/:msgId', authMiddleware, async (req, res) => {
  try {
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ success: false, pesan: 'Pesan tidak boleh kosong.' });

    const { data: msg } = await supabase
      .from('pesan_kelas').select('id, pengirim_id, created_at').eq('id', req.params.msgId).eq('kelas_id', req.params.id).single();
    if (!msg) return res.status(404).json({ success: false, pesan: 'Pesan tidak ditemukan.' });

    const isOwner = msg.pengirim_id === req.user.id;
    const isGuru = req.user.role === 'guru';
    if (!isOwner && !isGuru) return res.status(403).json({ success: false, pesan: 'Tidak punya akses.' });

    const diffMinutes = (new Date() - new Date(msg.created_at)) / (1000 * 60);
    if (diffMinutes > 5 && isOwner) {
      return res.status(400).json({ success: false, pesan: 'Pesan yang sudah lebih dari 5 menit tidak dapat diubah atau dihapus.' });
    }

    const { error } = await supabase.from('pesan_kelas')
      .update({ isi: encrypt(isi.trim()) })
      .eq('id', req.params.msgId);
    if (error) throw error;

    res.json({ success: true, data: { id: req.params.msgId, isi: isi.trim() } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// DELETE /api/kelas/:id/chat/:msgId — Hapus pesan (hanya pengirim atau guru)
router.delete('/:id/chat/:msgId', authMiddleware, async (req, res) => {
  try {
    const { data: msg } = await supabase
      .from('pesan_kelas').select('id, pengirim_id, created_at').eq('id', req.params.msgId).eq('kelas_id', req.params.id).single();
    if (!msg) return res.status(404).json({ success: false, pesan: 'Pesan tidak ditemukan.' });

    const isOwner = msg.pengirim_id === req.user.id;
    const isGuru = req.user.role === 'guru';
    if (!isOwner && !isGuru) return res.status(403).json({ success: false, pesan: 'Tidak punya akses.' });

    const diffMinutes = (new Date() - new Date(msg.created_at)) / (1000 * 60);
    const isModeratorDelete = isGuru && !isOwner;
    if (diffMinutes > 5 && !isModeratorDelete) {
      return res.status(400).json({ success: false, pesan: 'Pesan yang sudah lebih dari 5 menit tidak dapat diubah atau dihapus.' });
    }

    const { error } = await supabase.from('pesan_kelas').delete().eq('id', req.params.msgId);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// DELETE /api/kelas/:id
router.delete('/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { data: kelas } = await supabase
      .from('kelas').select('nama').eq('id', req.params.id).eq('guru_id', req.user.id).single();
    if (!kelas) return res.status(404).json({ success: false, pesan: 'Kelas tidak ditemukan.' });

    await supabase.from('kelas').delete().eq('id', req.params.id);
    res.json({ success: true, pesan: `Kelas "${kelas.nama}" berhasil dihapus.` });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// DELETE /api/kelas/:id/leave — Murid keluar dari kelas
router.delete('/:id/leave', authMiddleware, muridOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const murid_id = req.user.id;

    const { data: existing } = await supabase
      .from('kelas_murid').select('kelas_id')
      .eq('kelas_id', id).eq('murid_id', murid_id).single();
    if (!existing)
      return res.status(404).json({ success: false, pesan: 'Kamu tidak terdaftar di kelas ini.' });

    const { error } = await supabase
      .from('kelas_murid')
      .delete()
      .eq('kelas_id', id)
      .eq('murid_id', murid_id);

    if (error) throw error;
    res.json({ success: true, pesan: 'Berhasil keluar dari kelas.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;