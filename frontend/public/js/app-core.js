// ============================================================
//  CONFIG
// ============================================================
const API = window.location.origin + '/api';
let token = localStorage.getItem('kb_token') || null;
const socket = io(window.location.origin, {
  auth: { token }
});
function refreshSocketConnection() {
  if (socket) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
}
let currentUser = JSON.parse(localStorage.getItem('kb_user') || 'null');
let currentRole = 'murid'; // for login page
let currentRegRole = 'murid';

// ── DARK MODE FUNCTIONS ──────────────────────────────────────
function toggleGlobalDarkMode() {
  const mode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('kb_dark_mode', mode);
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
    btn.textContent = mode ? '☀️' : '🌙';
  });
}

function initGlobalDarkMode() {
  const isDarkMode = localStorage.getItem('kb_dark_mode') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
    btn.textContent = isDarkMode ? '☀️' : '🌙';
  });
}

function kembaliKeDashboardUtama() {
  if (currentUser) {
    if (currentUser.role === 'guru') showPage('page-guru');
    else if (currentUser.role === 'orangtua') showPage('page-orangtua');
    else if (currentUser.role === 'kepala_sekolah') window.location.href = '/portal-kepala.html';
    else showPage('page-murid');
  } else {
    showPage('page-landing');
  }
}

// ============================================================
//  MATA PELAJARAN MANAGEMENT
// ============================================================
// Mapel per akun guru — disimpan dengan key unik per user ID
function getMapelStorageKey() {
  const userId = currentUser?.id || 'guest';
  return 'kb_mapel_' + userId;
}

const MAPEL_ACCENT_COLORS = ['#FF6B35','#4A6FA5','#529B76','#8B6F97','#FF8C5A','#678CBF','#70B793','#A98CB5','#FFB97A','#7CA3D4','#7FC49E','#BCA1C8'];
const QUICK_EMOJIS = ['\uD83C\uDFC3','\uD83C\uDFB5','\uD83D\uDDA5\uFE0F','\uD83E\uDDEA','\uD83C\uDF0D','\uD83C\uDFAD','\uD83D\uDCD0','\uD83D\uDD2C','\uD83D\uDD2D','\uD83C\uDFDB\uFE0F','\uD83E\uDDEE','\uD83C\uDFAF','\u26BD','\uD83C\uDFBB','\u271D\uFE0F','\u262A\uFE0F','\uD83C\uDF3A','\uD83C\uDFCB\uFE0F','\uD83D\uDCBB','\uD83E\uDDE0','\uD83D\uDCF8','\uD83D\uDDFF'];

function getMapelList() {
  const key = getMapelStorageKey();
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  return [];
}

function saveMapelList(list) {
  const key = getMapelStorageKey();
  localStorage.removeItem('kb_mapel_list'); // hapus key lama yang shared
  localStorage.setItem(key, JSON.stringify(list));
}

function getMapelOptions() {
  const list = getMapelList();
  if (list.length) return list;
  const kelas = window._kelasList || [];
  const seen = new Map();
  kelas.forEach(k => {
    const nama = (k && k.mapel ? String(k.mapel).trim() : '');
    if (nama && !seen.has(nama.toLowerCase())) {
      seen.set(nama.toLowerCase(), { nama, emoji: '\uD83D\uDCDA' });
    }
  });
  return [...seen.values()];
}

function populateMapelSelects() {
  const list = getMapelOptions();
  const opts = list.length
    ? list.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
    : '<option value="">-- Belum ada mapel, tambah dulu di panel Mata Pelajaran --</option>';
  ['m-mapel', 'edit-m-mapel', 's-mapel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

function renderMuridMapelGrid() {
  const grid = document.getElementById('murid-mapel-grid');
  if (!grid) return;
  const list = getMapelList();
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><p>Guru belum menambahkan mata pelajaran</p></div>';
    return;
  }
  const progressColors = MAPEL_ACCENT_COLORS;
  grid.innerHTML = list.map((m, i) => {
    const color = progressColors[i % progressColors.length];
    return `<div class="mapel-card" onclick="loadMateri('${m.nama.replace(/'/g,"\\'")}',this)">
      <div class="mapel-icon">${m.emoji}</div>
      <h4>${m.nama}</h4>
      <div class="progress-mini"><div class="progress-fill" style="width:0%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

function renderGuruMapelPanel() {
  const el = document.getElementById('guru-mapel-list');
  if (!el) return;
  const list = getMapelList();
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada mata pelajaran. Tambahkan yang pertama!</p></div>';
    return;
  }
  el.innerHTML = list.map((m, i) => {
    const color = MAPEL_ACCENT_COLORS[i % MAPEL_ACCENT_COLORS.length];
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F5F5F5">
      <div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:${color}22;flex-shrink:0">${m.emoji}</div>
      <div style="flex:1;font-weight:700;font-size:14px">${m.nama}</div>
      <button class="btn-icon btn-delete" onclick="hapusMapel('${m.nama.replace(/'/g,"\\'")}','${m.emoji}')" title="Hapus">🗑️</button>
    </div>`;
  }).join('');
}

function openTambahMapel() {
  document.getElementById('mapel-nama').value = '';
  document.getElementById('mapel-emoji').value = '📌';
  document.getElementById('emoji-preview').textContent = '📌';
  document.getElementById('emoji-quick').innerHTML = QUICK_EMOJIS.map(e =>
    `<span onclick="pickMapelEmoji('${e}')" title="${e}" style="font-size:26px;cursor:pointer;padding:5px;border-radius:8px;border:2px solid transparent;transition:all 0.15s;display:inline-flex;align-items:center;justify-content:center" onmouseover="this.style.background='#F5F5F5';this.style.borderColor='#ddd'" onmouseout="this.style.background='';this.style.borderColor='transparent'">${e}</span>`
  ).join('');
  openModal('modal-tambah-mapel');
}

function pickMapelEmoji(e) {
  document.getElementById('mapel-emoji').value = e;
  document.getElementById('emoji-preview').textContent = e;
}

function submitTambahMapel() {
  const nama  = document.getElementById('mapel-nama').value.trim();
  const emoji = document.getElementById('mapel-emoji').value.trim() || '📌';
  if (!nama) { toast('Nama mata pelajaran harus diisi! 😊', 'error'); return; }
  if (nama.length > 40) { toast('Nama terlalu panjang! Maksimal 40 karakter.', 'error'); return; }

  let list = getMapelList();
  if (list.find(m => m.nama.toLowerCase() === nama.toLowerCase())) {
    toast('Mata pelajaran itu sudah ada! 🤔', 'error'); return;
  }

  list.push({ nama, emoji });
  saveMapelList(list);
  renderGuruMapelPanel();
  populateMapelSelects();
  closeModal('modal-tambah-mapel');
  toast(`"${nama}" berhasil ditambahkan! 🎉`, 'success');
}

function hapusMapel(nama, emoji) {
  confirmDialog({
    icon: '🗑️',
    title: 'Hapus Mata Pelajaran?',
    body: `Hapus <strong>${emoji} ${nama}</strong>?<br><br>Materi dan soal yang sudah dibuat dengan mapel ini tidak akan terhapus.`,
    okLabel: 'Ya, Hapus',
    cancelLabel: 'Batal',
    danger: true
  }).then(ok => {
    if (!ok) return;
    let list = getMapelList().filter(m => m.nama !== nama);
    saveMapelList(list);
    renderGuruMapelPanel();
    populateMapelSelects();
    toast(`"${nama}" dihapus dari daftar mapel.`, 'success');
  });
}

// ============================================================
//  UTILS
// ============================================================
// ============================================================
//  MARKDOWN RENDERER
// ============================================================
function renderMarkdown(text) {
  if (!text) return '';
  // Escape HTML dulu agar tag mentah dari input (mis. <script>, <img onerror>)
  // menjadi teks inert. Tag markdown di bawah ditambahkan SETELAH escape,
  // jadi tetap berfungsi. Link hanya cocok https?:// (tak bisa javascript:).
  return escapeHtml(text)
    // Headings
    .replace(/^### (.+)$/gm, '<h4 style="font-weight:800;font-size:15px;margin:14px 0 6px;color:var(--text)">$1</h4>')
    .replace(/^## (.+)$/gm,  '<h3 style="font-weight:800;font-size:17px;margin:16px 0 8px;color:var(--text)">$1</h3>')
    .replace(/^# (.+)$/gm,   '<h2 style="font-weight:900;font-size:20px;margin:18px 0 10px;color:var(--text)">$1</h2>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Markdown links [teks](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:700;text-decoration:underline">$1</a>')
    // Plain URLs (http/https) not already inside an href
    .replace(/(?<!href=["'])(?<![">])(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:700;text-decoration:underline">$1</a>')
    // Bullet list
    .replace(/^\* (.+)$/gm,   '<li style="margin-left:18px;margin-bottom:4px">$1</li>')
    .replace(/^- (.+)$/gm,    '<li style="margin-left:18px;margin-bottom:4px">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, match => `<ul style="margin:8px 0;padding-left:4px">${match}</ul>`)
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p style="margin:8px 0;font-size:14px;line-height:1.8">')
    // Single newline
    .replace(/\n/g, '<br>')
    // Wrap in paragraph
    .replace(/^/, '<p style="margin:0;font-size:14px;line-height:1.8">')
    .replace(/$/, '</p>');
}

function toggleMateri(postId, btn) {
  const el = document.getElementById(postId + '-content');
  const isCollapsed = el.style.maxHeight === '160px';
  if (isCollapsed) {
    el.style.maxHeight = '';
    el.style.overflow = '';
    el.style.position = '';
    el.querySelector('div[style*="linear-gradient"]')?.remove();
    btn.textContent = '🔼 Sembunyikan';
  } else {
    el.style.maxHeight = '160px';
    el.style.overflow = 'hidden';
    el.style.position = 'relative';
    const fade = document.createElement('div');
    fade.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent,white)';
    el.appendChild(fade);
    btn.textContent = '📖 Baca Selengkapnya';
  }
}

function showPage(id, _skipHistoryPush) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (!_skipHistoryPush) history.pushState({ kbPage: id }, '', location.pathname);
}

// Klik logo di navbar -> kembali ke "beranda" yang sesuai peran user.
// Belum login -> landing. Sudah login -> dashboard sesuai role.
function goHome() {
  if (currentUser && currentUser.role === 'guru') return showPage('page-guru');
  if (currentUser && currentUser.role === 'murid') return showPage('page-murid');
  if (currentUser && currentUser.role === 'orangtua') return showPage('page-orangtua');
  if (currentUser && currentUser.role === 'kepala_sekolah') {
    window.location.href = '/portal-kepala.html';
    return;
  }
  showPage('page-landing');
}

// Validasi format email dasar (dipakai di login & register).
// Menolak input seperti "fno@nog" (tanpa domain TLD).
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function showLoading(v, msg) {
  document.getElementById('loading').classList.toggle('show', v);
  const txtEl = document.getElementById('loading-text');
  if (txtEl) txtEl.textContent = v && msg ? msg : 'Memuat...';
}

// Hapus error state inline saat user mulai mengetik
function clearFieldError(input) {
  if (!input) return;
  input.style.borderColor = '';
  const errId = input.id + '-error';
  const errEl = document.getElementById(errId);
  if (errEl) errEl.style.display = 'none';
}

/**
 * skeletonHtml — buat HTML skeleton placeholder.
 * @param {'list'|'card'|'text'} tipe
 * @param {number} count — jumlah item (untuk list)
 */
function skeletonHtml(tipe = 'list', count = 3) {
  if (tipe === 'card') {
    return Array.from({ length: count }, () =>
      `<div class="skeleton-card" style="height:120px;margin-bottom:12px"></div>`
    ).join('');
  }
  if (tipe === 'text') {
    return `<div class="skeleton-line" style="height:14px;width:80%;margin-bottom:8px"></div>
            <div class="skeleton-line" style="height:14px;width:60%;margin-bottom:8px"></div>
            <div class="skeleton-line" style="height:14px;width:70%"></div>`;
  }
  // default: list
  return Array.from({ length: count }, (_, i) =>
    `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.06)">
       <div class="skeleton-line" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;margin:0"></div>
       <div style="flex:1">
         <div class="skeleton-line" style="height:13px;width:${60 + (i % 3) * 10}%;margin-bottom:6px"></div>
         <div class="skeleton-line" style="height:11px;width:${40 + (i % 2) * 15}%"></div>
       </div>
     </div>`
  ).join('');
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type ? `show ${type}` : 'show';
  setTimeout(() => el.className = '', 2800);
}

/**
 * confirmDialog — pengganti native confirm() yang blocking.
 * @param {object} opts
 *   icon      — emoji besar (default '⚠️')
 *   title     — judul dialog
 *   body      — pesan utama
 *   okLabel   — label tombol OK (default 'Ya')
 *   cancelLabel — label batal (default 'Batal')
 *   danger    — bool, tombol ok jadi merah
 * @returns {Promise<boolean>}
 */
function confirmDialog({ icon = '⚠️', title = 'Konfirmasi', body = '', okLabel = 'Ya', cancelLabel = 'Batal', danger = false } = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById('kb-confirm-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'kb-confirm-modal';
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal-box">
        <div class="confirm-modal-icon">${icon}</div>
        <div class="confirm-modal-title">${title}</div>
        ${body ? `<div class="confirm-modal-body">${body}</div>` : ''}
        <div class="confirm-modal-btns">
          ${cancelLabel ? `<button class="confirm-modal-cancel" id="kb-confirm-cancel">${cancelLabel}</button>` : ''}
          <button class="confirm-modal-ok${danger ? ' danger' : ''}" id="kb-confirm-ok">${okLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    document.getElementById('kb-confirm-ok').addEventListener('click', () => cleanup(true));
    const cancelBtn = document.getElementById('kb-confirm-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401 || res.status === 403) {
    // Coba parse dulu — 403 bisa juga dari role restriction, bukan hanya token expired
    let body = {};
    try { body = await res.clone().json(); } catch(e) {}
    const pesanBawah = (body.pesan || '').toLowerCase();
    const isTokenError = pesanBawah.includes('token') || pesanBawah.includes('kadaluarsa') || pesanBawah.includes('login') || res.status === 401;
    if (isTokenError) {
      localStorage.removeItem('kb_token');
      token = null;
      if (socket) socket.disconnect();
      toast('Sesi habis. Silakan login ulang.', 'error');
      setTimeout(() => showPage('page-login'), 1500);
      return { success: false, _authExpired: true };
    }
  }
  return res.json();
}

function openModal(id) {
  if (id === 'modal-buat-kelas') {
    const mapelList = getMapelList();
    if (!mapelList || mapelList.length === 0) {
      confirmDialog({
        icon: '📖',
        title: 'Belum Ada Mata Pelajaran',
        body: 'Untuk membuat kelas, kamu perlu menambahkan mata pelajaran terlebih dahulu.',
        okLabel: 'Tambah Sekarang',
        cancelLabel: 'Nanti'
      }).then(ok => {
        if (ok) openTambahMapel();
      });
      return;
    }
  }
  document.getElementById(id).classList.add('open');
  if (id === 'modal-ai-materi') populateAIMapel();
  if (id === 'modal-buat-kelas') populateBuatKelasMapel();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Feature card modal data
const featureData = {
  materi: {
    icon: '📚',
    title: 'Materi Lengkap',
    content: `
      <p>KitaBelajar menyediakan <strong>materi lengkap</strong> untuk semua jenjang pendidikan:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>SD (Kelas 1-6)</strong> — Matematika, IPA, Bahasa Indonesia, IPS, Bahasa Inggris</li>
        <li><strong>SMP (Kelas 7-9)</strong> — Matematika, IPA, Bahasa Indonesia, Sejarah, Geografi, Ekonomi</li>
        <li><strong>SMA (Kelas 10-12)</strong> — Matematika Lanjutan, Fisika, Kimia, Biologi, Sosiologi, Ekonomi</li>
      </ul>
      <p>Setiap materi dilengkapi dengan:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li>📝 Penjelasan lengkap dengan bahasa yang mudah dipahami</li>
        <li>🎯 Ringkasan poin penting di setiap bab</li>
        <li>🔗 Link ke latihan soal dan video pendukung</li>
        <li>🤖 Fitur AI untuk tanya-jawab materi secara interaktif</li>
      </ul>
    `
  },
  latihan: {
    icon: '✏️',
    title: 'Latihan Soal',
    content: `
      <p>Ribuan soal latihan siap membantu kamu menguasai setiap mata pelajaran:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>Bank Soal Lengkap</strong> — Ribuan soal dari berbagai jenjang dan mata pelajaran</li>
        <li><strong>Level Kesulitan</strong> — Mudah, Sedang, Sulit — sesuaikan dengan kemampuanmu</li>
        <li><strong>Soal Acak</strong> — Urutan soal diacak setiap sesi agar tidak bosan</li>
        <li><strong>Pembahasan</strong> — Setiap soal dilengkapi pembahasan lengkap</li>
        <li><strong>Progress Tracking</strong> — Pantau perkembangan belajarmu</li>
      </ul>
      <p>Soal-soal ini dirancang oleh guru-guru berpengalaman dan disesuaikan dengan kurikulum terbaru.</p>
    `
  },
  games: {
    icon: '🎮',
    title: 'Games Edukatif',
    content: `
      <p>Belajar jadi lebih seru dengan berbagai permainan edukatif:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>Quiz Interaktif</strong> — Uji pengetahuanmu dengan quiz yang menyenangkan</li>
        <li><strong>Puzzle Matematika</strong> — Latih logika dengan puzzle yang menantang</li>
        <li><strong>Flashcard</strong> — Hafal konsep penting dengan kartu flash yang efektif</li>
        <li><strong>Word Scramble</strong> — Susun kata untuk mengingat istilah penting</li>
        <li><strong>Memory Game</strong> — Latih daya ingat dengan permainan memori</li>
        <li><strong>Math Race</strong> — Balapan hitung cepat untuk melatih kecepatan berpikir</li>
      </ul>
      <p>Setiap permainan memberikan XP dan badge sebagai reward atas pencapaianmu! 🏆</p>
    `
  },
  poin: {
    icon: '🏆',
    title: 'Sistem Poin & Gamifikasi',
    content: `
      <p>Sistem gamifikasi membuat belajarmu semakin seru dan memotivasi:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>XP (Experience Points)</strong> — Dapatkan XP dari setiap aktivitas belajar</li>
        <li><strong>Level Up</strong> — Naik level seiring bertambahnya XP</li>
        <li><strong>Leaderboard</strong> — Bersaing dengan teman sekelas untuk peringkat tertinggi</li>
        <li><strong>Badge & Achievement</strong> — Kumpulkan badge untuk pencapaian tertentu</li>
        <li><strong>Daily Streak</strong> — Login setiap hari untuk menjaga streak dan bonus XP</li>
        <li><strong>Referral Bonus</strong> — Ajak teman dan dapatkan bonus XP</li>
      </ul>
      <p>Setiap poin yang kamu kumpulkan menunjukkan progress belajarmu. Semakin tinggi levelmu, semakin banyak tantangan yang terbuka! 🚀</p>
    `
  }
};

function openFeatureModal(key) {
  const data = featureData[key];
  if (!data) return;
  document.getElementById('feature-modal-icon').textContent = data.icon;
  document.getElementById('feature-modal-title').textContent = data.title;
  document.getElementById('feature-modal-content').innerHTML = data.content;
  const overlay = document.getElementById('modal-feature-detail');
  const slide = document.getElementById('modal-feature-slide');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    slide.classList.add('open');
  });
}

function closeFeatureModal() {
  const overlay = document.getElementById('modal-feature-detail');
  const slide = document.getElementById('modal-feature-slide');
  slide.classList.remove('open');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 400);
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ── BACK BUTTON (History API) ─────────────────────────────────
let _popStateHandling = false;

window.addEventListener('popstate', e => {
  if (_popStateHandling) return;
  _popStateHandling = true;

  const anyModalOpen = document.querySelector('.modal.open');
  if (anyModalOpen) {
    anyModalOpen.classList.remove('open');
    const activePage = document.querySelector('.page.active');
    if (activePage) history.pushState({ kbPage: activePage.id }, '', location.pathname);
    _popStateHandling = false;
    return;
  }

  if (e.state && e.state.kbPage) {
    showPage(e.state.kbPage, true);
  } else {
    goHome();
  }
  _popStateHandling = false;
});

// ── INITIAL HISTORY STATE ─────────────────────────────────────
// Script loaded at bottom of <body>, DOM sudah siap
if (document.readyState !== 'loading') {
  const activePage = document.querySelector('.page.active');
  history.replaceState(
    { kbPage: activePage ? activePage.id : 'page-landing' },
    '', location.pathname
  );
}

// ── FEATURE CARD CLICK (delegated) ────────────────────────────
document.addEventListener('click', e => {
  const card = e.target.closest('[data-feature]');
  if (!card) return;
  const key = card.dataset.feature;
  if (!featureData[key]) return;
  openFeatureModal(key);
});

