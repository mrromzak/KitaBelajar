// ============================================================
//  HAPUS KELAS (GURU)
// ============================================================
let hapusKelasId = null;

function konfirmasiHapusKelas(id, nama) {
  hapusKelasId = id;
  document.getElementById('hapus-kelas-pesan').textContent = `Kelas "${nama}" akan dihapus permanen.`;
  openModal('modal-hapus-kelas');
}

async function eksekusiHapusKelas() {
  if (!hapusKelasId) return;
  closeModal('modal-hapus-kelas');
  showLoading(true);
  try {
    const data = await api('DELETE', `/kelas/${hapusKelasId}`);
    hapusKelasId = null;
    if (data.success || data.pesan?.toLowerCase().includes('berhasil') || data.pesan?.toLowerCase().includes('dihapus')) {
      toast('Kelas berhasil dihapus! 🗑️', 'success');
      // Kalau sedang di halaman detail kelas, kembali ke dashboard
      const isInDetail = document.getElementById('page-kelas').classList.contains('active');
      currentKelas = null;
      loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal menghapus kelas', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

// ============================================================
//  KELUAR KELAS (MURID)
// ============================================================
let keluarKelasId = null;

function konfirmasiKeluarKelas(id, nama) {
  keluarKelasId = id;
  document.getElementById('keluar-kelas-pesan').textContent = `Kamu akan keluar dari kelas "${nama}". Kamu bisa bergabung lagi nanti dengan kode yang sama.`;
  openModal('modal-keluar-kelas');
}

async function eksekusiKeluarKelas() {
  if (!keluarKelasId) return;
  closeModal('modal-keluar-kelas');
  showLoading(true);
  try {
    // Coba berbagai endpoint leave sesuai kemungkinan backend
    let success = false;
    const endpoints = [
      { method: 'DELETE', path: `/kelas/${keluarKelasId}/leave` },
      { method: 'DELETE', path: `/kelas/${keluarKelasId}/murid` },
      { method: 'POST',   path: `/kelas/${keluarKelasId}/leave` },
      { method: 'POST',   path: `/kelas/leave` },
    ];
    for (const ep of endpoints) {
      try {
        const data = await api(ep.method, ep.path, ep.method === 'POST' ? { kelas_id: keluarKelasId } : undefined);
        if (data.success || data.pesan?.toLowerCase().includes('keluar') || data.pesan?.toLowerCase().includes('berhasil')) {
          success = true; break;
        }
      } catch(e) {}
    }
    keluarKelasId = null;
    currentKelas = null;
    if (success) {
      toast('Berhasil keluar dari kelas 🚪', 'success');
      await loadMuridDashboard();
    } else {
      toast('Gagal keluar dari kelas. Coba lagi! ❌', 'error');
      await loadMuridDashboard(); // tetap reload agar data sinkron
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

function openTambahMateriKelas() {
  if (!currentKelas) return;
  document.getElementById('m-kelas-id').value = currentKelas.id;
  // Set mapel sesuai kelas
  const mapelSel = document.getElementById('m-mapel');
  if (currentKelas.mapel) {
    for (let opt of mapelSel.options) {
      if (opt.value === currentKelas.mapel) { opt.selected = true; break; }
    }
  }
  resetMateriForm();
  document.getElementById('m-kelas-id').value = currentKelas.id;
  openModal('modal-materi');
}

// ============================================================
//  BUAT KELAS (GURU)
// ============================================================
async function submitBuatKelas() {
  const nama = document.getElementById('bk-nama').value.trim();
  const mapel = document.getElementById('bk-mapel').value;
  const tahun = document.getElementById('bk-tahun').value.trim() || '2024/2025';
  if (!nama) { toast('Nama kelas harus diisi!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/kelas', { nama, mapel, tahun_ajar: tahun });
    if (data.success) {
      toast(`Kelas "${nama}" berhasil dibuat! Kode: ${data.data?.kode_akses || ''} 🎉`, 'success');
      closeModal('modal-buat-kelas');
      document.getElementById('bk-nama').value = '';
      loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal membuat kelas', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

// ============================================================
//  JOIN KELAS (MURID)
// ============================================================
async function submitJoinKelas() {
  const kode = document.getElementById('join-kode').value.trim().toUpperCase();
  if (!kode) { toast('Masukkan kode kelas dulu!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/kelas/join', { kode_akses: kode });
    const pesan = data.pesan || '';
    // Anggap sukses juga kalau backend bilang sudah bergabung
    const sudahBergabung = pesan.toLowerCase().includes('sudah') || pesan.toLowerCase().includes('already');
    if (data.success || sudahBergabung) {
      toast(sudahBergabung ? 'Kamu sudah ada di kelas ini! ✅' : 'Berhasil bergabung ke kelas! 🎉', 'success');
      closeModal('modal-join-kelas');
      document.getElementById('join-kode').value = '';
      loadMuridDashboard();
    } else {
      toast(pesan || 'Kode kelas tidak ditemukan', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}