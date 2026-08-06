// ============================================================
//  Inisialisasi global dilakukan di app-core (load handler).
//  Modul ini hanya berisi fungsi-fitur kuis/PR/submission.
// ============================================================

// ============================================================
//  TABS KELAS
// ============================================================
currentKelasTab = 'materi';

function switchKelasTab(tab) {
  currentKelasTab = tab;
  document.getElementById('tab-materi-btn').classList.toggle('active', tab === 'materi');
  document.getElementById('tab-kuis-btn').classList.toggle('active', tab === 'kuis');
  document.getElementById('tab-murid-btn').classList.toggle('active', tab === 'murid');
  document.getElementById('tab-chat-btn').classList.toggle('active', tab === 'chat');
  document.getElementById('tab-penilaian-btn')?.classList.toggle('active', tab === 'penilaian');
  document.getElementById('tab-analitik-btn')?.classList.toggle('active', tab === 'analitik');
  document.getElementById('kelas-stream').style.display = tab === 'materi' ? 'block' : 'none';
  document.getElementById('kelas-kuis-stream').style.display = tab === 'kuis' ? 'block' : 'none';
  document.getElementById('kelas-murid-stream').style.display = tab === 'murid' ? 'block' : 'none';
  document.getElementById('kelas-chat-stream').style.display = tab === 'chat' ? 'block' : 'none';
  document.getElementById('kelas-penilaian-stream').style.display = tab === 'penilaian' ? 'block' : 'none';
  const analitikStream = document.getElementById('kelas-analitik-stream');
  if (analitikStream) analitikStream.style.display = tab === 'analitik' ? 'block' : 'none';
  if (tab === 'murid' && currentKelas) loadKelasMurid(currentKelas.id);
  if (tab === 'penilaian' && currentKelas) loadPenilaianKelas(currentKelas.id);
  if (tab === 'analitik' && typeof AnalitikGuru !== 'undefined') AnalitikGuru.bukaTab();
  if (tab === 'chat') {
    classChatUnreadCount = 0;
    updateClassChatBadge();
    scrollChatToBottom();
  }
}

// ============================================================
//  KUIS KELAS — LOAD
// ============================================================
semua_soal_cache = [];

allKuisData = []; // cache untuk filter
activeKuisFilter = 'semua';
activeKuisSort = localStorage.getItem('kb_kuis_sort') || 'deadline_terdekat';

function filterKuis(tipe) {
  activeKuisFilter = tipe;
  // Update tombol aktif
  ['semua','fun','pr','deadline'].forEach(t => {
    document.getElementById('filter-' + t)?.classList.toggle('active', t === tipe);
  });
  renderKuisFiltered();
}

function gantiKuisSort(sortTipe) {
  activeKuisSort = sortTipe;
  localStorage.setItem('kb_kuis_sort', sortTipe);
  renderKuisFiltered();
}

function renderKuisFiltered() {
  const isGuru = currentUser?.role === 'guru';
  const now = new Date();
  let filtered = [...allKuisData];

  if (activeKuisFilter === 'fun') {
    filtered = filtered.filter(q => q.tipe === 'fun' || !q.tipe);
  } else if (activeKuisFilter === 'pr') {
    filtered = filtered.filter(q => q.tipe === 'pr');
  } else if (activeKuisFilter === 'deadline') {
    filtered = filtered.filter(q => {
      if (!q.deadline) return false;
      const diff = new Date(q.deadline) - now;
      return diff > 0 && diff < 86400000 * 3; // 3 hari ke depan
    });
  }

  const selectEl = document.getElementById('kuis-sort-select');
  if (selectEl) selectEl.value = activeKuisSort;

  if (activeKuisSort === 'deadline_terdekat') {
    filtered.sort((a, b) => {
      const dA = a.deadline ? new Date(a.deadline) : null;
      const dB = b.deadline ? new Date(b.deadline) : null;
      if (!dA && !dB) return new Date(b.created_at) - new Date(a.created_at);
      if (!dA) return 1;
      if (!dB) return -1;
      return dA - dB;
    });
  } else if (activeKuisSort === 'deadline_terjauh') {
    filtered.sort((a, b) => {
      const dA = a.deadline ? new Date(a.deadline) : null;
      const dB = b.deadline ? new Date(b.deadline) : null;
      if (!dA && !dB) return new Date(b.created_at) - new Date(a.created_at);
      if (!dA) return 1;
      if (!dB) return -1;
      return dB - dA;
    });
  } else if (activeKuisSort === 'terbaru') {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (activeKuisSort === 'terlama') {
    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  const container = document.getElementById('kuis-list-container');
  if (!container) return;

  if (filtered.length === 0) {
    const labels = { semua: 'belum ada kuis atau tugas', fun: 'belum ada Fun Quiz', pr: 'belum ada Tugas/PR', deadline: 'tidak ada tugas dengan deadline dekat' };
    if (isGuru && (activeKuisFilter === 'semua' || activeKuisFilter === 'fun' || activeKuisFilter === 'pr')) {
      const isFun = activeKuisFilter !== 'pr';
      const isPr = activeKuisFilter !== 'fun';
      container.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
        ${isFun ? `<div onclick="tambahKuisBaru('fun')"
          style="border:2.5px dashed #FFCC99;border-radius:18px;padding:28px 24px;text-align:center;cursor:pointer;transition:all 0.2s;background:#FFFAF5"
          onmouseover="this.style.borderColor='var(--orange)';this.style.background='#FFF3E6'"
          onmouseout="this.style.borderColor='#FFCC99';this.style.background='#FFFAF5'">
          <div style="font-size:36px;margin-bottom:10px">⚡</div>
          <div style="font-weight:800;font-size:14px;color:var(--orange);margin-bottom:4px">Belum ada Fun Quiz</div>
          <div style="font-size:12px;color:var(--muted)">Klik di sini untuk membuat Fun Quiz</div>
        </div>` : ''}
        ${isPr ? `<div onclick="tambahKuisBaru('pr')"
          style="border:2.5px dashed #A0C4FF;border-radius:18px;padding:28px 24px;text-align:center;cursor:pointer;transition:all 0.2s;background:#F5F9FF"
          onmouseover="this.style.borderColor='var(--blue)';this.style.background='#EEF5FF'"
          onmouseout="this.style.borderColor='#A0C4FF';this.style.background='#F5F9FF'">
          <div style="font-size:36px;margin-bottom:10px">📝</div>
          <div style="font-weight:800;font-size:14px;color:var(--blue);margin-bottom:4px">Belum ada Tugas/PR</div>
          <div style="font-size:12px;color:var(--muted)">Klik di sini untuk membuat Tugas/PR</div>
        </div>` : ''}
      </div>`;
    } else {
      container.innerHTML = `<div style="text-align:center;padding:40px 24px">
        <div style="font-size:48px;margin-bottom:12px">📋</div>
        <p style="font-weight:700;color:var(--text);margin-bottom:6px">Kosong!</p>
        <p style="font-size:14px;color:var(--muted)">${isGuru ? `Belum ada ${labels[activeKuisFilter]}` : `${labels[activeKuisFilter].charAt(0).toUpperCase() + labels[activeKuisFilter].slice(1)}`}</p>
      </div>`;
    }
    return;
  }
  container.innerHTML = filtered.map(q => renderKuisCard(q, isGuru)).join('');
}

async function loadKelasKuis(kelasId) {
  const el = document.getElementById('kelas-kuis-stream');
  const container = document.getElementById('kuis-list-container');
  if (container) container.innerHTML = skeletonHtml('card', 3);

  const isGuru = currentUser?.role === 'guru';
  try {
    const data = await api('GET', `/quiz?kelas_id=${kelasId}`);
    allKuisData = data.quiz || data.data || [];

    // Cek status pengerjaan / submission murid — semua paralel
    if (!isGuru) {
      await Promise.all(allKuisData.map(async q => {
        try {
          if (q.tipe_submission) {
            const cek = await api('GET', `/quiz/${q.id}/submission/cek`);
            q.sudah_dikerjakan = cek.sudah || false;
            q.nilai_submission = cek.submission?.nilai ?? null;
            q.feedback_submission = cek.submission?.feedback ?? null;
          } else {
            const cek = await api('GET', `/quiz/hasil/cek?quiz_id=${q.id}`);
            q.sudah_dikerjakan = cek.sudah || false;
            q.skor_terakhir = cek.hasil?.skor || 0;
            q.attempt = cek.attempt || 0;
            q.max_attempt = cek.max_attempt ?? 1;
          }
        } catch(e) { q.sudah_dikerjakan = false; }
      }));
      tampilDeadlineAlert(allKuisData);
    }

    // Reset filter ke semua
    activeKuisFilter = 'semua';
    ['semua','fun','pr','deadline'].forEach(t => {
      document.getElementById('filter-' + t)?.classList.toggle('active', t === 'semua');
    });

    // Update badge count filter deadline
    const now = new Date();
    const jumlahDeadline = allKuisData.filter(q => {
      if (!q.deadline || q.sudah_dikerjakan) return false;
      const diff = new Date(q.deadline) - now;
      return diff > 0 && diff < 86400000 * 3;
    }).length;
    const filterDeadlineBtn = document.getElementById('filter-deadline');
    if (filterDeadlineBtn) {
      filterDeadlineBtn.textContent = `⏰ Deadline Dekat${jumlahDeadline > 0 ? ` (${jumlahDeadline})` : ''}`;
      if (jumlahDeadline > 0) filterDeadlineBtn.style.borderColor = 'var(--red)';
    }

    renderKuisFiltered();
  } catch(e) {
    if (container) container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat. Pastikan backend sudah ada route /api/quiz</p></div>';
  }
}

function renderKuisCard(q, isGuru) {
  const isFun = q.tipe === 'fun' || !q.tipe;
  const icon = isFun ? '⚡' : '📝';
  const iconBg = isFun ? 'linear-gradient(135deg,#FF6B35,#FF8C42)' : 'linear-gradient(135deg,#4D96FF,#6AADFF)';
  const tglBuat = new Date(q.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'long' });

  const sudahDikerjakan = q.sudah_dikerjakan || false;

  let deadlineHtml = '';
  let feedbackHtml = '';
  const deadlineLewat = !isFun && q.deadline && new Date(q.deadline) < new Date();
  const deadlineLewatUmum = q.deadline && new Date(q.deadline) < new Date();
  if (!isFun && q.deadline && !sudahDikerjakan && !deadlineLewat) {
    const dl = new Date(q.deadline);
    const now = new Date();
    const diff = dl - now;
    const cls = diff < 86400000 ? 'deadline-soon' : 'deadline-ok';
    const label = diff < 3600000 ? `⏰ ${Math.floor(diff/60000)} menit lagi` : diff < 86400000 ? `⚠️ ${Math.floor(diff/3600000)} jam lagi` : `📅 ${dl.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})} ${dl.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`;
    deadlineHtml = `<div class="qsc-deadline ${cls}">${label}</div>`;
  }

  let actionHtml = '';
  const isSubmission = !!q.tipe_submission;

  if (isGuru) {
    const reopenBtn = deadlineLewatUmum
      ? `<button onclick="bukaUlangKuis('${q.id}')" title="Aktifkan kembali tugas yang tenggatnya lewat" style="background:#FFF0EC;color:var(--red);border:1.5px solid #FFC9C0;border-radius:10px;padding:7px 14px;font-family:Nunito,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;transition:all 0.2s" onmouseover="this.style.background='var(--red)';this.style.color='white'" onmouseout="this.style.background='#FFF0EC';this.style.color='var(--red)'">⏰ Aktifkan Kembali</button>`
      : '';
    actionHtml = `<div style="display:flex;gap:6px;align-items:center">
      <button onclick="previewKuisSoal('${q.id}')" title="Preview soal seperti yang dilihat murid" style="background:#FFF3E6;color:var(--orange);border:1.5px solid #FFD9B3;border-radius:10px;padding:7px 14px;font-family:Nunito,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;transition:all 0.2s" onmouseover="this.style.background='var(--orange)';this.style.color='white'" onmouseout="this.style.background='#FFF3E6';this.style.color='var(--orange)'">👁️ Preview</button>
      ${reopenBtn}
      ${isSubmission ? `<button onclick="lihatSubmissionGuru('${q.id}','${(q.judul||'').replace(/'/g,"\\'")}','${q.kelas_id||''}')" style="background:#EEF5FF;color:var(--blue);border:none;border-radius:10px;padding:7px 14px;font-family:Nunito,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">📋 Lihat Submission</button>` : ''}
      <button class="btn-icon btn-delete" onclick="hapusKuis('${q.id}','${(q.judul||'').replace(/'/g,"\\'")}') " title="Hapus">🗑️</button>
    </div>`;
  } else if (isSubmission) {
    if (sudahDikerjakan) {
      const nilai = q.nilai_submission;
      const fb = q.feedback_submission;
      actionHtml = `<div class="qsc-done-badge" style="flex-direction:column;align-items:flex-end;gap:4px;max-width:180px">
        <span>✅ Sudah dikumpulkan</span>
        ${nilai != null ? `<span style="font-size:14px;font-weight:900;color:${nilai>=80?'var(--green)':nilai>=60?'var(--orange)':'var(--red)'}">${nilai}<span style="font-size:11px;font-weight:700"> / 100</span></span>` : '<span style="font-size:11px;color:var(--muted)">Menunggu penilaian...</span>'}
      </div>`;
      if (fb) {
        feedbackHtml = `<div class="qsc-feedback-box" style="font-size:12px;font-weight:700;color:#5A6A9A;background:#EEF5FF;border-radius:10px;padding:8px 12px;box-shadow:0 2px 6px rgba(0,0,0,0.04);word-break:break-word;max-width:280px;display:inline-flex;align-items:center;gap:6px">
          <span>💬 ${fb}</span>
        </div>`;
      }
    } else if (deadlineLewat) {
      actionHtml = `<div class="qsc-deadline deadline-over">⛔ Tenggat terlewat</div>`;
    } else {
      actionHtml = `<button class="qsc-play-btn" style="background:var(--blue);color:white" onclick="bukaFormSubmission('${q.id}')">📤 Kumpulkan</button>`;
    }
  } else if (sudahDikerjakan) {
    const attempt = q.attempt || 1;
    const maxAtt = q.max_attempt ?? 1;
    const isUnlimited = maxAtt === 0;
    const sisa = isUnlimited ? 99 : (maxAtt - attempt);
    const labelAtt = isUnlimited ? `${attempt}x` : `${attempt}/${maxAtt}x`;
    const nilaiColor = q.skor_terakhir >= 80 ? 'var(--green)' : q.skor_terakhir >= 60 ? 'var(--orange)' : 'var(--red)';
    if (isUnlimited || sisa > 0) {
      actionHtml = `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:var(--muted);font-weight:700">${labelAtt}</span>
          <button class="qsc-play-btn" style="background:${isFun ? 'var(--orange)' : 'var(--blue)'};color:white;padding:6px 14px;font-size:12px" onclick="mulaiKuisKelas('${q.id}')">🔄 Coba Lagi</button>
        </div>
        <span style="font-size:14px;font-weight:900;color:${nilaiColor}">${q.skor_terakhir || 0}<span style="font-size:10px;font-weight:700"> / 100</span></span>
      </div>`;
    } else {
      actionHtml = `<div class="qsc-done-badge" style="flex-direction:column;align-items:flex-end;gap:2px">
        <span>✅ Selesai (${labelAtt})</span>
        <span style="font-size:15px;font-weight:900;color:${nilaiColor}">${q.skor_terakhir || 0}<span style="font-size:11px;font-weight:700"> / 100</span></span>
      </div>`;
    }
  } else if (deadlineLewat) {
    actionHtml = `<div class="qsc-deadline deadline-over">⛔ Tenggat terlewat</div>`;
  } else {
    const totalSoal = q.total_soal || q.jumlah_soal || 0;
    const maxAtt = q.max_attempt ?? 1;
    if (!isSubmission && totalSoal === 0) {
      actionHtml = `<div style="font-size:12px;color:var(--muted);font-weight:700;background:#F5F5F5;padding:7px 14px;border-radius:10px">📭 Belum ada soal</div>`;
    } else {
      const attLabel = maxAtt === 0 ? '' : (maxAtt > 1 ? `${maxAtt}x percobaan` : '');
      actionHtml = `<div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--muted);font-weight:700">${attLabel}</span>
        <button class="qsc-play-btn" style="background:${isFun ? 'var(--orange)' : 'var(--blue)'};color:white" onclick="mulaiKuisKelas('${q.id}')">
          ${isFun ? '⚡ Main!' : '📝 Kerjakan'}
        </button>
      </div>`;
    }
  }

  return `<div class="quiz-stream-card" style="background:white">
    <div class="qsc-header">
      <div class="qsc-icon" style="background:${iconBg}">${icon}</div>
      <div class="qsc-meta">
        <div class="qsc-title">${q.judul}</div>
        ${q.deskripsi ? `<div style="font-size:13px;color:var(--text);margin:3px 0 4px;line-height:1.4;font-weight:600">${q.deskripsi}</div>` : ''}
        <div class="qsc-sub">
          <span>${isFun ? '⚡ Fun Quiz' : '📝 Tugas / PR'}</span>
          <span>·</span>
          <span>${tglBuat}</span>
        </div>
      </div>
      ${isGuru ? actionHtml : ''}
    </div>
    <div class="qsc-body" style="flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;flex-wrap:wrap">
        <div class="qsc-stats">
          ${isSubmission
            ? `<div class="qsc-stat" style="background:#EEF5FF"><div class="qsc-stat-num" style="font-size:16px">${{'file':'📄','gambar':'🖼️','link':'🔗','teks':'✏️','semua':'📤'}[q.tipe_submission]||'📤'}</div><div class="qsc-stat-label">Submission</div></div>`
            : `<div class="qsc-stat"><div class="qsc-stat-num">${(q.total_soal || q.jumlah_soal) > 0 ? (q.total_soal || q.jumlah_soal) : '0'}</div><div class="qsc-stat-label">Soal</div></div>`
          }
          ${isFun && !isSubmission ? `<div class="qsc-stat"><div class="qsc-stat-num">${q.durasi || 15}s</div><div class="qsc-stat-label">Per soal</div></div>` : ''}
        </div>
        ${feedbackHtml}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${deadlineHtml}
        ${!isGuru ? actionHtml : ''}
      </div>
    </div>
  </div>`;
}

// ============================================================
//  PREVIEW KUIS (GURU) — READ-ONLY
//  Menampilkan soal persis seperti yang dilihat murid, tanpa
//  menyimpan apa pun ke database. Mode guru → jawaban benar
//  bisa ditampilkan (toggle) dan ditandai jelas.
// ============================================================
_previewKuisState = null; // { quiz, showJawaban }

const _PREVIEW_TIPE_SOAL = {
  pilihan_ganda: '🔵 Pilihan Ganda',
  isian:         '✍️ Esai / Isian',
  benar_salah:   '⭕ Benar / Salah'
};

function _previewTipeLabel(jenis) {
  return _PREVIEW_TIPE_SOAL[jenis] || ('❓ ' + (jenis || 'soal'));
}

async function previewKuisSoal(quizId) {
  showLoading(true);
  try {
    const data = await api('GET', `/quiz/${quizId}/preview`);
    if (!data.success || !data.quiz) {
      toast(data.pesan || 'Gagal memuat preview', 'error');
      showLoading(false);
      return;
    }
    const quiz = data.quiz;
    _previewKuisState = {
      quiz,
      showJawaban: document.getElementById('preview-tampilkan-jawaban')?.checked !== false
    };

    document.getElementById('preview-kuis-judul').textContent = '👁️ ' + (quiz.judul || 'Preview Tugas/Kuis');

    const isFun = (quiz.tipe || 'fun') === 'fun';
    const subTipeLabel = { file: '📄 File/PDF', gambar: '🖼️ Foto/Gambar', link: '🔗 Link', teks: '✏️ Teks', semua: '📤 Semua Jenis' };
    const tipeLabel = quiz.tipe_submission
      ? '📤 Tugas (' + (subTipeLabel[quiz.tipe_submission] || quiz.tipe_submission) + ')'
      : (isFun ? '⚡ Fun Quiz' : '📝 Tugas / PR');
    const statusLabel = quiz.status === 'aktif' ? '📢 Terbit' : '📝 Draft';
    const deadlineChip = quiz.deadline
      ? '⏰ ' + new Date(quiz.deadline).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) + ' ' + new Date(quiz.deadline).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
      : '';
    const chips = [
      '📚 ' + (quiz.mapel || 'Umum'),
      tipeLabel,
      '📋 ' + (quiz.total_soal || 0) + ' soal',
      '🏅 ' + (quiz.total_poin || 0) + ' poin',
      statusLabel,
      !quiz.tipe_submission && quiz.durasi ? '⏱️ ' + quiz.durasi + 's/soal' : '',
      deadlineChip
    ].filter(Boolean);

    document.getElementById('preview-kuis-meta').innerHTML = chips
      .map(c => '<span style="background:#F5F5F5;border-radius:50px;padding:5px 12px;font-size:12px;font-weight:800;color:var(--text)">' + c + '</span>')
      .join('');

    renderPreviewKuisSoal();
    openModal('modal-preview-kuis');
  } catch(e) {
    console.error('[previewKuisSoal]', e);
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

function togglePreviewJawaban(show) {
  if (!_previewKuisState) return;
  _previewKuisState.showJawaban = show;
  renderPreviewKuisSoal();
}

function renderPreviewKuisSoal() {
  const wrap = document.getElementById('preview-kuis-soal-list');
  if (!wrap) return;
  const state = _previewKuisState;
  if (!state || !state.quiz) return;

  const showJawaban = state.showJawaban;
  const soal = state.quiz.soal || [];

  if (soal.length === 0) {
    wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)"><div style="font-size:44px;margin-bottom:10px">📭</div><p style="font-weight:700">Tugas/Kuis ini belum punya soal.</p></div>';
    return;
  }

  wrap.innerHTML = soal.map((s, i) => {
    const urutan = s.urutan || (i + 1);
    const opsiArr = Array.isArray(s.opsi) ? s.opsi : [];
    const jawaban = (s.jawaban || '').trim();
    const tipeBadge = '<span style="background:#EEF5FF;color:var(--blue);font-size:11px;font-weight:800;padding:3px 10px;border-radius:50px">' + _previewTipeLabel(s.jenis) + '</span>';
    const poinBadge = '<span style="background:#FFF3E6;color:var(--orange);font-size:11px;font-weight:800;padding:3px 10px;border-radius:50px">🏅 ' + (s.poin || 100) + ' poin</span>';

    let bodyHtml;
    if (s.jenis === 'isian' || s.jenis === 'essay') {
      bodyHtml = showJawaban && jawaban
        ? '<div style="padding:12px 14px;border-radius:12px;border:2px dashed #6BCB77;background:#F0FFF4;font-size:13px;font-weight:700;color:#27AE60;margin-top:10px">✅ Kunci jawaban: ' + escapeHtml(jawaban) + '</div>'
        : '<div style="padding:12px 14px;border-radius:12px;border:2px dashed #E8E8E8;background:#FAFAFA;font-size:13px;color:var(--muted);font-weight:700;margin-top:10px">✍️ Murid menulis jawaban bebas (esai)</div>';
    } else {
      const kunciAda = jawaban && opsiArr.some(o => o.trim().toLowerCase() === jawaban.toLowerCase());
      bodyHtml = '<div class="pr-options">' + opsiArr.map((o, oi) => {
        const isCorrect = showJawaban && jawaban && o.trim().toLowerCase() === jawaban.toLowerCase();
        const cls = isCorrect ? ' correct' : '';
        const badge = isCorrect ? '<span style="margin-left:auto;font-size:11px;font-weight:800;color:#27AE60;background:#E8F8EE;border-radius:50px;padding:3px 10px;flex-shrink:0">✓ Kunci jawaban</span>' : '';
        return '<div class="pr-opt' + cls + '" style="display:flex;align-items:center;gap:10px;cursor:default;pointer-events:none">' +
          '<strong>' + String.fromCharCode(65 + oi) + '.</strong>' +
          '<span style="flex:1;word-break:break-word">' + escapeHtml(o) + '</span>' +
          badge +
        '</div>';
      }).join('') + '</div>';
      if (showJawaban && jawaban && !kunciAda) {
        bodyHtml += '<div style="margin-top:8px;background:#FFF3E6;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;color:#B95A0A">⚠️ Kunci jawaban tidak cocok dengan opsi di atas: <strong>' + escapeHtml(jawaban) + '</strong></div>';
      }
    }

    return '<div class="pr-question-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<div style="font-size:12px;color:var(--muted);font-weight:800">Soal ' + urutan + (s.mapel ? ' · ' + escapeHtml(s.mapel) : '') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tipeBadge + poinBadge + '</div>' +
      '</div>' +
      '<div style="font-size:16px;font-weight:800;line-height:1.6;margin-bottom:12px">' + (s.emoji || '') + ' ' + escapeHtml(s.pertanyaan) + '</div>' +
      bodyHtml +
    '</div>';
  }).join('');
}

// ============================================================
//  AKTIFKAN KEMBALI TUGAS (REOPEN) — GURU
//  Untuk tugas/kuis yang tenggatnya sudah lewat. Guru memilih
//  tenggat baru, status kembali aktif, siswa bisa submit lagi.
//  Submission lama tidak diubah. Ada audit trail di backend.
// ============================================================
_reopenKuisState = null; // { id, judul, deadlineLama }

function _toDatetimeLocal(d) {
  const dt = new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function bukaUlangKuis(quizId) {
  const q = (allKuisData || []).find(x => x.id === quizId);
  if (!q) return;
  _reopenKuisState = { id: quizId, judul: q.judul || '', deadlineLama: q.deadline || null };

  const info = document.getElementById('reopen-kuis-info');
  if (info) {
    const lama = q.deadline
      ? new Date(q.deadline).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }) + ' ' + new Date(q.deadline).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
      : 'tidak ditentukan';
    info.innerHTML = `📝 Tugas <strong>${escapeHtml(q.judul || '')}</strong> — tenggat sebelumnya: <strong>${lama}</strong>. Tenggat sudah lewat, siswa tidak bisa mengumpulkan lagi.`;
  }

  const input = document.getElementById('reopen-kuis-deadline');
  if (input) {
    input.value = q.deadline ? _toDatetimeLocal(q.deadline) : '';
    input.min = _toDatetimeLocal(new Date());
  }
  openModal('modal-reopen-kuis');
}

async function submitReopenKuis() {
  const st = _reopenKuisState;
  if (!st) return;
  const raw = document.getElementById('reopen-kuis-deadline').value;
  if (!raw) { toast('Pilih tenggat waktu baru dulu!', 'error'); return; }
  const deadline = new Date(raw);
  if (deadline.getTime() <= Date.now()) { toast('Tenggat baru harus di masa depan!', 'error'); return; }

  showLoading(true);
  try {
    const data = await api('PUT', `/quiz/${st.id}/reopen`, { deadline: deadline.toISOString() });
    if (data.success) {
      toast(data.pesan || 'Tugas diaktifkan kembali!', 'success');
      closeModal('modal-reopen-kuis');
      _reopenKuisState = null;
      loadKelasKuis(currentKelas.id);
    } else {
      toast(data.pesan || 'Gagal mengaktifkan kembali tugas', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

// ============================================================
//  BUAT KUIS
// ============================================================
currentTipeKuis = 'fun';
allSoalData = [];

function switchTipeKuis(tipe) {
  currentTipeKuis = tipe;
  ['fun','pr'].forEach(t => {
    const el = document.getElementById('tipe-' + t);
    const active = t === tipe;
    el.style.border = active ? '2.5px solid var(--orange)' : '2.5px solid #eee';
    el.style.background = active ? '#FFEFE8' : 'white';
    el.querySelector('div:nth-child(2)').style.color = active ? 'var(--orange)' : 'var(--muted)';
  });
  document.getElementById('kuis-deadline-wrap').style.display = tipe === 'pr' ? 'block' : 'none';
  document.getElementById('kuis-durasi-wrap').style.display = tipe === 'fun' ? 'block' : 'none';
  document.getElementById('kuis-submission-wrap').style.display = tipe === 'pr' ? 'block' : 'none';
  if (tipe === 'fun') {
    document.getElementById('kuis-pakai-submission').checked = false;
    document.getElementById('kuis-submission-detail').style.display = 'none';
  }
}

_selectedSubmissionTipe = '';

function toggleSubmissionSection(checked) {
  document.getElementById('kuis-submission-detail').style.display = checked ? 'block' : 'none';
  if (!checked) { _selectedSubmissionTipe = ''; document.getElementById('kuis-submission-tipe').value = ''; }
}

function selectSubmissionTipe(tipe) {
  _selectedSubmissionTipe = tipe;
  document.getElementById('kuis-submission-tipe').value = tipe;
  ['file','gambar','link','teks'].forEach(t => {
    const el = document.getElementById('sub-tipe-' + t);
    if (!el) return;
    el.style.border = t === tipe || tipe === 'semua' ? '2px solid var(--blue)' : '2px solid #eee';
    el.style.background = t === tipe || tipe === 'semua' ? '#EEF5FF' : 'white';
  });
}

kuisSoalTabAktif = 'bank';
aiSoalUntukKuis = []; // soal yang digenerate AI untuk kuis ini

function switchKuisSoalTab(tab) {
  kuisSoalTabAktif = tab;
  document.getElementById('kuis-panel-bank').style.display = tab === 'bank' ? 'block' : 'none';
  document.getElementById('kuis-panel-ai').style.display   = tab === 'ai'   ? 'block' : 'none';
  document.getElementById('kuis-tab-bank').style.background = tab === 'bank' ? 'var(--orange)' : 'white';
  document.getElementById('kuis-tab-bank').style.color      = tab === 'bank' ? 'white' : 'var(--muted)';
  document.getElementById('kuis-tab-ai').style.background   = tab === 'ai' ? 'linear-gradient(135deg,#7b2ff7,#a64cff)' : 'white';
  document.getElementById('kuis-tab-ai').style.color        = tab === 'ai' ? 'white' : 'var(--muted)';
  updateKuisTotalLabel();
}

function updateKuisTotalLabel() {
  const bankCount = document.querySelectorAll('.soal-check:checked').length;
  const aiCount   = document.querySelectorAll('.ai-soal-check:checked').length;
  const total = bankCount + aiCount;
  const label = document.getElementById('kuis-total-label');
  if (label) label.textContent = total > 0 ? `✅ Total ${total} soal dipilih (${bankCount} bank + ${aiCount} AI)` : '';
}

async function generateSoalUntukKuis() {
  // Generate soal untuk kuis/PR biasa oleh guru — manggil /api/ai/chat langsung
  // dengan prompt custom (campuran PG + benar/salah). Ini TERPISAH dari alur
  // generate soal Zep Quiz (/api/zepquiz/ai-generate) yang khusus multiplayer.
  // Keduanya sengaja berbeda (prompt, format output, retry) — jangan digabung
  // tanpa konfirmasi agar tidak merusak kedua fitur.
  const topik   = document.getElementById('kuis-ai-topik').value.trim();
  const jumlah  = parseInt(document.getElementById('kuis-ai-jumlah').value);
  const tingkat = document.getElementById('kuis-ai-tingkat').value;
  const mapel   = document.getElementById('kuis-ai-mapel').value || 'Umum';
  if (!topik) { toast('Masukkan topik soal dulu!', 'error'); return; }

  const btn = document.getElementById('kuis-ai-gen-btn');
  btn.disabled = true;

  // Kurangi batch size ke 3 agar tidak kena rate limit Groq (6000 TPM)
  const BATCH_SIZE = 3;
  const totalBatch = Math.ceil(jumlah / BATCH_SIZE);
  let semuaSoal = [];
  const aspekList = [
    'pengertian dan definisi','contoh dan penerapan nyata','proses dan cara kerja',
    'perbandingan dan perbedaan','fungsi dan manfaat','rumus dan perhitungan',
    'ciri-ciri dan karakteristik','dampak dan akibat','sejarah dan asal-usul','fakta unik'
  ];

  try {
    for (let b = 0; b < totalBatch; b++) {
      const soalBatch = Math.min(BATCH_SIZE, jumlah - semuaSoal.length);
      const sudahAda  = semuaSoal.length;
      btn.textContent = `⏳ Batch ${b+1}/${totalBatch} (${sudahAda}/${jumlah} soal)...`;

      // Sudut pandang acak per batch agar soal lebih bervariasi
      const sudutPandang = [
        'aplikasi nyata di kehidupan sehari-hari','kasus pengecualian dan kondisi khusus',
        'miskonsepsi umum yang harus diluruskan','perbandingan dan perbedaan mendalam',
        'perspektif historis dan perkembangannya','dampak, implikasi, dan konsekuensi',
        'proses mekanisme dan cara kerja detail','fakta jarang diketahui dan unik',
        'hubungan sebab-akibat','analisis kritis dan evaluasi'
      ];
      const sudut = sudutPandang[(b * 3 + Math.floor(Math.random() * sudutPandang.length)) % sudutPandang.length];
      const seed = Math.random().toString(36).substring(2, 9); // variasi unik tiap request

      // Retry logic untuk handle rate limit Groq
      let res, retryCount = 0;
      while (retryCount < 3) {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || localStorage.getItem('kb_token') || '') },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            max_tokens: 1500,
            temperature: 0.98,
            top_p: 0.92,
            messages: [{
              role: 'system',
              content: `Kamu adalah ahli pembuat soal ujian kreatif untuk siswa Indonesia.
ATURAN KETAT — ikuti semua:
1. Balas HANYA JSON object: {"soal":[...]} tanpa teks apapun di luar JSON.
2. Buat CAMPURAN tipe soal: sekitar 65% pilihan_ganda, 35% benar_salah.
3. Untuk pilihan_ganda: "jawaban" HARUS teks PERSIS SAMA dengan salah satu item di "opsi". Verifikasi sebelum menulis.
4. Untuk benar_salah: "opsi" HARUS persis ["Benar","Salah"]. Jawaban harus MIX — sekitar separuh "Benar" dan separuh "Salah". JANGAN semua jawabannya "Benar". Buat pernyataan yang salah agar jawabannya "Salah".
5. VARIASIKAN posisi jawaban benar di PG — jangan selalu opsi pertama.
6. Semua opsi PG harus masuk akal dan relevan, bukan jebakan murahan.
7. Pastikan fakta/jawaban secara akademis BENAR dan tidak ambigu.
8. Setiap soal harus UNIK — topik, angle, dan cara bertanya harus berbeda satu sama lain.`
            }, {
              role: 'user',
              content: `[variasi:${seed}] Buat tepat ${soalBatch} soal UNIK untuk:
- Mata pelajaran: ${mapel}
- Topik: ${topik}
- Aspek fokus: ${aspekList[b % aspekList.length]}
- Sudut pandang kreatif: ${sudut}
- Tingkat kesulitan: ${tingkat}
- Nomor soal: ${sudahAda + 1} s/d ${sudahAda + soalBatch}${semuaSoal.length > 0 ? '\n\nWAJIB BERBEDA dari soal berikut:\n' + semuaSoal.map((s,i) => `${i+1}. ${s.pertanyaan}`).join('\n') : ''}

Format JSON wajib:
{"soal":[
  {"jenis":"pilihan_ganda","pertanyaan":"...?","emoji":"📝","opsi":["A...","B...","C...","D..."],"jawaban":"teks SAMA PERSIS dengan salah satu opsi","poin":100},
  {"jenis":"benar_salah","pertanyaan":"Pernyataan faktual...","emoji":"✅","opsi":["Benar","Salah"],"jawaban":"Benar","poin":75}
]}`
            }]
          })
        });

        const resJson = await res.json();
        // Backend membungkus: { success, data: { choices } } atau { success: false, pesan }
        const resData = resJson.data || resJson;

        // Cek rate limit
        const errMsg = resJson.pesan || resData.error?.message || '';
        if (errMsg.includes('rate_limit') || errMsg.includes('tokens per minute') || errMsg.includes('429')) {
          retryCount++;
          btn.textContent = `⏳ Rate limit! Tunggu ${12 * retryCount} detik... (${retryCount}/3)`;
          toast(`Rate limit AI, retry ke-${retryCount}...`, '');
          await new Promise(r => setTimeout(r, 12000 * retryCount));
          continue;
        }

        if (!resJson.success && resJson.pesan) throw new Error(resJson.pesan);
        if (resData.error) throw new Error(resData.error.message);

        let teks = resData.choices?.[0]?.message?.content || '{}';
        let batchSoal;
        try {
          // Parse output AI → ambil field "soal"
          const parsed = JSON.parse(teks);
          // Dukung berbagai bentuk: {soal:[...]}, {questions:[...]}, atau langsung array
          batchSoal = parsed.soal || parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);
        } catch(parseErr) {
          // Fallback: coba ekstrak array dari teks mentah
          teks = teks.replace(/```json\n?/gi,'').replace(/```\n?/g,'').trim();
          // Hapus <think>...</think> jika ada
          teks = teks.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          // Fix emoji tanpa tanda kutip: "emoji": 🚀 → "emoji": "🚀"
          teks = teks.replace(/"emoji"\s*:\s*(?!")([^,}\]\n]+)/g, (_, v) => `"emoji": "${v.trim()}"`);
          const arrStart = teks.indexOf('[');
          const arrEnd = teks.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd !== -1) {
            let arrTeks = teks.substring(arrStart, arrEnd + 1);
            // Repair truncated: cari closing brace terakhir
            if (!arrTeks.trimEnd().endsWith(']')) {
              const lastBrace = arrTeks.lastIndexOf('}');
              if (lastBrace !== -1) arrTeks = arrTeks.substring(0, lastBrace + 1) + ']';
            }
            try { batchSoal = JSON.parse(arrTeks); }
            catch(e2) {
              // Hapus objek terakhir yang mungkin terpotong
              const idx = arrTeks.lastIndexOf('},{');
              if (idx !== -1) {
                try { batchSoal = JSON.parse(arrTeks.substring(0, idx + 1) + ']'); }
                catch(e3) { throw new Error('Format JSON dari AI tidak valid, coba generate ulang.'); }
              } else { throw new Error('Format JSON dari AI tidak valid, coba generate ulang.'); }
            }
          } else { throw new Error('Format JSON dari AI tidak valid, coba generate ulang.'); }
        }

        // ✅ Normalisasi & validasi per tipe soal
        batchSoal = batchSoal.map(s => {
          if (!s.pertanyaan || !s.opsi || !Array.isArray(s.opsi)) return null;
          if (s.jenis === 'benar_salah') {
            s.opsi = ['Benar', 'Salah'];
            if (!['Benar','Salah'].includes(s.jawaban)) s.jawaban = 'Benar';
          } else {
            s.jenis = 'pilihan_ganda';
            if (s.opsi.length < 2) return null;
            const cocok = s.opsi.find(o => o.trim().toLowerCase() === s.jawaban?.trim().toLowerCase());
            s.jawaban = cocok ? cocok : s.opsi[0];
          }
          return s;
        }).filter(Boolean);

        // ✅ Deduplikasi
        batchSoal = batchSoal.filter(s => {
          const pBaru = s.pertanyaan.toLowerCase().replace(/\s+/g,' ').trim();
          return !semuaSoal.some(ex => {
            const pLama = ex.pertanyaan.toLowerCase().replace(/\s+/g,' ').trim();
            const wA = new Set(pBaru.split(' '));
            const wB = new Set(pLama.split(' '));
            const irisan = [...wA].filter(w => wB.has(w)).length;
            const gabungan = new Set([...wA, ...wB]).size;
            return irisan / gabungan > 0.65;
          });
        });

        semuaSoal = semuaSoal.concat(batchSoal);
        break; // sukses, keluar dari retry loop
      }

      if (retryCount >= 3) throw new Error('Rate limit Groq terus-menerus, coba lagi nanti');

      // Delay lebih lama antar batch: 3 detik untuk hindari rate limit
      if (b < totalBatch - 1) {
        btn.textContent = `⏳ Jeda sebentar... (${semuaSoal.length}/${jumlah} soal)`;
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    aiSoalUntukKuis = semuaSoal.slice(0, jumlah);

    // Render checklist
    const listEl = document.getElementById('kuis-ai-soal-list');
    const pgCount = aiSoalUntukKuis.filter(s => s.jenis !== 'benar_salah').length;
    const bsCount = aiSoalUntukKuis.filter(s => s.jenis === 'benar_salah').length;
    listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:8px;padding:0 4px">🔵 ${pgCount} Pilihan Ganda · ⭕ ${bsCount} Benar/Salah</div>` +
    aiSoalUntukKuis.map((s, i) => {
      const isBS = s.jenis === 'benar_salah';
      const tipeBadge = isBS
        ? `<span style="background:#E8F5E9;color:#16A34A;font-size:10px;font-weight:800;padding:2px 7px;border-radius:50px">⭕ B/S</span>`
        : `<span style="background:#EEF5FF;color:var(--blue);font-size:10px;font-weight:800;padding:2px 7px;border-radius:50px">🔵 PG</span>`;
      const opsiStr = isBS ? 'Benar / Salah' : s.opsi.map((o,j)=>`${String.fromCharCode(65+j)}. ${o}`).join(' · ');
      return `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;cursor:pointer;border-bottom:1px solid #F0EEFF;transition:background .15s" onmouseover="this.style.background='#F3EEFF'" onmouseout="this.style.background=''">
        <input type="checkbox" class="ai-soal-check" value="${i}" onchange="updateKuisTotalLabel()" checked style="margin-top:3px;width:16px;height:16px;cursor:pointer;accent-color:#7b2ff7">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${tipeBadge}</div>
          <div style="font-weight:700;font-size:13px;line-height:1.5">${s.emoji||'❓'} ${s.pertanyaan}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${opsiStr}</div>
        </div>
      </label>`;
    }).join('');

    document.getElementById('kuis-ai-count-label').textContent = `${aiSoalUntukKuis.length} soal digenerate`;
    document.getElementById('kuis-ai-soal-count').textContent = aiSoalUntukKuis.length;
    document.getElementById('kuis-ai-result').style.display = 'block';
    document.getElementById('kuis-ai-pilih-semua').checked = true;
    updateKuisTotalLabel();
    toast(`✨ ${aiSoalUntukKuis.length} soal berhasil digenerate!`, 'success');
  } catch(e) {
    toast('Gagal generate: ' + e.message, 'error');
    console.error(e);
  }
  btn.disabled = false;
  btn.textContent = '✨ Generate Soal!';
}

function pilihSemuaAI(checked) {
  document.querySelectorAll('.ai-soal-check').forEach(cb => cb.checked = checked);
  const count = checked ? aiSoalUntukKuis.length : 0;
  document.getElementById('kuis-ai-soal-count').textContent = count;
  updateKuisTotalLabel();
}

function updateSoalCount() {
  const count = document.querySelectorAll('.soal-check:checked').length;
  document.getElementById('kuis-soal-count').textContent = count;
  updateKuisTotalLabel();
}

function tambahKuisBaru(tipe) {
  if (!currentKelas) return;
  openBuatKuis(tipe || 'fun');
}

async function openBuatKuis(tipe) {
  if (!currentKelas) return;
  // Reset form
  currentTipeKuis = tipe || 'fun';
  kuisSoalTabAktif = 'bank';
  aiSoalUntukKuis = [];
  switchTipeKuis(currentTipeKuis);
  switchKuisSoalTab('bank');
  document.getElementById('kuis-judul').value = '';
  document.getElementById('kuis-deskripsi').value = '';
  document.getElementById('kuis-deadline').value = '';
  document.getElementById('kuis-durasi').value = '15';
  document.getElementById('kuis-pilih-semua').checked = false;
  document.getElementById('kuis-pakai-submission').checked = false;
  document.getElementById('kuis-submission-detail').style.display = 'none';
  document.getElementById('kuis-submission-tipe').value = '';
  _selectedSubmissionTipe = '';
  document.getElementById('kuis-ai-topik').value = '';
  document.getElementById('kuis-ai-result').style.display = 'none';
  document.getElementById('kuis-total-label').textContent = '';

  // Populate mapel untuk AI
  const mapelList = getMapelList();
  const aiMapelEl = document.getElementById('kuis-ai-mapel');
  if (aiMapelEl) {
    aiMapelEl.innerHTML = mapelList.length
      ? mapelList.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
      : '<option value="Umum">📚 Umum</option>';
    // Set default ke mapel kelas
    if (currentKelas?.mapel) {
      for (let opt of aiMapelEl.options) {
        if (opt.value === currentKelas.mapel) { opt.selected = true; break; }
      }
    }
  }

  // Load soal bank
  openModal('modal-buat-kuis');
  await loadBankSoal();
}

function filterSoalKuis() {
  const mapel = document.getElementById('kuis-soal-mapel-filter').value;
  const kelas = document.getElementById('kuis-soal-kelas-filter').value;
  let filtered = allSoalData;
  if (mapel) filtered = filtered.filter(s => s.mapel === mapel);
  if (kelas) filtered = filtered.filter(s => !s.kelas_id || s.kelas_id === kelas);
  renderSoalChecklistKuis(filtered);
}

async function loadBankSoal() {
  const listEl = document.getElementById('kuis-soal-list');
  listEl.innerHTML = skeletonHtml('list', 4);
  try {
    const data = await api('GET', '/soal');
    allSoalData = data.soal || data.data || [];

    // Populate filter mapel
    const mapels = [...new Set(allSoalData.map(s => s.mapel).filter(Boolean))];
    const filterMapel = document.getElementById('kuis-soal-mapel-filter');
    if (filterMapel) {
      filterMapel.innerHTML = '<option value="">📚 Semua Mapel</option>' +
        mapels.map(m => `<option value="${m}">${m}</option>`).join('');
      if (currentKelas?.mapel && mapels.includes(currentKelas.mapel)) filterMapel.value = currentKelas.mapel;
    }

    // Populate filter kelas dari data guru
    const kelasData = await api('GET', '/kelas');
    const kelasList = kelasData.data || [];
    const filterKelas = document.getElementById('kuis-soal-kelas-filter');
    if (filterKelas) {
      filterKelas.innerHTML = '<option value="">🏫 Semua Kelas</option>' +
        kelasList.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
      // Jangan auto-filter kelas agar semua soal guru tampil
    }

    filterSoalKuis();
  } catch(e) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted)">Gagal memuat soal</div>';
  }
}

function renderSoalChecklistKuis(list) {
  const el = document.getElementById('kuis-soal-list');
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted)">Tidak ada soal untuk filter ini. Buat soal dulu!</div>';
    return;
  }
  el.innerHTML = list.map(s => {
    const jenis = s.jenis === 'pilihan_ganda' ? '🔵 PG' : s.jenis === 'isian' ? '✍️ Essay' : '✅ B/S';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;border-bottom:1px solid #F5F5F5;transition:background 0.15s" onmouseover="this.style.background='#F8F9FA'" onmouseout="this.style.background=''">
      <label style="display:flex;align-items:flex-start;gap:10px;flex:1;cursor:pointer">
        <input type="checkbox" class="soal-check" value="${s.id}" onchange="updateSoalCount()" style="margin-top:3px;width:16px;height:16px;cursor:pointer;accent-color:var(--orange)">
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;line-height:1.5">${s.emoji || '❓'} ${s.pertanyaan}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${jenis} · ${s.mapel || '–'} · ${s.poin || 100} poin</div>
        </div>
      </label>
      <button onclick="hapusSoalBank('${s.id}', this)" title="Hapus soal" style="background:none;border:none;cursor:pointer;font-size:15px;opacity:0.4;padding:2px 4px;transition:opacity 0.2s;flex-shrink:0" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">🗑️</button>
    </div>`;
  }).join('');
  updateSoalCount();
}

async function hapusSoalBank(id, btn) {
  const ok = await confirmDialog({
    icon: '🗑️', title: 'Hapus Soal?',
    body: 'Soal yang sudah dipakai di kuis tidak akan terpengaruh.',
    okLabel: 'Ya, Hapus', cancelLabel: 'Batal', danger: true
  });
  if (!ok) return;
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const data = await api('DELETE', `/soal/${id}`);
    if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
      // Hapus dari data lokal
      allSoalData = allSoalData.filter(s => s.id !== id);
      // Hapus elemen dari DOM
      btn.closest('div[style*="border-bottom"]').remove();
      updateSoalCount();
      toast('Soal berhasil dihapus! 🗑️', 'success');
    } else {
      toast(data.pesan || 'Gagal menghapus soal', 'error');
      btn.disabled = false;
      btn.textContent = '🗑️';
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
    btn.disabled = false;
    btn.textContent = '🗑️';
  }
}

function updateSoalCount() {
  const count = document.querySelectorAll('.soal-check:checked').length;
  document.getElementById('kuis-soal-count').textContent = count;

  // Tampilkan tombol hapus terpilih jika ada yang dicentang
  const btnHapus = document.getElementById('btn-hapus-terpilih');
  if (btnHapus) {
    if (count > 0) {
      btnHapus.style.display = '';
      btnHapus.textContent = '🗑️ Hapus ' + count + ' Soal';
    } else {
      btnHapus.style.display = 'none';
      btnHapus.textContent = '🗑️ Hapus Terpilih';
    }
  }
}

async function hapusSoalTerpilih() {
  const checked = Array.from(document.querySelectorAll('.soal-check:checked'));
  if (checked.length === 0) return;
  const ok = await confirmDialog({
    icon: '🗑️', title: `Hapus ${checked.length} Soal?`,
    body: 'Soal yang sudah dipakai di kuis tidak akan terpengaruh.',
    okLabel: 'Ya, Hapus', cancelLabel: 'Batal', danger: true
  });
  if (!ok) return;

  const ids = checked.map(cb => cb.value);
  let berhasil = 0, gagal = 0;
  const btnHapus = document.getElementById('btn-hapus-terpilih');
  btnHapus.disabled = true;
  btnHapus.textContent = '⏳ Menghapus...';

  for (const id of ids) {
    try {
      const data = await api('DELETE', `/soal/${id}`);
      if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
        allSoalData = allSoalData.filter(s => s.id !== id);
        const cb = document.querySelector('.soal-check[value="' + id + '"]');
        cb?.closest('div[style*="border-bottom"]')?.remove();
        berhasil++;
      } else gagal++;
    } catch(e) { gagal++; }
  }

  btnHapus.disabled = false;
  updateSoalCount();
  const pilihSemua = document.getElementById('kuis-pilih-semua');
  if (pilihSemua) pilihSemua.checked = false;

  if (berhasil > 0) toast('✅ ' + berhasil + ' soal dihapus!' + (gagal > 0 ? ' (' + gagal + ' gagal)' : ''), 'success');
  else toast('Gagal menghapus soal', 'error');
}

function pilihSemuaSoal(checked) {
  document.querySelectorAll('.soal-check').forEach(cb => cb.checked = checked);
  updateSoalCount();
}

async function submitBuatKuis() {
  const judul    = document.getElementById('kuis-judul').value.trim();
  const deskripsi = document.getElementById('kuis-deskripsi').value.trim();
  const deadlineRaw = document.getElementById('kuis-deadline').value;
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
  const durasi   = parseInt(document.getElementById('kuis-durasi').value) || 15;
  const maxAttempt = parseInt(document.getElementById('kuis-max-attempt').value) || 0;

  // Soal dari bank
  const soalBankIds = Array.from(document.querySelectorAll('.soal-check:checked')).map(cb => cb.value);

  // Soal dari AI yang dipilih
  const aiChecked = Array.from(document.querySelectorAll('.ai-soal-check:checked')).map(cb => parseInt(cb.value));
  const soalAITerpilih = aiSoalUntukKuis.filter((_, i) => aiChecked.includes(i));

  const totalSoal = soalBankIds.length + soalAITerpilih.length;

  const pakaiSubmission = document.getElementById('kuis-pakai-submission')?.checked || false;
  const tipeSubmission = pakaiSubmission ? (document.getElementById('kuis-submission-tipe')?.value || '') : null;

  if (!judul) { toast('Judul kuis harus diisi!', 'error'); return; }
  if (currentTipeKuis === 'pr' && !deadline) { toast('Tenggat waktu harus diisi untuk Tugas/PR!', 'error'); return; }
  if (pakaiSubmission && !tipeSubmission) { toast('Pilih tipe submission terlebih dahulu!', 'error'); return; }
  // Soal wajib hanya jika BUKAN tugas submission murni
  if (!pakaiSubmission && totalSoal === 0) { toast('Pilih minimal 1 soal dari bank atau generate dengan AI!', 'error'); return; }

  showLoading(true);
  try {
    const mapel = currentKelas?.mapel || document.getElementById('kuis-ai-mapel')?.value || 'Umum';
    let semuaSoalIds = [...soalBankIds];

    // Jika submission murni, skip proses soal sama sekali
    if (!pakaiSubmission) {
      // Simpan soal AI ke bank soal dulu, lalu ambil ID-nya
      if (soalAITerpilih.length > 0) {
        toast(`💾 Menyimpan ${soalAITerpilih.length} soal AI ke bank soal...`);
        for (const s of soalAITerpilih) {
          try {
            const jenisSoal = s.jenis === 'benar_salah' ? 'benar_salah' : 'pilihan_ganda';
            const opsiSoal = jenisSoal === 'benar_salah' ? ['Benar', 'Salah'] : s.opsi;
            const r = await api('POST', '/soal', {
              pertanyaan: s.pertanyaan,
              emoji: s.emoji || '❓',
              mapel,
              jenis: jenisSoal,
              opsi: JSON.stringify(opsiSoal),
              jawaban: s.jawaban,
              poin: s.poin || 100,
              tingkat: document.getElementById('kuis-ai-tingkat')?.value || 'sedang'
            });
            if (r.success && r.data?.id) semuaSoalIds.push(r.data.id);
          } catch(e) {}
        }
      }

      if (semuaSoalIds.length === 0) {
        toast('Gagal mendapatkan ID soal. Coba lagi!', 'error');
        showLoading(false); return;
      }
    }

    const data = await api('POST', '/quiz', {
      judul,
      deskripsi: deskripsi || null,
      mapel,
      kelas_id: currentKelas?.id,
      durasi,
      tipe: currentTipeKuis,
      deadline: deadline || null,
      status: 'aktif',
      soal_ids: semuaSoalIds.length > 0 ? semuaSoalIds : undefined,
      tipe_submission: tipeSubmission || null,
      max_attempt: maxAttempt
    });

    if (!data.success) { toast(data.pesan || 'Gagal membuat kuis', 'error'); showLoading(false); return; }

    const aiInfo = soalAITerpilih.length > 0 ? ` (${soalBankIds.length} bank + ${soalAITerpilih.length} AI)` : '';
    toast(`🎉 Kuis "${judul}" berhasil dibuat! ${semuaSoalIds.length} soal${aiInfo}`, 'success');
    closeModal('modal-buat-kuis');
    aiSoalUntukKuis = [];
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
    showLoading(false);
    return;
  }
  showLoading(false);

  // Refresh tampilan di try/catch TERPISAH — kuis sudah pasti berhasil dibuat
  // di titik ini, jadi error render di sini tidak boleh menutupi pesan sukses:
  try {
    switchKelasTab('kuis');
    if (currentKelas?.id) await loadKelasKuis(currentKelas.id);
  } catch(e) {
    console.error('[submitBuatKuis] gagal refresh daftar kuis:', e);
  }
}

// ============================================================
//  HAPUS KUIS (GURU)
// ============================================================
async function hapusKuis(id, judul) {
  const ok = await confirmDialog({
    icon: '🗑️', title: 'Hapus Kuis?',
    body: `Kuis <strong>"${judul}"</strong> akan dihapus permanen.`,
    okLabel: 'Ya, Hapus', cancelLabel: 'Batal', danger: true
  });
  if (!ok) return;
  showLoading(true);
  try {
    const data = await api('DELETE', `/quiz/${id}`);
    if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
      toast('Kuis dihapus! 🗑️', 'success');
      loadKelasKuis(currentKelas.id);
    } else {
      toast(data.pesan || 'Gagal menghapus kuis', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

// ============================================================
//  SUBMISSION TUGAS (MURID)
// ============================================================
_subQuizData = null;
_subTipeAktif = '';
_subFileObj = null;
_subPreviewUrl = null;
_isUploadingTugas = false;

async function bukaFormSubmission(quizId) {
  showLoading(true);
  try {
    const [quizRes, cekRes] = await Promise.all([
      api('GET', `/quiz/${quizId}`),
      api('GET', `/quiz/${quizId}/submission/cek`)
    ]);
    if (!quizRes.success) { toast('Gagal memuat tugas', 'error'); showLoading(false); return; }
    const q = quizRes.quiz;

    if (cekRes.sudah) {
      const sub = cekRes.submission;
      toast(`Kamu sudah mengumpulkan tugas ini${sub.nilai != null ? ' — Nilai: ' + sub.nilai + '/100' : ''}`, 'info');
      showLoading(false); return;
    }

    _subQuizData = q;
    _subTipeAktif = '';
    _subFileObj = null;

    document.getElementById('sub-modal-judul').textContent = '📤 ' + q.judul;
    const deskEl = document.getElementById('sub-modal-deskripsi');
    if (q.deskripsi) { deskEl.textContent = q.deskripsi; deskEl.style.display = 'block'; }
    else deskEl.style.display = 'none';

    if (q.deadline) {
      const dl = new Date(q.deadline);
      const diff = dl - new Date();
      const dlEl = document.getElementById('sub-modal-deadline');
      dlEl.innerHTML = diff > 0
        ? `<span style="color:${diff < 86400000 ? 'var(--red)' : 'var(--orange)'}">⏰ Tenggat: ${dl.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} ${dl.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>`
        : `<span style="color:var(--red)">⛔ Tenggat sudah lewat</span>`;
    } else document.getElementById('sub-modal-deadline').innerHTML = '';

    // Reset semua form
    if (_subPreviewUrl) {
      URL.revokeObjectURL(_subPreviewUrl);
      _subPreviewUrl = null;
    }
    ['teks','link','file','gambar'].forEach(t => {
      document.getElementById(`sub-form-${t}`).style.display = 'none';
    });
    document.getElementById('sub-catatan').value = '';
    hapusSubFile('file'); hapusSubFile('gambar');
    if (document.getElementById('sub-konten-teks')) document.getElementById('sub-konten-teks').value = '';
    if (document.getElementById('sub-konten-link')) document.getElementById('sub-konten-link').value = '';

    const tipe = q.tipe_submission;
    const pilihWrap = document.getElementById('sub-pilih-tipe');
    if (tipe === 'semua') {
      pilihWrap.style.display = 'block';
      document.getElementById('sub-tipe-pilihan').innerHTML = [
        { tipe:'file', label:'📄 File / PDF' },
        { tipe:'gambar', label:'🖼️ Foto/Gambar' },
        { tipe:'link', label:'🔗 Link/URL' },
        { tipe:'teks', label:'✏️ Teks/Esai' }
      ].map(o => `<button onclick="pilihTipeSubmission('${o.tipe}')" id="sub-pilih-${o.tipe}" style="padding:10px;border:2px solid #eee;border-radius:10px;background:white;cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;font-size:13px;transition:all 0.2s">${o.label}</button>`).join('');
    } else {
      pilihWrap.style.display = 'none';
      pilihTipeSubmission(tipe);
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
  openModal('modal-submission');
}

function pilihTipeSubmission(tipe) {
  _subTipeAktif = tipe;
  ['file','gambar','link','teks'].forEach(t => {
    document.getElementById(`sub-form-${t}`).style.display = t === tipe ? 'block' : 'none';
    const btn = document.getElementById('sub-pilih-' + t);
    if (btn) { btn.style.border = t === tipe ? '2px solid var(--blue)' : '2px solid #eee'; btn.style.background = t === tipe ? '#EEF5FF' : 'white'; }
  });
}

function previewSubFile(input, tipe) {
  const file = input.files[0];
  if (!file) return;
  _subFileObj = file;
  if (tipe === 'gambar') {
    if (_subPreviewUrl) {
      URL.revokeObjectURL(_subPreviewUrl);
    }
    _subPreviewUrl = URL.createObjectURL(file);
    document.getElementById('sub-preview-gambar-img').src = _subPreviewUrl;
    document.getElementById('sub-preview-gambar').style.display = 'block';
    document.getElementById('sub-dropzone-gambar').style.display = 'none';
  } else {
    document.getElementById('sub-preview-file-nama').textContent = file.name;
    document.getElementById('sub-preview-file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
    document.getElementById('sub-preview-file').style.display = 'flex';
    document.getElementById('sub-dropzone-file').style.display = 'none';
  }
}

function hapusSubFile(tipe) {
  _subFileObj = null;
  if (_subPreviewUrl) {
    URL.revokeObjectURL(_subPreviewUrl);
    _subPreviewUrl = null;
  }
  if (tipe === 'gambar') {
    document.getElementById('sub-preview-gambar').style.display = 'none';
    document.getElementById('sub-dropzone-gambar').style.display = 'block';
    const inp = document.getElementById('sub-input-gambar'); if (inp) inp.value = '';
  } else {
    document.getElementById('sub-preview-file').style.display = 'none';
    document.getElementById('sub-dropzone-file').style.display = 'block';
    const inp = document.getElementById('sub-input-file'); if (inp) inp.value = '';
  }
}

async function submitTugas() {
  if (_isUploadingTugas) return;
  if (!_subQuizData || !_subTipeAktif) { toast('Pilih tipe submission dulu!', 'error'); return; }
  const catatan = document.getElementById('sub-catatan').value.trim();
  const btn = document.getElementById('sub-submit-btn');
  
  _isUploadingTugas = true;
  btn.disabled = true; btn.textContent = '⏳ Mengirim...';
  try {
    let res;
    if (_subTipeAktif === 'teks') {
      const konten = document.getElementById('sub-konten-teks').value.trim();
      if (!konten) { toast('Isi teks tidak boleh kosong!', 'error'); _isUploadingTugas = false; btn.disabled = false; btn.textContent = '📤 Kumpulkan'; return; }
      showLoading(true, 'Mengirim jawaban...');
      res = await api('POST', `/quiz/${_subQuizData.id}/submission`, { tipe: 'teks', konten, catatan });
    } else if (_subTipeAktif === 'link') {
      const konten = document.getElementById('sub-konten-link').value.trim();
      if (!konten || !konten.startsWith('http')) { toast('Masukkan URL yang valid!', 'error'); _isUploadingTugas = false; btn.disabled = false; btn.textContent = '📤 Kumpulkan'; return; }
      showLoading(true, 'Mengirim jawaban...');
      res = await api('POST', `/quiz/${_subQuizData.id}/submission`, { tipe: 'link', konten, catatan });
    } else {
      if (!_subFileObj) { toast('Pilih file terlebih dahulu!', 'error'); _isUploadingTugas = false; btn.disabled = false; btn.textContent = '📤 Kumpulkan'; return; }
      
      showLoading(true, 'Mengompresi & mengirim...');
      
      // Kompres jika tipe gambar
      const uploadFileObj = _subTipeAktif === 'gambar' ? await compressImageIfNeeded(_subFileObj) : _subFileObj;
      
      const fd = new FormData();
      fd.append('file', uploadFileObj);
      fd.append('tipe', _subTipeAktif);
      if (catatan) fd.append('catatan', catatan);
      const uploadToken = localStorage.getItem('kb_token') || '';
      const r = await fetch('/api/quiz/' + _subQuizData.id + '/submission', { method: 'POST', headers: { Authorization: 'Bearer ' + uploadToken }, body: fd });
      res = await r.json();
    }
    if (res.success) {
      toast('✅ Tugas berhasil dikumpulkan!', 'success');
      closeModal('modal-submission');
      if (_subPreviewUrl) {
        URL.revokeObjectURL(_subPreviewUrl);
        _subPreviewUrl = null;
      }
      loadKelasKuis(currentKelas?.id);
    } else {
      toast(res.pesan || 'Gagal mengumpulkan tugas', 'error');
    }
  } catch(e) { 
    toast('Gagal terhubung ke server', 'error'); 
  } finally { 
    showLoading(false);
    btn.disabled = false; btn.textContent = '📤 Kumpulkan'; 
    _isUploadingTugas = false;
  }
}

// ============================================================
//  LIHAT SUBMISSION (GURU)
// ============================================================
async function lihatSubmissionGuru(quizId, judul, kelasId) {
  document.getElementById('sub-lihat-judul').textContent = '📋 ' + judul;
  const listEl = document.getElementById('sub-lihat-list');
  listEl.innerHTML = skeletonHtml('list', 5);
  openModal('modal-lihat-submission');
  try {
    // Ambil submissions & daftar murid di kelas secara paralel
    const [res, kelasRes] = await Promise.all([
      api('GET', `/quiz/${quizId}/submissions`),
      kelasId ? api('GET', `/kelas/${kelasId}`) : Promise.resolve(null)
    ]);

    if (!res.success) { listEl.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Gagal memuat.</div>'; return; }

    const submissions = res.data || [];
    const semuaMurid = kelasRes?.data?.murid || [];
    const sudahIds = new Set(submissions.map(s => s.murid_id || s.murid?.id));
    const belumMurid = semuaMurid.filter(m => !sudahIds.has(m.id));

    const tipeIcon = { file:'📄', gambar:'🖼️', link:'🔗', teks:'✏️' };

    // Ringkasan
    const ringkasan = `<div style="display:flex;gap:10px;margin-bottom:16px">
      <div style="flex:1;background:#F0FFF4;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:var(--green)">${submissions.length}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:700">Sudah Mengumpulkan</div>
      </div>
      <div style="flex:1;background:#FFF5F5;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:var(--red)">${belumMurid.length}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:700">Belum Mengumpulkan</div>
      </div>
    </div>`;

    // Daftar yang sudah
    const sudahHtml = submissions.length === 0
      ? `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">📭 Belum ada murid yang mengumpulkan.</div>`
      : submissions.map(s => `
      <div style="border:2px solid #eee;border-radius:14px;overflow:hidden;margin-bottom:10px">
        <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;background:#F8F9FA">
          <span style="font-size:22px;width:32px;height:32px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#eee">${chatAvatarHtml(s.murid?.avatar || '🦁')}</span>
          <div style="flex:1">
            <div style="font-weight:800;font-size:14px">${s.murid?.nama || 'Murid'}</div>
            <div style="font-size:11px;color:var(--muted)">${tipeIcon[s.tipe]||'📤'} ${s.tipe} · ${new Date(s.submitted_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'})} ${new Date(s.submitted_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          ${s.nilai != null ? `<span style="background:${s.nilai>=80?'var(--green)':s.nilai>=60?'var(--orange)':'var(--red)'};color:white;padding:4px 12px;border-radius:50px;font-weight:800;font-size:13px">${s.nilai}</span>` : '<span style="font-size:11px;color:var(--muted);font-weight:700">Belum dinilai</span>'}
        </div>
        <div style="padding:12px 14px">
          ${s.tipe === 'teks' ? `<div style="font-size:13px;line-height:1.7;color:var(--text);background:#F8F9FA;border-radius:8px;padding:10px;margin-bottom:10px">${(s.konten||'').replace(/\n/g,'<br>')}</div>` : ''}
          ${s.tipe === 'link' ? `<a href="${s.konten}" target="_blank" rel="noopener" style="display:inline-block;margin-bottom:10px;color:var(--blue);font-weight:700;font-size:13px;word-break:break-all">${s.konten}</a>` : ''}
          ${s.tipe === 'file' ? `<a href="${s.file_url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#EEF5FF;color:var(--blue);border-radius:8px;padding:8px 14px;font-weight:800;font-size:13px;text-decoration:none;margin-bottom:10px">📄 ${s.file_nama || 'Unduh File'} <span style="font-size:11px;font-weight:600;opacity:0.7">(${s.file_size ? (s.file_size/1024).toFixed(0)+'KB' : ''})</span></a>` : ''}
          ${s.tipe === 'gambar' ? `<img src="${s.file_url}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid #eee;cursor:pointer;display:block;margin-bottom:10px" onclick="window.open('${s.file_url}','_blank')" title="Klik untuk buka penuh">` : ''}
          ${s.catatan ? `<div style="margin-bottom:8px;font-size:12px;color:var(--muted);font-style:italic;background:#F8F9FA;border-radius:8px;padding:8px 10px">💬 "${s.catatan}"</div>` : ''}
          ${s.feedback ? `<div style="margin-bottom:8px;background:#F0FFF4;border-radius:8px;padding:8px 12px;font-size:12px;color:var(--green);font-weight:700">✅ Feedback: ${s.feedback}</div>` : ''}
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" min="0" max="100" placeholder="Nilai 0-100" id="nilai-${s.id}" value="${s.nilai??''}" style="width:100px;padding:7px 10px;border:2px solid #eee;border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;outline:none">
            <input type="text" placeholder="Tulis feedback..." id="feedback-${s.id}" value="${s.feedback||''}" style="flex:1;padding:7px 10px;border:2px solid #eee;border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;outline:none">
            <button onclick="simpanNilaiSubmission('${quizId}','${s.id}')" style="background:var(--blue);color:white;border:none;padding:7px 14px;border-radius:8px;font-family:Nunito,sans-serif;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap">💾 Simpan</button>
          </div>
        </div>
      </div>`).join('');

    // Daftar yang belum
    const belumHtml = belumMurid.length > 0
      ? `<div style="margin-top:16px">
          <div style="font-weight:800;font-size:13px;color:var(--red);margin-bottom:8px">⏳ Belum Mengumpulkan (${belumMurid.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${belumMurid.map(m => `
              <div style="display:flex;align-items:center;gap:10px;background:#FFF5F5;border-radius:10px;padding:10px 12px">
                <span style="font-size:18px;width:28px;height:28px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#eee">${chatAvatarHtml(m.avatar || '🦁')}</span>
                <span style="font-weight:700;font-size:13px">${m.nama}</span>
                <span style="margin-left:auto;font-size:11px;color:var(--red);font-weight:700">Belum</span>
              </div>`).join('')}
          </div>
        </div>` : '';

    listEl.innerHTML = ringkasan +
      `<div style="font-weight:800;font-size:13px;color:var(--green);margin-bottom:8px">✅ Sudah Mengumpulkan (${submissions.length})</div>` +
      sudahHtml + belumHtml;

  } catch(e) {
    listEl.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Gagal memuat submission.</div>';
  }
}

async function simpanNilaiSubmission(quizId, subId) {
  const nilai = document.getElementById('nilai-' + subId)?.value;
  const feedback = document.getElementById('feedback-' + subId)?.value || '';
  if (nilai === '' || nilai == null) { toast('Isi nilai dulu!', 'error'); return; }
  try {
    const res = await api('PUT', `/quiz/${quizId}/submissions/${subId}/nilai`, { nilai: parseInt(nilai), feedback });
    if (res.success) toast('✅ Nilai disimpan!', 'success');
    else toast(res.pesan || 'Gagal simpan nilai', 'error');
  } catch(e) { toast('Gagal terhubung', 'error'); }
}

// ============================================================
//  KERJAKAN KUIS (MURID)
// ============================================================
kuisKelasData = null;
kuisJawaban = {};
kuisPassed = {};
kuisRagu = {};
kuisCurrentQ = 0;
kuisFunTimer = null;

async function mulaiKuisKelas(quizId) {
  showLoading(true);
  try {
    const data = await api('GET', `/quiz/${quizId}`);
    if (!data.success || !data.quiz) { toast('Kuis tidak ditemukan', 'error'); showLoading(false); return; }

    const kuis = data.quiz;
    if (!kuis.soal || kuis.soal.length === 0) { toast('Kuis belum punya soal', 'error'); showLoading(false); return; }

    // Cek batas percobaan
    const cek = await api('GET', `/quiz/hasil/cek?quiz_id=${quizId}`);
    const maxAtt = cek.max_attempt ?? 0;
    const attempt = cek.attempt || 0;
    if (maxAtt > 0 && attempt >= maxAtt) {
      toast('Batas percobaan sudah habis!', 'error');
      showLoading(false);
      return;
    }

    kuisKelasData = {
      id: quizId,
      info: kuis,
      soal: kuis.soal.map(s => ({
        id: s.id,
        pertanyaan: s.pertanyaan,
        emoji: s.emoji || '❓',
        opsi: Array.isArray(s.opsi) ? s.opsi : JSON.parse(s.opsi || '[]'),
        jawaban: s.jawaban,
        poin: s.poin || 100,
        mapel: s.mapel || ''
      }))
    };
    kuisJawaban = {};
    kuisPassed = {};
    kuisRagu = {};
    kuisCurrentQ = 0;
    kuisStartTime = Date.now();
    clearInterval(kuisFunTimer);

    document.getElementById('kuis-kelas-title').textContent = kuis.judul;
    document.getElementById('kuis-kelas-info').textContent = `${kuisKelasData.soal.length} soal`;

    showPage('page-kuis-kelas');
    renderPrSoal();

    if ((kuis.tipe || 'fun') === 'fun') {
      jalankanFunTimer(kuis.durasi || 15);
    }
  } catch(e) {
    toast('Gagal memuat kuis dari server', 'error');
  }
  showLoading(false);
}

function renderPrSoal() {
  if (!kuisKelasData) return;
  const soal = kuisKelasData.soal;
  const isFun = (kuisKelasData.info?.tipe || 'fun') === 'fun';

  // Render dots
  document.getElementById('pr-q-dots').innerHTML = soal.map((s, i) => {
    const answered = kuisJawaban[i] !== undefined;
    const current = i === kuisCurrentQ;
    const passed = kuisPassed[i] === true;
    const ragu = kuisRagu[i] === true;
    let dotClass = '';
    if (current) dotClass = 'current';
    else if (ragu) dotClass = 'ragu';
    else if (passed) dotClass = 'passed';
    else if (answered) dotClass = 'answered';
    return `<div class="q-dot ${dotClass}" onclick="goToSoal(${i})">${i + 1}</div>`;
  }).join('');

  // Render soal saat ini
  const q = soal[kuisCurrentQ];
  const dipilih = kuisJawaban[kuisCurrentQ];
  document.getElementById('pr-soal-container').innerHTML = `
    <div class="pr-question-card">
      <div class="pr-q-num">${q.mapel ? q.mapel + ' · ' : ''}Soal ${kuisCurrentQ + 1} dari ${soal.length}</div>
      <div class="pr-q-text">${q.emoji} ${q.pertanyaan}</div>
      <div class="pr-options">
        ${q.opsi.map((o, i) => `
          <button class="pr-opt ${dipilih === i ? 'selected' : ''}" onclick="pilihJawaban(${i})" ${isFun && dipilih !== undefined ? 'disabled' : ''}>
            <strong>${String.fromCharCode(65 + i)}.</strong> ${o}
          </button>
        `).join('')}
      </div>
    </div>`;

  // Nav
  const isLast = kuisCurrentQ === soal.length - 1;
  const isPassed = kuisPassed[kuisCurrentQ] === true;
  const isRagu = kuisRagu[kuisCurrentQ] === true;
  const sudahDijawab = Object.keys(kuisJawaban).length;
  document.getElementById('pr-nav-area').innerHTML = `
    <div class="pr-nav" style="display:flex;gap:8px;justify-content:space-between;width:100%;flex-wrap:wrap">
      <button class="pr-nav-btn" style="background:#F5F5F5;color:var(--muted)" onclick="goToSoal(${kuisCurrentQ - 1})" ${kuisCurrentQ === 0 ? 'disabled style="opacity:0.4"' : ''}>← Sebelumnya</button>

      ${!isLast && !isFun ? `
        <button class="pr-nav-btn" style="background:var(--blue);color:white" onclick="goToSoal(${kuisCurrentQ + 1})">Selanjutnya →</button>
      ` : ''}

      ${!isFun ? `
        <button class="pr-nav-btn" style="background:${isPassed ? 'var(--warning)' : '#FEF3C7'};color:${isPassed ? 'white' : '#D97706'};border:1.5px solid #FDE68A" onclick="togglePassSoal()">
          ${isPassed ? '⭐ Batal Pass' : '⚠️ Pass (Lewati)'}
        </button>
      ` : ''}

      <button class="pr-nav-btn" style="background:${isRagu ? 'var(--orange)' : '#FFE4D6'};color:${isRagu ? 'white' : '#D35400'};border:1.5px solid #FFC9A3" onclick="toggleRaguSoal()">
        ${isRagu ? '🤔 Batal Ragu-ragu' : '🤔 Ragu-ragu'}
      </button>

      ${isLast ? `
        <button class="pr-submit-btn" onclick="submitKuisKelas(true)">✅ Kumpulkan (${sudahDijawab}/${soal.length} dijawab)</button>
      ` : ''}
    </div>`;
}

function togglePassSoal() {
  if (kuisPassed[kuisCurrentQ]) {
    kuisPassed[kuisCurrentQ] = false;
  } else {
    kuisPassed[kuisCurrentQ] = true;
    delete kuisJawaban[kuisCurrentQ]; // hapus jawaban jika di-pass
  }
  renderPrSoal();
}

function toggleRaguSoal() {
  if (kuisRagu[kuisCurrentQ]) delete kuisRagu[kuisCurrentQ];
  else kuisRagu[kuisCurrentQ] = true;
  renderPrSoal();
}

function pilihJawaban(idx) {
  const isFun = (kuisKelasData?.info?.tipe || 'fun') === 'fun';
  if (isFun && kuisJawaban[kuisCurrentQ] !== undefined) return; // sudah jawab di fun quiz
  kuisJawaban[kuisCurrentQ] = idx;
  kuisPassed[kuisCurrentQ] = false; // hapus pass jika dijawab
  renderPrSoal();
  if (isFun) {
    // Auto next setelah 1.2 detik — jangan auto-submit di soal terakhir
    clearInterval(kuisFunTimer);
    setTimeout(() => {
      if (kuisCurrentQ < kuisKelasData.soal.length - 1) goToSoal(kuisCurrentQ + 1);
      else {
        // Soal terakhir: lanjutkan timer agar timeout tetap bisa submit, dan tampilkan tombol Kumpulkan
        jalankanFunTimer(kuisKelasData.info?.durasi || 15);
        renderPrSoal();
      }
    }, 1200);
  }
}

function goToSoal(idx) {
  if (idx < 0 || idx >= kuisKelasData.soal.length) return;
  kuisCurrentQ = idx;
  if ((kuisKelasData.info?.tipe || 'fun') === 'fun') {
    clearInterval(kuisFunTimer);
    jalankanFunTimer(kuisKelasData.info?.durasi || 15);
  }
  renderPrSoal();
}

function jalankanFunTimer(durasi) {
  let sisa = durasi;
  document.getElementById('kuis-kelas-info').textContent = `⏱ ${sisa}s · Soal ${kuisCurrentQ + 1}/${kuisKelasData.soal.length}`;
  clearInterval(kuisFunTimer);
  kuisFunTimer = setInterval(() => {
    sisa--;
    document.getElementById('kuis-kelas-info').textContent = `⏱ ${sisa}s · Soal ${kuisCurrentQ + 1}/${kuisKelasData.soal.length}`;
    if (sisa <= 0) {
      clearInterval(kuisFunTimer);
      // Auto lanjut
      if (kuisCurrentQ < kuisKelasData.soal.length - 1) goToSoal(kuisCurrentQ + 1);
      else submitKuisKelas();
    }
  }, 1000);
}

async function submitKuisKelas(isManual = false) {
  const soal = kuisKelasData.soal;

  if (isManual) {
    if (window._isSubmittingKuis) return;
    // 1. Hitung soal yang belum dikerjakan (kalau ada) — tapi tidak memblokir
    const unanswered = [];
    const raguList = [];
    soal.forEach((q, i) => {
      if (kuisRagu[i]) raguList.push(i + 1);
      if (kuisJawaban[i] === undefined && !kuisPassed[i]) unanswered.push(i + 1);
    });

    // 2. Konfirmasi yakin — pakai modal kustom
    window._konfirmasiKuisCallback = () => simpanHasilKuisKelas();
    document.getElementById('konfirmasi-kuis-judul').textContent = 'Kumpulkan Jawaban?';
    let pesanKonfirmasi = '';
    if (unanswered.length > 0) {
      pesanKonfirmasi += `Kamu masih punya ${unanswered.length} soal belum dijawab (nomor ${unanswered.join(', ')}). Soal itu akan dianggap salah. `;
    }
    if (raguList.length > 0) {
      pesanKonfirmasi += `${raguList.length} soal kamu tandai ragu-ragu (nomor ${raguList.join(', ')}). `;
    }
    if (!pesanKonfirmasi) pesanKonfirmasi = 'Kamu yakin sudah selesai mengerjakan semua soal? ';
    pesanKonfirmasi += 'Tetap kumpulkan?';
    document.getElementById('konfirmasi-kuis-pesan').textContent = pesanKonfirmasi;
    document.getElementById('btn-konfirmasi-kuis').textContent = '✅ Ya, Kumpulkan!';
    openModal('modal-konfirmasi-kuis');
    return;
  }

  // Auto-submit (fun quiz timer habis) — langsung simpan tanpa konfirmasi
  await simpanHasilKuisKelas();
}

function konfirmasiKirimKuis() {
  closeModal('modal-konfirmasi-kuis');
  if (typeof window._konfirmasiKuisCallback === 'function') {
    window._konfirmasiKuisCallback();
    window._konfirmasiKuisCallback = null;
  }
}

window._isSubmittingKuis = false;

async function simpanHasilKuisKelas() {
  if (window._isSubmittingKuis) return;
  window._isSubmittingKuis = true;

  closeModal('modal-konfirmasi-kuis');
  showLoading(true, 'Mengirim jawaban...');

  const btnKumpul = document.getElementById('btn-konfirmasi-kuis');
  if (btnKumpul) {
    btnKumpul.disabled = true;
    btnKumpul.textContent = '⏳ Mengirim...';
  }

  clearInterval(kuisFunTimer);
  const durasi_detik = Math.round((Date.now() - (kuisStartTime || Date.now())) / 1000);

  const jawabanKirim = (kuisKelasData.soal || []).map((q, i) => ({
    soal_id: q.id,
    jawaban_user: kuisJawaban[i] !== undefined ? q.opsi[kuisJawaban[i]] : null
  }));

  let skor = 0, benar = 0, totalPoin = 0, total_soal = (kuisKelasData.soal || []).length;
  let attempt = 1, max_attempt = 1;
  let hasilDetail = [];

  try {
    const simpan = await api('POST', '/quiz/hasil', {
      quiz_id: kuisKelasData.id,
      jawaban: jawabanKirim,
      durasi_detik
    });
    if (simpan.success) {
      skor       = simpan.skor       ?? 0;
      benar      = simpan.benar      ?? 0;
      total_soal = simpan.total_soal ?? (kuisKelasData.soal || []).length;
      totalPoin  = simpan.totalPoin  ?? 0;
      attempt    = simpan.attempt    ?? 1;
      max_attempt = simpan.max_attempt ?? 0;
      hasilDetail = simpan.detail || [];
    } else {
      console.warn('Gagal simpan hasil:', simpan.pesan);
    }
  } catch(e) {
    console.warn('Gagal simpan hasil (network):', e);
    window._isSubmittingKuis = false;
    if (btnKumpul) {
      btnKumpul.disabled = false;
      btnKumpul.textContent = '✅ Ya, Kumpulkan!';
    }
    showLoading(false);
    closeModal('modal-konfirmasi-kuis');
    toast('Gagal menyimpan hasil. Coba lagi.', 'error');
    return;
  }

  const emoji = skor >= 80 ? '🎉' : skor >= 60 ? '😊' : skor >= 40 ? '😅' : '💪';
  const judul = skor >= 80 ? 'Luar Biasa!' : skor >= 60 ? 'Bagus!' : skor >= 40 ? 'Terus Semangat!' : 'Jangan Menyerah!';
  const stars = skor >= 80 ? '⭐⭐⭐' : skor >= 60 ? '⭐⭐' : '⭐';

  document.getElementById('hasil-emoji').textContent = emoji;
  document.getElementById('hasil-stars').textContent = stars;
  document.getElementById('hasil-judul').textContent = judul;
  document.getElementById('hasil-skor').textContent = totalPoin;
  document.getElementById('hasil-sub').textContent = `poin · ${benar} dari ${total_soal} benar (${skor}%)`;
  document.getElementById('hasil-stats').innerHTML = `
    <div style="background:#F8F9FA;border-radius:14px;padding:16px;text-align:center"><div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--green)">${benar}</div><div style="font-size:12px;color:var(--muted);font-weight:700">Benar</div></div>
    <div style="background:#F8F9FA;border-radius:14px;padding:16px;text-align:center"><div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--red)">${total_soal - benar}</div><div style="font-size:12px;color:var(--muted);font-weight:700">Salah</div></div>
    <div style="background:#FFEFE8;border-radius:14px;padding:16px;text-align:center"><div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--orange)">${totalPoin}</div><div style="font-size:12px;color:var(--muted);font-weight:700">Poin</div></div>
  `;

  window._kuisHasilDetail = hasilDetail;

  const isUnlimited = max_attempt === 0;
  const sisaAttempt = isUnlimited ? 99 : (max_attempt - attempt);
  const labelCoba = isUnlimited ? '🔄 Coba Lagi' : `🔄 Coba Lagi (${sisaAttempt}x sisa)`;
  let buttonsHtml = `<button onclick="kembaliDariHasil()" style="background:var(--blue);color:white;border:none;padding:14px 32px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:15px;cursor:pointer">🏫 Kembali ke Kelas</button>`;
  if (isUnlimited || sisaAttempt > 0) {
    buttonsHtml += `<button onclick="mulaiKuisKelas('${kuisKelasData.id}')" style="background:var(--orange);color:white;border:none;padding:14px 32px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:15px;cursor:pointer">${labelCoba}</button>`;
  }
  document.getElementById('hasil-nav-btns').innerHTML = buttonsHtml;

  // Tampilkan review otomatis
  if (hasilDetail.length > 0) {
    try { renderHasilReview(); } catch (e) { console.warn('Gagal render review:', e); }
    const reviewEl = document.getElementById('hasil-review');
    if (reviewEl) reviewEl.style.display = 'block';
  }

  window._isSubmittingKuis = false;
  if (btnKumpul) {
    btnKumpul.disabled = false;
    btnKumpul.textContent = '✅ Ya, Kumpulkan!';
  }
  showLoading(false);
  closeModal('modal-konfirmasi-kuis');
  showPage('page-kuis-hasil');
}

kuisStartTime = null;

function batalKuisKelas() {
  clearInterval(kuisFunTimer);
  if (currentKelas) {
    openKelas(currentKelas.id, currentKelas.colorIdx || 0);
  } else {
    loadMuridDashboard();
  }
}

function toggleHasilReview() {
  const el = document.getElementById('hasil-review');
  if (el.style.display === 'none') {
    renderHasilReview();
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function renderHasilReview() {
  const detail = window._kuisHasilDetail || [];
  const list = document.getElementById('hasil-review-list');
  list.innerHTML = detail.map((d, i) => {
    let opsiArr = d.opsi;
    if (typeof opsiArr === 'string') { try { opsiArr = JSON.parse(opsiArr || '[]'); } catch(e) { opsiArr = []; } }
    if (!Array.isArray(opsiArr)) opsiArr = [];
    const opsiHtml = opsiArr.length > 0
      ? opsiArr.map((o, oi) => {
          const letter = String.fromCharCode(65 + oi);
          const isUserAnswer = d.jawaban_user && d.jawaban_user.trim().toLowerCase() === o.trim().toLowerCase();
          const isCorrectAnswer = d.jawaban_benar && d.jawaban_benar.trim().toLowerCase() === o.trim().toLowerCase();
          let bg = 'white', border = '#E8E8E8', text = 'var(--text)', badge = '';
          if (isCorrectAnswer) { bg = '#E8F8EE'; border = '#6BCB77'; text = '#27AE60'; }
          if (isUserAnswer && !d.benar) { bg = '#FFEFE8'; border = '#E74C3C'; text = '#E74C3C'; }
          if (isUserAnswer && d.benar) { badge = ' ✅'; }
          return `<div style="padding:10px 14px;border-radius:12px;border:2px solid ${border};background:${bg};display:flex;align-items:center;gap:10px;margin-top:6px;font-weight:700;font-size:14px;color:${text}">
            <span style="width:28px;height:28px;border-radius:50%;background:#F0F0F0;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:900">${letter}</span>
            <span style="flex:1">${o}</span>
            ${isUserAnswer && d.benar ? '<span style="font-size:16px">✅</span>' : ''}
            ${isUserAnswer && !d.benar ? '<span style="font-size:13px;color:#E74C3C;font-weight:800">Jawabanmu</span>' : ''}
            ${isCorrectAnswer && !isUserAnswer ? '<span style="font-size:13px;color:#27AE60;font-weight:800">✓ Benar</span>' : ''}
          </div>`;
        }).join('')
      : `<div style="padding:10px 14px;border-radius:12px;border:2px solid #E8E8E8;background:white;font-size:14px;color:var(--muted)">Tidak ada opsi</div>`;

    const statusIcon = d.benar ? '✅' : '❌';
    const statusLabel = d.benar ? 'Benar' : 'Salah';

    return `<div style="background:#F8F9FA;border-radius:16px;padding:18px;border:1.5px solid ${d.benar ? '#6BCB77' : '#FFB3B3'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;color:var(--muted);font-weight:700">${d.mapel || ''} · Soal ${i + 1}</div>
        <div style="font-size:13px;font-weight:800;color:${d.benar ? '#27AE60' : '#E74C3C'}">${statusIcon} ${statusLabel}</div>
      </div>
      <div style="font-weight:800;font-size:16px;margin-bottom:10px">${d.emoji || ''} ${d.pertanyaan}</div>
      ${opsiHtml}
    </div>`;
  }).join('');
}

function kembaliDariHasil() {
  if (currentKelas) {
    openKelas(currentKelas.id, currentKelas.colorIdx || 0);
    setTimeout(() => switchKelasTab('kuis'), 500);
  } else {
    loadMuridDashboard();
  }
}

// ============================================================
//  EDIT & DELETE MATERI
// ============================================================
function editMateriBtn(btn) {
  editMateri(btn.dataset.id, btn.dataset.judul, btn.dataset.mapel, btn.dataset.jenis, btn.dataset.status);
}
function deleteMateriBtn(btn) {
  deleteMateri(btn.dataset.id, btn.dataset.judul);
}
editMateriId = null;

function editMateri(id, judul, mapel, jenis, status) {
  editMateriId = id;
  document.getElementById('edit-m-judul').value = judul;
  document.getElementById('edit-m-mapel').value = mapel;
  document.getElementById('edit-m-jenis').value = jenis;
  document.getElementById('edit-m-status').value = status;
  document.getElementById('edit-m-konten').value = '';
  openModal('modal-edit-materi');
}

async function submitEditMateri() {
  const judul = document.getElementById('edit-m-judul').value.trim();
  const mapel = document.getElementById('edit-m-mapel').value;
  const jenis = document.getElementById('edit-m-jenis').value;
  const status = document.getElementById('edit-m-status').value;
  const konten = document.getElementById('edit-m-konten').value.trim();
  if (!judul) { toast('Judul tidak boleh kosong!', 'error'); return; }

  showLoading(true);
  let editBerhasil = false;
  try {
    const body = { judul, mapel, jenis, status };
    if (konten) body.konten = konten;
    const data = await api('PUT', `/materi/${editMateriId}`, body);
    if (data.success) {
      editBerhasil = true;
      toast('Materi berhasil diperbarui! ✅', 'success');
      closeModal('modal-edit-materi');
    } else {
      toast(data.pesan || 'Gagal update materi', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);

  // Refresh tampilan di try/catch TERPISAH — update sudah berhasil, error render
  // di sini tidak boleh menutupi pesan sukses.
  if (editBerhasil) {
    try {
      if (currentKelas) await loadKelasStream(currentKelas.id);
      else loadGuruDashboard();
    } catch(e) { console.error('[submitEditMateri] gagal refresh:', e); }
  }
}

hapusMateriId = null;

function deleteMateri(id, judul) {
  hapusMateriId = id;
  document.getElementById('konfirmasi-pesan').textContent = `Materi "${judul}" akan dihapus permanen.`;
  openModal('modal-konfirmasi');
}

async function konfirmasiHapus() {
  if (!hapusMateriId) return;
  closeModal('modal-konfirmasi');
  showLoading(true);
  try {
    const data = await api('DELETE', `/materi/${hapusMateriId}`);
    hapusMateriId = null;
    if (data.success) {
      toast('Materi berhasil dihapus! 🗑️', 'success');
      if (currentKelas) await loadKelasStream(currentKelas.id);
      else loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal hapus materi', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

pendingKelasAttachment = null;
pendingPrivateAttachment = null;
uploadXhrKelas = null;
uploadXhrPrivate = null;

function showChatFilePreview(targetChat, url, name) {
  const containerId = targetChat === 'kelas' ? 'kelas-chat-file-preview' : 'pc-chat-file-preview';
  const container = document.getElementById(containerId);
  if (!container) return;

  if (targetChat === 'kelas') {
    pendingKelasAttachment = { url, name };
  } else {
    pendingPrivateAttachment = { url, name };
  }

  container.innerHTML = `
    <span style="font-size:18px">📎</span>
    <div style="flex:1;min-width:0;text-align:left;font-size:12px;font-weight:700;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      ${escapeHtml(name)}
    </div>
    <button onclick="clearChatFileAttachment('${targetChat}')" style="background:none;border:none;color:var(--muted);font-weight:800;font-size:14px;cursor:pointer;padding:2px 6px">✕</button>
  `;
  container.style.display = 'flex';
}

function clearChatFileAttachment(targetChat) {
  const containerId = targetChat === 'kelas' ? 'kelas-chat-file-preview' : 'pc-chat-file-preview';
  const container = document.getElementById(containerId);
  if (container) container.style.display = 'none';

  const xhr = targetChat === 'kelas' ? uploadXhrKelas : uploadXhrPrivate;
  if (xhr) { xhr.abort(); }

  if (targetChat === 'kelas') {
    pendingKelasAttachment = null;
    uploadXhrKelas = null;
  } else {
    pendingPrivateAttachment = null;
    uploadXhrPrivate = null;
  }
}

async function prosesUploadFileChat(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = ''; // Reset input
  await uploadAndSendFileChat(file, input.dataset.targetChat);
}

async function handleChatPaste(e, targetChat) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        await uploadAndSendFileChat(file, targetChat);
      }
    }
  }
}

async function uploadAndSendFileChat(file, targetChat) {
  if (file.size > 10 * 1024 * 1024) {
    toast('Berkas terlalu besar. Maksimal 10MB.', 'error');
    return;
  }

  const previewContainerId = targetChat === 'kelas' ? 'kelas-chat-file-preview' : 'pc-chat-file-preview';
  const container = document.getElementById(previewContainerId);
  if (!container) return;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;width:100%">
      <span style="font-size:16px">📤</span>
      <div style="flex:1;font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(file.name)}</div>
      <span id="${targetChat}-upload-pct" style="font-size:11px;font-weight:700;color:var(--blue)">0%</span>
      <button onclick="clearChatFileAttachment('${targetChat}')" style="background:none;border:none;color:var(--muted);font-weight:800;font-size:14px;cursor:pointer;padding:2px 6px">✕</button>
    </div>
    <div style="width:100%;height:4px;background:#E5E7EB;border-radius:4px;overflow:hidden;margin-top:4px">
      <div id="${targetChat}-upload-bar" style="width:0%;height:100%;background:var(--blue);border-radius:4px;transition:width 0.3s ease"></div>
    </div>
  `;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    if (targetChat === 'kelas') { uploadXhrKelas = xhr; } else { uploadXhrPrivate = xhr; }

    xhr.open('POST', API + '/chat/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      const bar = document.getElementById(`${targetChat}-upload-bar`);
      const pctEl = document.getElementById(`${targetChat}-upload-pct`);
      if (bar) bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    };

    xhr.onload = () => {
      const stillMine = targetChat === 'kelas' ? uploadXhrKelas === xhr : uploadXhrPrivate === xhr;
      if (targetChat === 'kelas') uploadXhrKelas = null; else uploadXhrPrivate = null;
      if (!stillMine) { resolve(); return; }

      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          showChatFilePreview(targetChat, data.file_url, data.file_nama);
          toast('Berkas berhasil dilampirkan! 📎', 'success');
        } else {
          clearChatFileAttachment(targetChat);
          toast(data.pesan || 'Gagal mengunggah berkas', 'error');
        }
      } catch (e) {
        clearChatFileAttachment(targetChat);
        toast('Gagal membaca respons server', 'error');
      }
      resolve();
    };

    xhr.onerror = () => {
      const stillMine = targetChat === 'kelas' ? uploadXhrKelas === xhr : uploadXhrPrivate === xhr;
      if (targetChat === 'kelas') uploadXhrKelas = null; else uploadXhrPrivate = null;
      if (!stillMine) { resolve(); return; }
      clearChatFileAttachment(targetChat);
      toast('Gagal mengunggah berkas ke server', 'error');
      resolve();
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}