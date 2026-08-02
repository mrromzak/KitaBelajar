// ============================================================
//  DASHBOARD KEPALA SEKOLAH
// ============================================================

// ============================================================
//  UTILITY: render badge icon (emoji vs PNG)
// ============================================================
function _iconHtml(icon, fallback) {
  if (!icon) icon = fallback || '🏅';
  if (icon.startsWith('/') || icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:')) {
    return `<img src="${icon}" alt="" style="width:auto;height:100%;max-width:100%;object-fit:contain" onerror="this.onerror=null;this.parentElement.textContent='🏅'">`;
  }
  if (/\.(png|jpg|jpeg|webp|svg)$/i.test(icon)) {
    return `<img src="/assets/badge/${encodeURI(icon)}" alt="" style="width:auto;height:100%;max-width:100%;object-fit:contain" onerror="this.onerror=null;this.parentElement.textContent='🏅'">`;
  }
  return icon;
}
function _iconInline(icon) {
  if (!icon) return '🏅';
  if (icon.startsWith('/') || icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:')) {
    return `<img src="${icon}" alt="" style="height:16px;width:16px;vertical-align:middle;display:inline-block" onerror="this.onerror=null;this.outerHTML='🏅'">`;
  }
  if (/\.(png|jpg|jpeg|webp|svg)$/i.test(icon)) {
    return `<img src="/assets/badge/${encodeURI(icon)}" alt="" style="height:16px;width:16px;vertical-align:middle;display:inline-block" onerror="this.onerror=null;this.outerHTML='🏅'">`;
  }
  return icon;
}

// ============================================================
//  DASHBOARD ORANGTUA
// ============================================================
async function loadOrangtuaDashboard() {
  if (!currentUser || currentUser.role !== 'orangtua') return;
  showPage('page-orangtua');
  const navName = document.getElementById('ot-nav-name');
  if (navName) navName.textContent = currentUser.nama;
  const el = document.getElementById('ot-anak-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat data anak...</div>';
  try {
    const data = await api('GET', '/orangtua/anak');
    const anakList = data.data || [];
    if (anakList.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)"><div style="font-size:48px;margin-bottom:12px">👶</div><p>Belum ada data anak yang terhubung.</p></div>';
      return;
    }
    el.innerHTML = `
      <div style="font-weight:800;font-size:16px;margin-bottom:16px">👦👧 Progres Penilaian Anak</div>
      ${anakList.map(anak => `
        <div style="background:white;border-radius:16px;padding:20px;box-shadow:var(--shadow);margin-bottom:12px;display:flex;align-items:center;gap:16px;cursor:pointer"
             onclick="loadAktivitasAnak('${anak.id}','${anak.nama.replace(/'/g,"\\'")}')">
          <div style="font-size:44px;width:56px;height:56px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#F3F4F6">${chatAvatarHtml(anak.avatar || '🦁')}</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:16px">${anak.nama}</div>
            <div style="font-size:13px;color:var(--muted)">${anak.email}</div>
            <div style="display:flex;gap:12px;margin-top:6px">
              <span style="font-size:12px;background:#EEF5FF;color:var(--blue);padding:3px 10px;border-radius:50px;font-weight:700">⭐ ${anak.xp || 0} XP</span>
              <span style="font-size:12px;background:#F0FFF4;color:var(--green);padding:3px 10px;border-radius:50px;font-weight:700">🏅 Level ${anak.level || 1}</span>
            </div>
          </div>
          <div style="color:var(--muted);font-size:20px">→</div>
        </div>`).join('')}`;
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Gagal memuat data.</div>';
  }
}

async function loadAktivitasAnak(muridId, namaMurid) {
  showPage('page-orangtua-detail');
  const el = document.getElementById('ot-detail-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Memuat aktivitas...</div>';
  try {
    const data = await api('GET', `/orangtua/aktivitas/${muridId}`);
    if (!data.success) throw new Error(data.pesan);
    const { murid, kelas, hasil_quiz, tugas_submission, materi_selesai, total_materi_selesai } = data.data;
    const rataQuiz = hasil_quiz.length > 0
      ? Math.round(hasil_quiz.reduce((s, h) => s + (h.skor || 0), 0) / hasil_quiz.length)
      : null;
    const rataTugas = (tugas_submission || []).filter(t => t.nilai != null).length > 0
      ? Math.round((tugas_submission || []).filter(t => t.nilai != null).reduce((s,t) => s + t.nilai, 0) / (tugas_submission || []).filter(t => t.nilai != null).length)
      : null;

    el.innerHTML = `
      <!-- Profil Anak -->
      <div style="background:linear-gradient(135deg,#7C3AED,#A78BFA);border-radius:20px;padding:24px;margin-bottom:20px;color:white;display:flex;align-items:center;gap:20px">
        <div style="font-size:56px;width:72px;height:72px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.2)">${chatAvatarHtml(murid.avatar || '🦁')}</div>
        <div>
          <div style="font-size:22px;font-weight:900">${murid.nama}</div>
          <div style="font-size:13px;opacity:0.8">${murid.email}</div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <span style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700">⭐ ${murid.xp || 0} XP</span>
            <span style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700">🏅 Level ${murid.level || 1}</span>
            <span style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700">🏆 Rank #${murid.rank || '–'}</span>
          </div>
        </div>
      </div>

      <!-- Statistik Ringkas -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:var(--blue)">${kelas.length}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Kelas</div>
        </div>
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:var(--orange)">${hasil_quiz.length}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Quiz</div>
        </div>
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:#7C3AED">${(tugas_submission||[]).length}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Tugas</div>
        </div>
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:var(--green)">${rataQuiz !== null ? rataQuiz : rataTugas !== null ? rataTugas : '–'}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Rata-rata</div>
        </div>
      </div>

      <!-- Kelas -->
      ${kelas.length > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">🏫 Kelas yang Diikuti</div>
          ${kelas.map(k => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
              <span style="font-size:20px">📚</span>
              <div>
                <div style="font-weight:700">${k.nama}</div>
                <div style="font-size:12px;color:var(--muted)">${k.mapel || ''} · ${k.tahun_ajar} · Guru: ${k.guru?.nama || '–'}</div>
              </div>
            </div>`).join('')}
        </div>` : ''}

      <!-- Hasil Quiz Terbaru -->
      ${hasil_quiz.length > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">📝 Quiz Terbaru</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="color:var(--muted);border-bottom:1px solid #eee">
              <th style="text-align:left;padding:8px 0;font-weight:700">Quiz</th>
              <th style="text-align:center;padding:8px 0;font-weight:700">Skor</th>
              <th style="text-align:right;padding:8px 0;font-weight:700">Tanggal</th>
            </tr></thead>
            <tbody>
              ${hasil_quiz.map(h => `
                <tr style="border-bottom:1px solid #f5f5f5">
                  <td style="padding:8px 0">
                    <div style="font-weight:700">${h.quiz?.judul || '–'}</div>
                    <div style="font-size:11px;color:var(--muted)">${h.quiz?.mapel || ''} · ${h.quiz?.tipe === 'pr' ? '📝 PR' : '🎮 Fun'}</div>
                  </td>
                  <td style="text-align:center;padding:8px 0">
                    <span style="background:${h.skor >= 80 ? 'var(--green)' : h.skor >= 60 ? 'var(--yellow)' : 'var(--red)'};color:white;padding:3px 12px;border-radius:50px;font-weight:800">${h.skor}</span>
                  </td>
                  <td style="text-align:right;padding:8px 0;color:var(--muted);font-size:12px">
                    ${h.selesai_at ? new Date(h.selesai_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '–'}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <!-- Tugas Submission -->
      ${(tugas_submission||[]).length > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">📋 Tugas yang Dikumpulkan</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="color:var(--muted);border-bottom:1px solid #eee">
              <th style="text-align:left;padding:8px 0;font-weight:700">Tugas</th>
              <th style="text-align:center;padding:8px 0;font-weight:700">Tipe</th>
              <th style="text-align:center;padding:8px 0;font-weight:700">Nilai</th>
              <th style="text-align:right;padding:8px 0;font-weight:700">Dikumpulkan</th>
            </tr></thead>
            <tbody>
              ${(tugas_submission||[]).map(t => {
                const tipeIcon = {'file':'📄','gambar':'🖼️','link':'🔗','teks':'✏️','semua':'📤'}[t.tipe] || '📤';
                const nilaiColor = t.nilai == null ? 'var(--muted)' : t.nilai >= 80 ? 'var(--green)' : t.nilai >= 60 ? 'var(--yellow)' : 'var(--red)';
                return `<tr style="border-bottom:1px solid #f5f5f5">
                  <td style="padding:8px 0">
                    <div style="font-weight:700">${t.quiz?.judul || '–'}</div>
                    <div style="font-size:11px;color:var(--muted)">${t.quiz?.mapel || ''}</div>
                  </td>
                  <td style="text-align:center;padding:8px 0">${tipeIcon}</td>
                  <td style="text-align:center;padding:8px 0">
                    ${t.nilai != null
                      ? `<span style="background:${nilaiColor};color:white;padding:3px 12px;border-radius:50px;font-weight:800">${t.nilai}</span>`
                      : `<span style="color:var(--muted);font-size:12px;font-weight:700">Belum dinilai</span>`}
                  </td>
                  <td style="text-align:right;padding:8px 0;color:var(--muted);font-size:12px">
                    ${t.submitted_at ? new Date(t.submitted_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '–'}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <!-- Materi Selesai -->
      ${total_materi_selesai > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">✅ Materi Sudah Dipelajari (${total_materi_selesai})</div>
          ${materi_selesai.slice(0,5).map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
              <span style="color:var(--green)">✅</span>
              <div>
                <div style="font-weight:700;font-size:13px">${m.judul || '–'}</div>
                <div style="font-size:11px;color:var(--muted)">${m.mapel || ''}</div>
              </div>
            </div>`).join('')}
          ${total_materi_selesai > 5 ? `<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:8px">+${total_materi_selesai-5} materi lainnya</div>` : ''}
        </div>` : ''}`;
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Gagal memuat data aktivitas.</div>`;
  }
}

// ============================================================
//  DASHBOARD MURID
// ============================================================
async function loadMuridDashboard() {
  showPage('page-murid');
  onGuruPageHidden();
  if (!currentUser) return;
  // Cek apakah ada game online yang belum selesai sebelum refresh
  setTimeout(zepCekReconnect, 500);

  document.getElementById('murid-nav-name').textContent = currentUser.nama;
  document.getElementById('murid-greeting').textContent = `Halo, ${currentUser.nama}! 👋`;
  syncAvatarUI(currentUser.avatar || '🦁', 'murid');

  const xp = currentUser.xp || 0;
  const level = currentUser.level || 1;
  const xpNeeded = level * 1000;
  const xpPct = Math.min(100, (xp / xpNeeded) * 100);

  document.getElementById('murid-xp-label').textContent = `${xp} / ${xpNeeded} XP menuju Level ${level + 1}`;
  document.getElementById('murid-xp-fill').style.width = xpPct + '%';
  document.getElementById('murid-streak').textContent = `Level ${level} · ${xp} XP 🔥`;

  // Kotak nilai rapor — inject di bawah XP bar jika belum ada
  const banner = document.querySelector('.welcome-banner');
  if (banner && !banner.querySelector('.rp-nilai-box')) {
    const nilaiBox = document.createElement('div');
    nilaiBox.className = 'rp-nilai-box';
    nilaiBox.id = 'rp-nilai-box';
    nilaiBox.innerHTML = `
      <div class="rp-nilai-item">
        <span class="rp-nilai-angka" id="rp-xp-angka">${xp}</span>
        <span class="rp-nilai-label">XP</span>
      </div>
      <div class="rp-nilai-item">
        <span class="rp-nilai-angka" id="rp-level-angka">${level}</span>
        <span class="rp-nilai-label">Level</span>
      </div>`;
    const xpWrap = banner.querySelector('.xp-bar-wrap');
    if (xpWrap) xpWrap.insertAdjacentElement('afterend', nilaiBox);
  } else {
    const xpEl = document.getElementById('rp-xp-angka');
    const lvEl = document.getElementById('rp-level-angka');
    if (xpEl) xpEl.textContent = xp;
    if (lvEl) lvEl.textContent = level;
  }

  showLoading(true);
  try {
    // Satu request menggantikan 15+ request sequential sebelumnya
    const init = await api('GET', '/dashboard/murid-init');
    if (init.success) {
      _muridInitCache = init; // simpan cache untuk digunakan fungsi lain
      renderMuridKelas(init.kelas || []);
      tampilDeadlineAlert(init.deadlines || []);
      cekDeadlineReminder(init.deadlines || []);
    }
  } catch(e) {
    // Fallback jika endpoint gagal
    await loadMuridKelas();
    await loadDeadlineAlertDashboard();
  }
  showLoading(false);
}

let _muridInitCache = null;

// Fallback: dipanggil hanya jika endpoint murid-init gagal
async function loadDeadlineAlertDashboard() {
  try {
    const kelasData = await api('GET', '/kelas');
    const kelasList = kelasData.kelas || kelasData.data || [];
    const quizPromises = kelasList.slice(0, 5).map(k =>
      api('GET', `/quiz?kelas_id=${k.id}`)
        .then(d => (d.quiz || d.data || []).map(q => ({ ...q, kelas_id: k.id, kelas_nama: k.nama })))
        .catch(() => [])
    );
    const allQuizArrays = await Promise.all(quizPromises);
    const allQuiz = allQuizArrays.flat();
    const prQuiz = allQuiz.filter(q => q.tipe === 'pr' && q.deadline);
    const cekPromises = prQuiz.map(q => {
      // Submission-type pakai endpoint berbeda
      const url = q.tipe_submission
        ? `/quiz/${q.id}/submission/cek`
        : `/quiz/hasil/cek?quiz_id=${q.id}`;
      return api('GET', url)
        .then(cek => { q.sudah_dikerjakan = cek.sudah || false; })
        .catch(() => { q.sudah_dikerjakan = false; });
    });
    await Promise.all(cekPromises);
    tampilDeadlineAlert(allQuiz);
    cekDeadlineReminder(allQuiz);
  } catch(e) {}
}

// Fallback: dipanggil hanya jika endpoint murid-init gagal
async function loadMuridKelas() {
  const grid = document.getElementById('murid-kelas-grid');
  grid.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat kelas...</div>';
  try {
    const data = await api('GET', '/kelas');
    const list = data.kelas || data.data || data.list || [];
    renderMuridKelas(Array.isArray(list) ? list : []);
  } catch(e) { renderMuridKelas([]); }
}

function renderMuridKelas(list) {
  window._kelasList = list;
  const grid = document.getElementById('murid-kelas-grid');
  if (!grid) return;
  if (list.length > 0) {
    grid.innerHTML = list.map((k, i) => renderKelasCard(k, i, 'murid')).join('');
    // Pulihkan badge unread setelah render ulang
    if (typeof chatUnreadPerKelas !== 'undefined') {
      list.forEach(k => { if (chatUnreadPerKelas[k.id]) updateClassCardChatBadge(k.id); });
    }
  } else {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏫</div>
      <p>Kamu belum bergabung ke kelas manapun.<br>Minta kode ke gurumu dan klik <strong>Gabung Kelas</strong>!</p>
    </div>`;
  }
}

function tampilDeadlineAlert(kuisList) {
  const alertBox = document.getElementById('deadline-alert');
  const alertList = document.getElementById('deadline-alert-list');
  if (!alertBox || !alertList) return;

  const now = new Date();
  const urgent = kuisList.filter(q => {
    if (!q.deadline || q.tipe === 'fun' || q.sudah_dikerjakan) return false;
    const diff = new Date(q.deadline) - now;
    return diff > 0 && diff < 86400000 * 2; // 2 hari ke depan
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  if (urgent.length === 0) { alertBox.style.display = 'none'; return; }

  alertBox.style.display = 'block';
  alertList.innerHTML = urgent.map(q => {
    const diff = new Date(q.deadline) - now;
    const isUrgent = diff < 3600000 * 6; // kurang dari 6 jam
    const label = diff < 3600000
      ? `⏰ ${Math.floor(diff/60000)} menit lagi!`
      : diff < 86400000
      ? `⚠️ ${Math.floor(diff/3600000)} jam lagi`
      : `📅 ${Math.floor(diff/86400000)} hari lagi`;

    // Cari kelas_id untuk navigasi
    const kelasId = q.kelas_id || '';
    return `<div class="deadline-item" onclick="bukaKelasUntukKuis('${kelasId}','${q.id}')">
      <div class="deadline-item-icon" style="background:${isUrgent ? '#FFEFE8' : '#FFEFE8'}">📝</div>
      <div class="deadline-item-info">
        <h4>${escapeHtml(q.judul)}</h4>
        <p>${escapeHtml(q.mapel || 'Tugas')} · ${q.total_soal || '?'} soal</p>
      </div>
      <div class="deadline-badge ${isUrgent ? 'urgent' : 'soon'}">${label}</div>
    </div>`;
  }).join('');
}

async function bukaKelasUntukKuis(kelasId, quizId) {
  if (!kelasId) { mulaiKuisKelas(quizId); return; }
  await openKelas(kelasId, 0);
  setTimeout(() => {
    switchKelasTab('kuis');
    setTimeout(() => mulaiKuisKelas(quizId), 300);
  }, 600);
}

// ═══════════════════════════════════════════════════
//  LEADERBOARD + MISI + BADGES
// ═══════════════════════════════════════════════════
let _lbMode    = 'kelas';   // 'kelas' | 'global'
let _lbPeriode = 'all';     // 'all'   | 'minggu'
let _lbTab     = 'lb';      // 'lb'    | 'misi' | 'badges'

function loadLeaderboardPage() {
  showPage('page-leaderboard');
  switchLbTab('lb');
  loadLeaderboard();
}

function switchLbTab(tab) {
  _lbTab = tab;
  ['lb','misi','badges'].forEach(t => {
    document.getElementById(`lb-tab-${t}`)?.classList.toggle('active', t === tab);
    const panel = document.getElementById(`lb-panel-${t}`);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'misi')   { loadDailyReward(); loadMisi(); }
  if (tab === 'badges') loadBadges();
}

function setLbMode(mode) {
  _lbMode = mode;
  document.getElementById('lb-mode-kelas')?.classList.toggle('active', mode === 'kelas');
  document.getElementById('lb-mode-global')?.classList.toggle('active', mode === 'global');
  loadLeaderboard();
}

function setLbPeriode(periode) {
  _lbPeriode = periode;
  document.getElementById('lb-periode-all')?.classList.toggle('active', periode === 'all');
  document.getElementById('lb-periode-minggu')?.classList.toggle('active', periode === 'minggu');
  loadLeaderboard();
}

async function loadLeaderboard() {
  const token = localStorage.getItem('kb_token') || '';
  const params = new URLSearchParams({ mode: _lbMode });
  if (_lbPeriode === 'minggu') params.set('periode', 'minggu');

  document.getElementById('lb-podium').innerHTML = `<div style="width:100%;padding:20px 0">${skeletonHtml('list', 3)}</div>`;
  document.getElementById('lb-list').innerHTML   = '';

  try {
    const res  = await fetch(`/api/dashboard/leaderboard?${params}`, { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) { toast('Gagal memuat leaderboard.'); return; }

    renderPodiumLb(json.data.slice(0, 3));
    // Top-3 sudah tampil di podium — list mulai dari peringkat #4 agar tidak dobel
    renderListLb(json.data.slice(3));

    const posSaya = json.posisi_saya;
    const elPos   = document.getElementById('lb-posisi-saya');
    if (posSaya && elPos) {
      elPos.style.display = '';
      document.getElementById('lb-posisi-angka').textContent = `#${posSaya} dari ${json.data.length} murid`;
    } else if (elPos) {
      elPos.style.display = 'none';
    }
  } catch(e) {
    toast('Gagal memuat leaderboard.');
  }
}

// Avatar bisa berupa URL atau emoji — render sesuai jenisnya
function renderAvatar(avatar, size = 48, extraStyle = '') {
  const isUrl = avatar && (avatar.startsWith('http') || avatar.startsWith('/') || avatar.startsWith('data:'));
  if (isUrl) {
    return `<img src="${avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;${extraStyle}">`;
  }
  const isi = avatar || '👤';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8E0FF;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.45)}px;flex-shrink:0;${extraStyle}">${isi}</div>`;
}

function renderPodiumLb(top3) {
  const el = document.getElementById('lb-podium');
  if (!top3 || top3.length === 0) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;width:100%">Belum ada data</div>'; return; }

  const medals  = ['🥇','🥈','🥉'];
  const heights = ['90px','70px','60px'];
  const order   = [1, 0, 2]; // tampil: #2, #1, #3

  const cols = order.map(i => {
    const u = top3[i];
    if (!u) return '';
    const av = renderAvatar(u.avatar, 48, 'border:3px solid #fff;');
    return `
      <div class="lb-podium-col" style="flex:1">
        <div style="text-align:center;margin-bottom:6px">
          ${av}
          <div style="font-size:20px;margin-top:2px">${medals[i]}</div>
          <div style="font-size:12px;font-weight:800;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 auto">${u.nama}</div>
          <div style="font-size:11px;color:#7b2ff7;font-weight:700">${u.xp} XP</div>
        </div>
        <div style="width:100%;height:${heights[i]};background:${i===0?'linear-gradient(180deg,#FFD700,#FFA500)':i===1?'linear-gradient(180deg,#C0C0C0,#A0A0A0)':'linear-gradient(180deg,#CD7F32,#A0522D)'};border-radius:8px 8px 0 0"></div>
      </div>`;
  });

  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;width:100%;padding:0 8px">${cols.join('')}</div>`;
}

function renderListLb(data) {
  const el = document.getElementById('lb-list');
  // Kosong = semua peserta sudah tampil di podium (≤3 orang). Cukup kosongkan list.
  if (!data || data.length === 0) { el.innerHTML = ''; return; }

  const myId   = currentUser?.id || '';
  const topMap = { 1: 'top1', 2: 'top2', 3: 'top3' };

  el.innerHTML = data.map(u => {
    const cls    = u.id === myId ? 'saya' : (topMap[u.peringkat] || '');
    const av     = renderAvatar(u.avatar, 40, 'flex-shrink:0;');
    const streak = u.streak > 0 ? `🔥${u.streak} ` : '';
    const avg    = u.avg_skor > 0 ? `avg ${parseFloat(u.avg_skor).toFixed(0)}%` : '';
    return `
      <div class="lb-item ${cls}">
        <div class="lb-rank">${u.peringkat <= 3 ? ['🥇','🥈','🥉'][u.peringkat-1] : u.peringkat}</div>
        ${av}
        <div class="lb-info">
          <div class="lb-nama">${u.nama}${u.id === myId ? ' <span style="color:#7b2ff7;font-size:11px">(Kamu)</span>' : ''}</div>
          <div class="lb-meta">${streak}${avg} · Lv.${u.level || 1}</div>
        </div>
        <div class="lb-xp">${u.xp} XP</div>
      </div>`;
  }).join('');
}

// ── DAILY REWARD ────────────────────────────────────
async function loadDailyReward() {
  const token = localStorage.getItem('kb_token') || '';
  try {
    const res  = await fetch('/api/misi/daily-reward', { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) return;

    const { sudah_klaim, hari_ke, xp_reward, ada_badge, rewards } = json.data;
    const card = document.getElementById('daily-reward-card');

    const daysHtml = rewards.map((r, i) => {
      const dayNum = i + 1;
      const isDone = dayNum < hari_ke || (dayNum === hari_ke && sudah_klaim);
      const isNow  = dayNum === hari_ke && !sudah_klaim;

      let circleStyle, circleLabel;
      if (isDone) {
        circleStyle = 'background:rgba(255,255,255,0.25);opacity:0.55';
        circleLabel = '✓';
      } else if (isNow) {
        circleStyle = 'background:#fff;color:#7b2ff7;box-shadow:0 0 0 3px rgba(255,255,255,0.5)';
        circleLabel = `+${r.xp}`;
      } else {
        circleStyle = 'background:rgba(255,255,255,0.15)';
        circleLabel = `+${r.xp}`;
      }

      return `
        <div style="text-align:center;flex:1;min-width:0">
          <div style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;margin:0 auto 4px;${circleStyle}">${circleLabel}</div>
          <div style="font-size:9px;opacity:0.8;white-space:nowrap">H${dayNum}${r.badge_id ? '🌟' : ''}</div>
        </div>`;
    }).join('');

    const btnHtml = sudah_klaim
      ? `<div style="text-align:center;margin-top:14px;padding:11px;background:rgba(255,255,255,0.18);border-radius:12px;font-weight:800;font-size:13px">✅ Sudah Diklaim Hari Ini</div>`
      : `<button onclick="klaimDailyReward(this)" style="width:100%;margin-top:14px;padding:12px;background:#fff;color:#7b2ff7;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;transition:opacity .15s">🎁 Klaim Hadiah Harian! (+${xp_reward} XP${ada_badge ? ' + 🌟' : ''})</button>`;

    card.innerHTML = `
      <div style="font-size:11px;font-weight:800;opacity:0.75;letter-spacing:.5px;margin-bottom:10px">HARI KE-${hari_ke} DARI 7</div>
      <div style="display:flex;gap:4px;justify-content:space-between;align-items:flex-start">${daysHtml}</div>
      ${btnHtml}`;
  } catch(e) { console.error('loadDailyReward', e); }
}

async function klaimDailyReward(btn) {
  const token = localStorage.getItem('kb_token') || '';
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.textContent = 'Memproses...';
  try {
    const res  = await fetch('/api/misi/daily-reward/klaim', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (json.success) {
      toast(`🎁 +${json.xp_dapat} XP! Hadiah hari ke-${json.hari_ke} diklaim!`);
      if (json.badge) showBadgeCelebration([json.badge]);
      loadDailyReward();
    } else {
      toast(json.pesan || 'Gagal klaim.');
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = '🎁 Klaim Hadiah Harian!';
    }
  } catch(e) {
    toast('Gagal klaim hadiah harian.');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '🎁 Klaim Hadiah Harian!';
  }
}

// ── MISI ───────────────────────────────────────────
async function loadMisi() {
  const token = localStorage.getItem('kb_token') || '';
  ['harian','mingguan','achievement'].forEach(t =>
    document.getElementById(`misi-${t}-list`).innerHTML = skeletonHtml('list', 2)
  );

  try {
    const res  = await fetch('/api/misi', { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) return;

    renderMisiGroup('harian',      json.data.harian);
    renderMisiGroup('mingguan',    json.data.mingguan);
    renderMisiGroup('achievement', json.data.achievement);

    // Tampilkan notif jika ada XP dari auto-claim
    if (json.auto_xp && json.auto_xp > 0) {
      toast(`⚡ +${json.auto_xp} XP dari misi yang selesai!`);
    }

    // Tampilkan perayaan badge baru
    if (json.badge_baru && json.badge_baru.length > 0) {
      showBadgeCelebration(json.badge_baru);
    }
  } catch(e) { toast('Gagal memuat misi.'); }
}

// Filter kategori misi: 'semua' | 'harian' | 'mingguan' | 'achievement'.
// User memilih ingin menampilkan kategori apa; sisanya disembunyikan.
function setMisiFilter(cat) {
  document.querySelectorAll('.misi-filter').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.misi-sec').forEach(sec => {
    sec.style.display = (cat === 'semua' || sec.dataset.cat === cat) ? '' : 'none';
  });
}

// ── Tampilkan modal perayaan badge baru ──────────────────
function showBadgeCelebration(badges) {
  if (!badges || badges.length === 0) return;

  let idx = 0;

  function showNext() {
    const b = badges[idx];
    if (!b) return;

    // Hapus overlay lama jika ada
    const existing = document.getElementById('badge-celebration-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'badge-modal-overlay';
    overlay.id = 'badge-celebration-overlay';

    const isLast = idx === badges.length - 1;
    const btnLabel = isLast ? 'Sip, Terima Kasih! 🎉' : `Selanjutnya (${idx+1}/${badges.length})`;

    overlay.innerHTML = `
      <div class="badge-modal-box">
        <div style="font-size:13px;font-weight:800;color:#aaa;letter-spacing:1px;margin-bottom:8px">BADGE BARU DIRAIH!</div>
        <div class="badge-modal-icon">${_iconHtml(b.icon, '🏅')}</div>
        <div class="badge-modal-title">${b.nama}</div>
        <div class="badge-modal-desc">${b.deskripsi || ''}</div>
        <button class="badge-modal-btn" onclick="badgeCelebrationNext()">
          ${btnLabel}
        </button>
      </div>`;

    document.body.appendChild(overlay);

    // Tap anywhere on overlay background to close
    overlay.addEventListener('click', e => {
      if (e.target === overlay) badgeCelebrationNext();
    });
  }

  window._badgeCelebQueue  = badges;
  window._badgeCelebIdx    = 0;

  window.badgeCelebrationNext = function() {
    window._badgeCelebIdx++;
    if (window._badgeCelebIdx < window._badgeCelebQueue.length) {
      const overlay = document.getElementById('badge-celebration-overlay');
      if (overlay) overlay.remove();
      // Show next after short delay
      setTimeout(() => {
        const b    = window._badgeCelebQueue[window._badgeCelebIdx];
        const isLast = window._badgeCelebIdx === window._badgeCelebQueue.length - 1;
        const btnLabel = isLast ? 'Sip, Terima Kasih! 🎉' : `Selanjutnya (${window._badgeCelebIdx+1}/${window._badgeCelebQueue.length})`;
        const newOverlay = document.createElement('div');
        newOverlay.className = 'badge-modal-overlay';
        newOverlay.id = 'badge-celebration-overlay';
        newOverlay.innerHTML = `
          <div class="badge-modal-box">
            <div style="font-size:13px;font-weight:800;color:#aaa;letter-spacing:1px;margin-bottom:8px">BADGE BARU DIRAIH!</div>
            <div class="badge-modal-icon">${_iconHtml(b.icon, '🏅')}</div>
            <div class="badge-modal-title">${b.nama}</div>
            <div class="badge-modal-desc">${b.deskripsi || ''}</div>
            <button class="badge-modal-btn" onclick="badgeCelebrationNext()">${btnLabel}</button>
          </div>`;
        newOverlay.addEventListener('click', e => { if (e.target === newOverlay) badgeCelebrationNext(); });
        document.body.appendChild(newOverlay);
      }, 150);
    } else {
      const overlay = document.getElementById('badge-celebration-overlay');
      if (overlay) overlay.remove();
      // Refresh badges tab if visible
      loadBadges();
    }
  };

  showNext();
}

// Mapping kondisi_tipe → fungsi navigasi
const MISI_AKSI = {
  quiz_count:    { label: 'Mulai Quiz ⚡',      fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  akurasi:       { label: 'Mulai Quiz 🎯',      fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  xp_gained:     { label: 'Mulai Quiz ⭐',      fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  materi_count:  { label: 'Buka Materi 📖',     fn: () => bukaKelasUntukMateri() },
  streak:        { label: 'Tetap Aktif 🔥',     fn: () => toast('Login setiap hari untuk menjaga streak kamu! 🔥') },
  level:         { label: 'Naikkan Level 📈',   fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  latihan_count: { label: 'Buka Kita Latihan 🚀', fn: () => { window.location.href = 'kita-latihan.html'; } },
  belajar_count: { label: 'Buka AyoBelajar 📚',   fn: () => { window.location.href = 'kita-materi.html'; } },
};

function renderMisiGroup(tipe, list) {
  const el = document.getElementById(`misi-${tipe}-list`);
  if (!list || list.length === 0) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:10px">Tidak ada misi.</div>'; return; }

  el.innerHTML = list.map((m, idx) => {
    const pct    = Math.min(100, Math.round((m.progres / m.target) * 100));
    const cls    = m.reward_claimed ? 'claimed' : m.selesai ? 'selesai' : '';
    const badge  = m.reward_badge ? ` + badge ${_iconInline(m.reward_badge.icon)}` : '';
    const reward = m.reward_xp > 0 ? `+${m.reward_xp} XP${badge}` : badge.trim() || '';

    // Tombol kanan: claimed / klaim / mulai
    let rightEl = '';
    if (m.reward_claimed) {
      rightEl = `<span style="font-size:11px;font-weight:800;color:#aaa;flex-shrink:0">✓ Diklaim</span>`;
    } else if (m.selesai && m.id) {
      rightEl = `<button class="btn-klaim" onclick="klaimMisi('${m.id}', this)">Klaim! 🎁</button>`;
    } else if (!m.selesai) {
      const aksi = MISI_AKSI[m.kondisi_tipe];
      if (aksi) rightEl = `<button class="btn-mulai-misi" onclick="jalankanMisiAksi('${m.kondisi_tipe}')">${aksi.label}</button>`;
    }

    const progresText = tipe === 'achievement' && m.selesai
      ? `<span style="color:#00C851;font-size:11px;font-weight:800">✅ Selesai</span>`
      : `<span style="color:var(--muted);font-size:11px;font-weight:700">${m.progres}/${m.target}</span>`;

    return `
      <div class="misi-card ${cls}" id="misi-card-${m.id || m.misi_id}">
        <div class="misi-icon">${m.icon}</div>
        <div class="misi-info">
          <div class="misi-judul">${m.judul}</div>
          <div class="misi-progres-bar">
            <div class="misi-progres-fill" style="width:${pct}%"></div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            ${progresText}
            ${reward ? `<div class="misi-reward">${reward}</div>` : ''}
          </div>
        </div>
        <div style="flex-shrink:0;margin-left:8px">${rightEl}</div>
      </div>`;
  }).join('');
}

function jalankanMisiAksi(kondisiTipe) {
  const aksi = MISI_AKSI[kondisiTipe];
  if (aksi) aksi.fn();
}

// Buka kelas pertama yang diikuti murid, langsung ke tab Materi
async function bukaKelasUntukMateri() {
  try {
    const token = localStorage.getItem('kb_token') || '';
    const res   = await fetch('/api/kelas', { headers: { Authorization: 'Bearer ' + token } });
    const json  = await res.json();
    const list  = json.data || json.kelas || [];
    if (list.length === 0) {
      toast('Kamu belum bergabung di kelas manapun. Join kelas dulu!');
      showPage('page-murid');
      return;
    }
    // Buka kelas pertama langsung ke tab Materi
    const k = list[0];
    await openKelas(k.id, 0);
    switchKelasTab('materi');
  } catch(e) {
    // Fallback: buka halaman kelas biasa
    showPage('page-murid');
    toast('Buka halaman kelas dan pilih tab Materi.');
  }
}

async function klaimMisi(misiMuridId, btn) {
  const token = localStorage.getItem('kb_token') || '';
  btn.disabled   = true;
  btn.textContent = '...';
  try {
    const res  = await fetch(`/api/misi/${misiMuridId}/klaim`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (json.success) {
      if (json.xp_dapat > 0) toast(`🎉 +${json.xp_dapat} XP! "${json.misi_judul}" selesai!`);
      else toast(`🎉 "${json.misi_judul}" selesai!`);
      loadMisi(); // refresh — badge_baru will be shown via loadMisi response
    } else {
      toast(json.pesan || 'Gagal klaim.');
      btn.disabled = false;
      btn.textContent = 'Klaim!';
    }
  } catch(e) {
    toast('Gagal klaim reward.');
    btn.disabled = false;
    btn.textContent = 'Klaim!';
  }
}

// ── BADGES ─────────────────────────────────────────
async function loadBadges() {
  const token = localStorage.getItem('kb_token') || '';
  try {
    const res  = await fetch('/api/misi/badges/semua', { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) return;

    const dimiliki = json.data.filter(b => b.dimiliki);
    const semua    = json.data;

    const elDimiliki = document.getElementById('badges-dimiliki-list');
    const elSemua    = document.getElementById('badges-semua-list');

    if (dimiliki.length === 0) {
      elDimiliki.innerHTML = '<div style="color:var(--muted);font-size:13px">Belum punya badge. Selesaikan misi untuk dapat badge!</div>';
    } else {
      elDimiliki.innerHTML = dimiliki.map(b => `
        <div class="badge-card dimiliki" title="${b.deskripsi}">
          <div class="badge-icon">${_iconHtml(b.icon)}</div>
          <div class="badge-nama">${b.nama}</div>
        </div>`).join('');
    }

    elSemua.innerHTML = semua.map(b => `
      <div class="badge-card ${b.dimiliki ? 'dimiliki' : 'locked'}" title="${b.deskripsi}">
        <div class="badge-icon">${_iconHtml(b.icon)}</div>
        <div class="badge-nama">${b.nama}</div>
      </div>`).join('');
  } catch(e) { toast('Gagal memuat badge.'); }
}