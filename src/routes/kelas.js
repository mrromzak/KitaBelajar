const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, guruOnly, muridOnly } = require('../middleware/auth');

// POST /api/kelas — Guru buat kelas baru
router.post('/', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { nama, tahun_ajar } = req.body;
    if (!nama || !tahun_ajar)
      return res.status(400).json({ success: false, pesan: 'Nama kelas dan tahun ajaran wajib diisi.' });

    const id = uuidv4();
    const kode_akses = (req.body.kode_akses || '').trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase.from('kelas').insert({ id, nama, tahun_ajar, guru_id: req.user.id, kode_akses });
    if (error) throw error;

    res.status(201).json({ success: true, pesan: `Kelas "${nama}" berhasil dibuat!`, data: { id, nama, tahun_ajar, kode_akses } });
  } catch (err) {
    res.status(500).json({ success: false, pesan: err.message });
  }
});

// GET /api/kelas — List kelas
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query;
    if (req.user.role === 'guru') {
      const { data } = await supabase.from('kelas').select('*').eq('guru_id', req.user.id).order('created_at', { ascending: false });
      query = data;
    } else {
      const { data } = await supabase
        .from('kelas_murid')
        .select('kelas:kelas_id(*, guru:guru_id(nama))')
        .eq('murid_id', req.user.id);
      query = data?.map(d => d.kelas) || [];
    }
    res.json({ success: true, data: query });
  } catch (err) {
    res.status(500).json({ success: false, pesan: err.message });
  }
});

// GET /api/kelas/:id — Detail kelas + murid
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: kelas } = await supabase
      .from('kelas').select('*, guru:guru_id(nama)').eq('id', req.params.id).single();
    if (!kelas) return res.status(404).json({ success: false, pesan: 'Kelas tidak ditemukan.' });

    const { data: muridList } = await supabase
      .from('kelas_murid')
      .select('murid:murid_id(id, nama, avatar, xp, level)')
      .eq('kelas_id', req.params.id);

    const murid = muridList?.map(m => m.murid) || [];
    const { count: totalMateri } = await supabase
      .from('materi').select('id', { count: 'exact', head: true })
      .eq('kelas_id', req.params.id);
    res.json({ success: true, data: { ...kelas, murid, total_murid: murid.length, total_materi: totalMateri || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, pesan: err.message });
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
    res.status(500).json({ success: false, pesan: err.message });
  }
});

// GET /api/kelas/:id/chat — Ambil pesan chat kelas
router.get('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('pesan_kelas')
      .select('*, pengirim:pengirim_id(id, nama, avatar, role)')
      .eq('kelas_id', req.params.id)
      .order('created_at', { ascending: true })
      .limit(100);
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, pesan: err.message });
  }
});

// POST /api/kelas/:id/chat — Kirim pesan chat kelas
router.post('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ success: false, pesan: 'Pesan tidak boleh kosong.' });
    const id = uuidv4();
    const { error } = await supabase.from('pesan_kelas').insert({
      id, kelas_id: req.params.id, pengirim_id: req.user.id, isi: isi.trim()
    });
    if (error) throw error;
    res.status(201).json({
      success: true,
      data: { id, kelas_id: req.params.id, pengirim_id: req.user.id, isi: isi.trim(), created_at: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({ success: false, pesan: err.message });
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
    res.status(500).json({ success: false, pesan: err.message });
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
    res.status(500).json({ success: false, pesan: err.message });
  }
});

module.exports = router;