// ============================================================
//  DASHBOARD GURU
// ============================================================
// Email akun developer yang boleh lihat error log

async function loadGuruDashboard() {
  showPage('page-guru');
  onGuruPageShown();
  if (!currentUser) return;

  // Tampilkan tombol error log hanya untuk developer
  const btnLog = document.getElementById('btn-error-log');
  if (btnLog) btnLog.style.display = DEV_EMAILS.includes(currentUser.email) ? 'inline-block' : 'none';

  document.getElementById('guru-nav-name').textContent = currentUser.nama.split(' ')[0];
  syncAvatarUI(currentUser.avatar || '👩‍🏫', 'guru');

  showLoading(true);
  try {
    const [dashData, kelasData] = await Promise.all([
      api('GET', '/dashboard'),
      api('GET', '/kelas').catch(() => ({}))
    ]);

    if (dashData.success) {
      const s = dashData.data?.stats || {};
      document.getElementById('stat-murid').textContent = s.total_murid ?? '–';
      document.getElementById('stat-materi').textContent = s.total_materi ?? '–';
      document.getElementById('stat-soal').textContent = s.total_soal ?? '–';
      document.getElementById('stat-nilai').textContent = s.rata_rata_nilai != null ? s.rata_rata_nilai + '%' : '–%';
      document.getElementById('guru-info').textContent = `${s.total_murid || 0} murid aktif · ${s.total_materi || 0} materi`;
    }

    const grid = document.getElementById('guru-kelas-grid');
    const list = kelasData.kelas || kelasData.data || kelasData.list || dashData.kelas || [];
    window._kelasList = list;
    if (list.length > 0) {
      grid.innerHTML = list.map((k, i) => renderKelasCard(k, i, 'guru')).join('');
    } else {
      const mapelList = getMapelList();
      if (!mapelList || mapelList.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📖</div><p>Tambahkan <strong>Mata Pelajaran</strong> dulu, lalu buat kelas!</p><button onclick="openTambahMapel()" style="margin-top:12px;background:var(--orange);color:white;border:none;padding:8px 20px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:13px;cursor:pointer">＋ Tambah Mapel</button></div>';
      } else {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏫</div><p>Belum ada kelas. Klik <strong>Buat Kelas</strong> untuk mulai!</p></div>';
      }
    }
  } catch(e) {
    toast('Gagal memuat data dashboard', 'error');
  }
  showLoading(false);

  await loadMapelFromServer();
  populateMapelSelects();
  renderGuruMapelPanel();
  populateBuatKelasMapel();
  loadGuruSoalPreview();
  loadPenilaian();
}

function renderQuizPenilaianCard(q) {
  const tipeLabel = q.tipe === 'pr' ? '📝 PR' : '🎮 Fun Quiz';
  const headerGrad = q.tipe === 'pr'
    ? 'linear-gradient(135deg,#7C3AED,#A78BFA)'
    : 'linear-gradient(135deg,#4D96FF,#6AADFF)';
  const deadlineInfo = q.deadline
    ? `<div style="font-size:11px;color:rgba(255,255,255,0.8)">⏰ Deadline: ${new Date(q.deadline).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</div>`
    : '';
  const totalMurid = q.total_murid || 0;
  const sudah = q.total_pengerjaan || 0;
  const progressPct = totalMurid > 0 ? Math.round((sudah / totalMurid) * 100) : 0;
  const belum = q.belum_mengerjakan || [];

  return `
    <div style="margin-bottom:16px;border:2px solid #eee;border-radius:16px;overflow:hidden">
      <div style="background:${headerGrad};padding:14px 18px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="background:rgba(255,255,255,0.25);color:white;font-size:10px;font-weight:800;padding:2px 8px;border-radius:50px">${tipeLabel}</span>
            </div>
            <div style="font-weight:800;font-size:15px;color:white;margin-bottom:2px">${q.judul}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.8)">${q.mapel}</div>
            ${deadlineInfo}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:26px;font-weight:900;color:white;line-height:1">${q.rata_rata !== null ? q.rata_rata : '–'}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.8);margin-bottom:6px">Rata-rata</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.9);font-weight:700">${sudah}${totalMurid > 0 ? '/' + totalMurid : ''} murid</div>
          </div>
        </div>
        ${totalMurid > 0 ? `
        <div style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.75);font-weight:700;margin-bottom:4px">
            <span>Progress pengerjaan</span><span>${progressPct}%</span>
          </div>
          <div style="background:rgba(255,255,255,0.2);border-radius:50px;height:6px;overflow:hidden">
            <div style="height:100%;width:${progressPct}%;background:white;border-radius:50px;transition:width 0.4s"></div>
          </div>
        </div>` : ''}
      </div>
      ${q.hasil.length > 0 ? `
      <div style="padding:12px 18px">
        <div style="font-size:11px;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">✅ Sudah ${q.tipe_submission ? 'Mengumpulkan' : 'Mengerjakan'} (${sudah})</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="color:var(--muted);border-bottom:1px solid #eee">
              <th style="text-align:left;padding:6px 0;font-weight:700">Murid</th>
              <th style="text-align:center;padding:6px 0;font-weight:700">${q.tipe_submission ? 'Nilai' : 'Skor'}</th>
              ${!q.tipe_submission ? `<th style="text-align:center;padding:6px 0;font-weight:700">Benar</th>` : ''}
              <th style="text-align:right;padding:6px 0;font-weight:700">${q.tipe_submission ? 'Dikumpulkan' : 'Waktu'}</th>
            </tr>
          </thead>
          <tbody>
            ${q.hasil.map(h => `
              <tr style="border-bottom:1px solid #f5f5f5">
                <td style="padding:7px 0">
                  <span style="margin-right:6px;display:inline-flex;width:20px;height:20px;border-radius:50%;overflow:hidden;align-items:center;justify-content:center;font-size:14px;vertical-align:middle;background:#eee">${chatAvatarHtml(h.avatar||'🦁')}</span>
                  <span style="font-weight:700">${h.nama}</span>
                </td>
                <td style="text-align:center;padding:7px 0">
                  ${h.skor != null
                    ? `<span style="background:${h.skor >= 80 ? 'var(--green)' : h.skor >= 60 ? '#E6A817' : 'var(--red)'};color:white;padding:3px 10px;border-radius:50px;font-weight:800;font-size:13px">${h.skor}</span>`
                    : `<span style="background:#F5F5F5;color:var(--muted);padding:3px 10px;border-radius:50px;font-weight:700;font-size:12px">Belum dinilai</span>`}
                </td>
                ${!q.tipe_submission ? `<td style="text-align:center;padding:7px 0;color:var(--muted);font-size:12px;font-weight:700">${h.benar != null && h.total_soal ? h.benar + '/' + h.total_soal : '–'}</td>` : ''}
                <td style="text-align:right;padding:7px 0;color:var(--muted);font-size:12px">
                  ${h.waktu_selesai ? new Date(h.waktu_selesai).toLocaleDateString('id-ID', {day:'numeric',month:'short'}) + ' ' + new Date(h.waktu_selesai).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '–'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${belum.length > 0 ? `
        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed #eee">
          <div style="font-size:11px;font-weight:800;color:var(--red);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">⏳ Belum ${q.tipe_submission ? 'Mengumpulkan' : 'Mengerjakan'} (${belum.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${belum.map(m => `<span style="background:#FFEFE8;color:var(--red);border-radius:50px;padding:4px 12px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px"><span style="width:16px;height:16px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${chatAvatarHtml(m.avatar||'🦁')}</span>${m.nama}</span>`).join('')}
          </div>
        </div>` : (totalMurid > 0 ? `<div style="margin-top:10px;padding:8px 12px;background:#F0FFF4;border-radius:10px;font-size:13px;font-weight:700;color:var(--green)">✅ Semua murid sudah ${q.tipe_submission ? 'mengumpulkan' : 'mengerjakan'}!</div>` : '')}
      </div>` : `
      <div style="padding:14px 18px">
        <div style="color:var(--muted);font-size:13px;margin-bottom:${belum.length > 0 ? '10px' : '0'}">Belum ada murid yang ${q.tipe_submission ? 'mengumpulkan' : 'mengerjakan'}.</div>
        ${belum.length > 0 ? `
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">⏳ Belum ${q.tipe_submission ? 'Mengumpulkan' : 'Mengerjakan'} (${belum.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${belum.map(m => `<span style="background:#F5F5F5;color:var(--muted);border-radius:50px;padding:4px 12px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px"><span style="width:16px;height:16px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${chatAvatarHtml(m.avatar||'🦁')}</span>${m.nama}</span>`).join('')}
        </div>` : ''}
      </div>`}
    </div>`;
}

async function loadPenilaianKelas(kelasId) {
  const el = document.getElementById('kelas-penilaian-stream');
  if (!el) return;
  el.innerHTML = skeletonHtml('table', 6);
  try {
    const data = await api('GET', `/dashboard/penilaian?kelas_id=${kelasId}`);
    if (!data.success || !data.data || data.data.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px"><div style="font-size:40px;margin-bottom:12px">📊</div><div>Belum ada data penilaian untuk kelas ini.</div><div style="font-size:13px;margin-top:6px">Murid perlu mengerjakan soal terlebih dahulu.</div></div>';
      return;
    }
    const byKelas = data.by_kelas || [];
    const klsData = byKelas[0];
    if (!klsData) { el.innerHTML = data.data.map(q => renderQuizPenilaianCard(q)).join(''); return; }
    const hasFun = klsData.fun_quiz && klsData.fun_quiz.length > 0;
    const hasPR = klsData.pr && klsData.pr.length > 0;
    if (!hasFun && !hasPR) {
      el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px"><div style="font-size:40px;margin-bottom:12px">📊</div><div>Belum ada data penilaian untuk kelas ini.</div></div>';
      return;
    }
    // Hitung rata-rata kelas
    const quizDenganHasil = data.data.filter(q => q.rata_rata !== null);
    const rataKelas = quizDenganHasil.length > 0
      ? Math.round(quizDenganHasil.reduce((s, q) => s + q.rata_rata, 0) / quizDenganHasil.length)
      : null;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div style="font-size:13px;color:var(--muted);font-weight:700">Total: ${data.data.length} kuis/tugas</div>
        ${rataKelas !== null ? `<div style="background:var(--green);color:white;padding:6px 16px;border-radius:50px;font-weight:800;font-size:14px">Rata-rata: ${rataKelas}</div>` : ''}
      </div>
      ${hasFun ? `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:800;color:#FF6B35;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🎮 Fun Quiz (${klsData.fun_quiz.length})</div>
          ${klsData.fun_quiz.map(q => renderQuizPenilaianCard(q)).join('')}
        </div>` : ''}
      ${hasPR ? `
        <div>
          <div style="font-size:12px;font-weight:800;color:#7C3AED;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📝 PR / Tugas (${klsData.pr.length})</div>
          ${klsData.pr.map(q => renderQuizPenilaianCard(q)).join('')}
        </div>` : ''}`;
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Gagal memuat data penilaian.</div>';
  }
}

async function loadPenilaian() {
  const el = document.getElementById('guru-penilaian-list');
  if (!el) return;
  try {
    const data = await api('GET', '/dashboard/penilaian');
    if (!data.success || !data.data || data.data.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:14px">Belum ada data penilaian. Murid perlu mengerjakan soal terlebih dahulu.</div>';
      document.getElementById('stat-nilai').textContent = '–%';
      return;
    }

    // Hitung rata-rata keseluruhan
    const quizDenganHasil = data.data.filter(q => q.rata_rata !== null);
    const rataKeseluruhan = quizDenganHasil.length > 0
      ? Math.round(quizDenganHasil.reduce((s, q) => s + q.rata_rata, 0) / quizDenganHasil.length)
      : null;
    document.getElementById('stat-nilai').textContent = rataKeseluruhan !== null ? rataKeseluruhan + '%' : '–%';

    // Tampilkan per kelas, dipisah fun quiz dan PR
    const byKelas = data.by_kelas || [];
    if (byKelas.length === 0) {
      el.innerHTML = data.data.map(q => renderQuizPenilaianCard(q)).join('');
      return;
    }

    el.innerHTML = byKelas.map(kls => {
      const hasFun = kls.fun_quiz && kls.fun_quiz.length > 0;
      const hasPR = kls.pr && kls.pr.length > 0;
      if (!hasFun && !hasPR) return '';
      return `
        <div style="margin-bottom:28px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:4px;height:24px;background:var(--blue);border-radius:4px"></div>
            <div>
              <div style="font-weight:800;font-size:16px">${kls.kelas_nama}</div>
              ${kls.kelas_mapel ? `<div style="font-size:12px;color:var(--muted);font-weight:600">📖 ${kls.kelas_mapel}</div>` : ''}
            </div>
          </div>
          ${hasFun ? `
            <div style="margin-bottom:10px">
              <div style="font-size:12px;font-weight:800;color:#FF6B35;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🎮 Fun Quiz (${kls.fun_quiz.length})</div>
              ${kls.fun_quiz.map(q => renderQuizPenilaianCard(q)).join('')}
            </div>` : ''}
          ${hasPR ? `
            <div>
              <div style="font-size:12px;font-weight:800;color:#7C3AED;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📝 PR / Tugas (${kls.pr.length})</div>
              ${kls.pr.map(q => renderQuizPenilaianCard(q)).join('')}
            </div>` : ''}
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Gagal memuat data penilaian.</div>';
  }
}

async function loadGuruSoalPreview() {
  const el = document.getElementById('guru-soal-preview');
  if (!el) return;
  try {
    const data = await api('GET', '/soal');
    const soalList = data.soal || data.data || [];
    if (soalList.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted)">
        <div style="font-size:36px;margin-bottom:8px">📭</div>
        <p style="font-size:13px">Belum ada soal. Klik <strong>＋ Buat Soal</strong> untuk mulai!</p>
      </div>`;
      return;
    }
    // Tampilkan max 5 soal terbaru + tombol lihat semua
    const tampil = soalList.slice(0, 5);
    // Simpan data soal ke cache global agar bisa diakses via ID
    window._soalCache = window._soalCache || {};
    tampil.forEach(s => { window._soalCache[s.id] = s; });
    el.innerHTML = tampil.map(s => {
      const jenis = s.jenis === 'pilihan_ganda' ? '🔵 PG' : s.jenis === 'isian' ? '✍️ Essay' : '✅ B/S';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
        <div style="font-size:20px">${s.emoji || '❓'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.pertanyaan}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${jenis} · ${s.mapel || '–'} · ${s.poin || 100} poin</div>
        </div>
        <button onclick="editSoalDashboard(window._soalCache['${s.id}'])" title="Edit" style="background:none;border:none;cursor:pointer;font-size:14px;opacity:0.4;flex-shrink:0;padding:4px;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">✏️</button>
        <button onclick="hapusSoalDashboard('${s.id}', this)" title="Hapus" style="background:none;border:none;cursor:pointer;font-size:14px;opacity:0.35;flex-shrink:0;padding:4px;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">🗑️</button>
      </div>`;
    }).join('') +
    (soalList.length > 5 ? `<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--muted);font-weight:700">+${soalList.length - 5} soal lainnya · Total <strong>${soalList.length} soal</strong></div>` : `<div style="text-align:right;margin-top:8px;font-size:12px;color:var(--muted)">Total <strong>${soalList.length} soal</strong></div>`);
  } catch(e) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);font-size:13px">Gagal memuat soal</div>';
  }
}

async function hapusSoalDashboard(id, btn) {
  if (!confirm('Hapus soal ini?')) return;
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = await api('DELETE', `/soal/${id}`);
    if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
      btn.closest('div[style*="border-bottom"]').remove();
      toast('Soal dihapus! 🗑️', 'success');
      loadGuruSoalPreview();
    } else {
      toast(data.pesan || 'Gagal hapus', 'error');
      btn.disabled = false; btn.textContent = '🗑️';
    }
  } catch(e) { toast('Gagal terhubung', 'error'); btn.disabled = false; btn.textContent = '🗑️'; }
}

function editSoalDashboard(s) {
  // s adalah objek soal lengkap dari loadGuruSoalPreview
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch(e) { return; } }
  const opsi = typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []);
  const tipe = s.jenis || 'pilihan_ganda';
  let jawabanIdx = null;
  if (tipe === 'pilihan_ganda') {
    jawabanIdx = opsi.findIndex(o => o === s.jawaban);
    if (jawabanIdx < 0) jawabanIdx = null;
  }
  sbFromKuis = false;
  sbSoalList = [{
    id: Date.now(),
    tipe,
    pertanyaan: s.pertanyaan || '',
    opsi: opsi.length ? opsi : ['', '', '', ''],
    jawabanIdx,
    jawaban: s.jawaban || '',
    mapel: s.mapel || 'Umum',
    poin: s.poin || 100,
    tingkat: s.tingkat || 'sedang',
    dbId: s.id  // existing ID → PUT saat simpan
  }];
  sbAktifIdx = 0;
  sbPopulateMapel();
  document.getElementById('sb-judul-label').textContent = 'Edit Soal';
  showPage('page-soal-builder');
  sbMuatSoal(0);
  sbUpdateCount();
  setTimeout(sbCheckMobile, 50);
}

function populateBuatKelasMapel() {
  const list = getMapelList();
  const el = document.getElementById('bk-mapel');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
    : '<option value="">– Belum ada mapel –</option>';
}