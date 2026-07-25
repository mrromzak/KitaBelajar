// =====================================================
//  /js/modules/analitik-guru.js
//  Panel Analitik Guru — sinyal per murid, terpisah (bukan skor gabungan).
//
//  Integrasi sudah terpasang:
//  - Script dimuat di belajar-seru.html setelah dashboard-guru.js
//  - AnalitikGuru.aktifkanTab(kelasId) dipanggil dari openKelas()
//    di kelas-chat.js saat role user === 'guru'
//  - switchKelasTab() di kuis.js menyembunyikan panel ini saat
//    pindah ke tab lain (materi/kuis/murid/chat/penilaian)
// =====================================================

const AnalitikGuru = (() => {
  let kelasIdAktif = null;

  function getAuthToken() {
    return localStorage.getItem('kb_token') || null;
  }

  // Dipanggil saat halaman detail kelas dibuka sebagai guru.
  function aktifkanTab(kelasId) {
    kelasIdAktif = kelasId;
    const btn = document.getElementById('tab-analitik-btn');
    if (btn) btn.style.display = '';
  }

  // Sembunyikan semua panel tab kelas & non-aktifkan semua tombol tab.
  // Daftar ID ini mengikuti struktur HTML page-kelas yang sudah ada.
  function sembunyikanSemuaTab() {
    const streamIds = [
      'kelas-stream', 'kelas-murid-stream', 'kelas-chat-stream',
      'kelas-penilaian-stream', 'kelas-kuis-stream', 'kelas-analitik-stream'
    ];
    streamIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const btnIds = [
      'tab-materi-btn', 'tab-kuis-btn', 'tab-murid-btn',
      'tab-chat-btn', 'tab-penilaian-btn', 'tab-analitik-btn'
    ];
    btnIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
  }

  async function bukaTab() {
    if (!kelasIdAktif) return;
    sembunyikanSemuaTab();
    const btn = document.getElementById('tab-analitik-btn');
    if (btn) btn.classList.add('active');
    const wrap = document.getElementById('kelas-analitik-stream');
    if (!wrap) return;
    wrap.style.display = '';
    wrap.innerHTML = '<div class="analitik-loading">Memuat data...</div>';

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/analitik/kelas/${kelasIdAktif}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (!json.success) {
        wrap.innerHTML = `<div class="analitik-empty">${escapeHtml(json.pesan || 'Gagal memuat data.')}</div>`;
        return;
      }
      render(wrap, json.data, json.catatan);
    } catch (err) {
      console.error('[AnalitikGuru]', err);
      wrap.innerHTML = '<div class="analitik-empty">Terjadi kesalahan memuat analitik.</div>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const LABEL_QUIZ = {
    turun_tajam: { teks: 'Nilai turun tajam', kelas: 'perlu-perhatian' },
    turun: { teks: 'Nilai turun', kelas: 'agak-perhatian' },
    stabil: { teks: 'Nilai stabil', kelas: 'baik' },
    naik: { teks: 'Nilai naik', kelas: 'baik' },
    data_kurang: { teks: 'Belum cukup data', kelas: 'netral' }
  };
  const LABEL_TUGAS = {
    perlu_perhatian: { teks: 'Sering telat/tidak kumpul', kelas: 'perlu-perhatian' },
    agak_terlambat: { teks: 'Kadang telat', kelas: 'agak-perhatian' },
    baik: { teks: 'Tepat waktu', kelas: 'baik' },
    data_kurang: { teks: 'Belum ada tugas jatuh tempo', kelas: 'netral' }
  };
  const LABEL_LOGIN = {
    tidak_aktif: { teks: 'Tidak login 10+ hari', kelas: 'perlu-perhatian' },
    mulai_jarang: { teks: 'Mulai jarang login', kelas: 'agak-perhatian' },
    aktif: { teks: 'Aktif login', kelas: 'baik' },
    belum_ada_data: { teks: 'Belum ada data login', kelas: 'netral' }
  };

  function chip(label) {
    if (!label) return '';
    return `<span class="analitik-chip chip-${label.kelas}">${label.teks}</span>`;
  }

  function render(wrap, data, catatan) {
    if (!data || data.length === 0) {
      wrap.innerHTML = '<div class="analitik-empty">Belum ada murid di kelas ini.</div>';
      return;
    }

    const baris = data.map(d => {
      const quizLabel = LABEL_QUIZ[d.tren_quiz.status];
      const tugasLabel = LABEL_TUGAS[d.ketepatan_tugas.status];
      const loginLabel = LABEL_LOGIN[d.aktivitas_login.status];

      let detailQuiz = '';
      if (d.tren_quiz.status !== 'data_kurang') {
        detailQuiz = `${d.tren_quiz.rata_terbaru} (sebelumnya ${d.tren_quiz.rata_sebelumnya})`;
      }
      let detailTugas = '';
      if (d.ketepatan_tugas.status !== 'data_kurang') {
        detailTugas = `${d.ketepatan_tugas.tepat_waktu}/${d.ketepatan_tugas.total_tugas} tepat waktu`;
      }
      let detailLogin = '';
      if (d.aktivitas_login.hari_sejak_login !== undefined) {
        detailLogin = `${d.aktivitas_login.hari_sejak_login} hari lalu`;
      }

      return `
        <div class="analitik-row">
          <div class="analitik-murid">
            <span class="analitik-avatar">${chatAvatarHtml(d.murid.avatar || '👤', '32px')}</span>
            <div>
              <div class="analitik-nama">${escapeHtml(d.murid.nama)}</div>
              <div class="analitik-xp">Level ${d.murid.level || 1} · ${d.murid.xp || 0} XP</div>
            </div>
          </div>
          <div class="analitik-sinyal">
            ${chip(quizLabel)}
            ${detailQuiz ? `<div class="analitik-detail">${detailQuiz}</div>` : ''}
          </div>
          <div class="analitik-sinyal">
            ${chip(tugasLabel)}
            ${detailTugas ? `<div class="analitik-detail">${detailTugas}</div>` : ''}
          </div>
          <div class="analitik-sinyal">
            ${chip(loginLabel)}
            ${detailLogin ? `<div class="analitik-detail">${detailLogin}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    wrap.innerHTML = `
      <div class="analitik-header-row">
        <div class="analitik-murid">Murid</div>
        <div>Tren Nilai Quiz</div>
        <div>Ketepatan Tugas</div>
        <div>Aktivitas Login</div>
      </div>
      ${baris}
      <div class="analitik-catatan">${escapeHtml(catatan || '')}</div>
    `;
  }

  return { aktifkanTab, bukaTab };
})();