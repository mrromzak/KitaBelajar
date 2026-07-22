// ============================================================
//  prototype/kode-guru/public/app.js
//  UI Script — Portal Kepala Sekolah KitaBelajar
//  Redesigned: Nunito font, purple/orange branding
// ============================================================

const BASE = '';
let TOKEN = null, USER = null, loginRole = 'kepala';
let GOOGLE_CLIENT_ID = null;

function $(id) { return document.getElementById(id); }

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
}

function alert_(elId, msg, type = 'error') {
  const el = $(elId);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
}
function clearAlert(elId) {
  const el = $(elId);
  if (!el) return;
  el.className = 'alert';
  el.textContent = '';
}

function setLoading(btn, on) {
  if (!btn) return;
  if (on) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Memproses…';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.orig || btn.innerHTML;
    btn.disabled = false;
  }
}

async function api(method, path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res  = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Auth state ───────────────────────────────────────────────
function setLoggedIn(token, user) {
  TOKEN = token;
  USER  = user;
  const badge = $('badge-role');
  if (badge) {
    badge.textContent = user.role === 'kepala_sekolah' ? '👑 Kepala Sekolah' : '👩‍🏫 Guru';
    badge.style.display = 'inline-block';
  }
  const logoutBtn = $('btn-logout');
  if (logoutBtn) logoutBtn.style.display = 'inline-block';
}

function logout() {
  TOKEN = null;
  USER  = null;
  const badge = $('badge-role');
  if (badge) badge.style.display = 'none';
  const logoutBtn = $('btn-logout');
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (window.google && window.google.accounts) {
    try { window.google.accounts.id.disableAutoSelect(); } catch (_) {}
  }
  showSection('section-login');
  clearAlert('login-alert');
  setLoginRole('kepala');
}

// ── Login role toggle ────────────────────────────────────────
function setLoginRole(role) {
  loginRole = role;
  clearAlert('login-alert');
  const kepalaForm = $('login-kepala-form');
  const guruForm   = $('login-guru-form');
  const kepalaBtn  = $('role-kepala-btn');
  const guruBtn    = $('role-guru-btn');

  if (role === 'kepala') {
    if (kepalaForm) kepalaForm.style.display = 'block';
    if (guruForm)   guruForm.style.display   = 'none';
    if (kepalaBtn)  kepalaBtn.className = 'role-tab active';
    if (guruBtn)    guruBtn.className   = 'role-tab';
  } else {
    if (kepalaForm) kepalaForm.style.display = 'none';
    if (guruForm)   guruForm.style.display   = 'block';
    if (kepalaBtn)  kepalaBtn.className = 'role-tab';
    if (guruBtn)    guruBtn.className   = 'role-tab active';
    if (GOOGLE_CLIENT_ID) initGoogleGSI();
  }
}

// ── Login Kepala ─────────────────────────────────────────────
function initLoginKepala() {
  const btn = $('btn-login');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    clearAlert('login-alert');
    const email    = ($('login-email')?.value || '').trim();
    const password = $('login-password')?.value || '';
    if (!email || !password) {
      alert_('login-alert', 'Email dan password wajib diisi.');
      return;
    }
    setLoading(btn, true);
    try {
      const { ok, data } = await api('POST', '/api/auth/login', { email, password });
      if (!ok) { alert_('login-alert', data.pesan || 'Login gagal.'); return; }
      setLoggedIn(data.token, data.user);
      const greet = $('dash-greeting');
      if (greet) greet.textContent = `Selamat Datang, ${data.user.nama}! 🏫`;
      showSection('section-dashboard');
      loadKodeList();
      loadGuruList();
    } catch (e) {
      alert_('login-alert', 'Koneksi gagal: ' + e.message);
    } finally {
      setLoading(btn, false);
    }
  });

  // Enter key on password
  const pwEl = $('login-password');
  if (pwEl) pwEl.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}

// ── Google GSI ───────────────────────────────────────────────
function initGoogleGSI() {
  if (!GOOGLE_CLIENT_ID || !window.google) return;
  window.google.accounts.id.initialize({
    client_id:            GOOGLE_CLIENT_ID,
    callback:             handleGoogleCredential,
    auto_select:          false,
    cancel_on_tap_outside: true
  });
  const container = $('google-btn-container');
  if (container) {
    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
      type:  'standard',
      theme: 'outline',
      size:  'large',
      text:  'continue_with',
      shape: 'pill',
      width: 320
    });
  }
}

async function handleGoogleCredential(response) {
  clearAlert('login-alert');
  const credential = response.credential;
  try {
    const { ok, data } = await api('POST', '/api/auth/login-google-guru', { credential });
    if (!ok) {
      alert_('login-alert', data.pesan || 'Login gagal. Email belum terdaftar di sistem.');
      return;
    }
    setLoggedIn(data.token, data.user);

    const welcomeEl = $('guru-welcome');
    if (welcomeEl) welcomeEl.textContent = `Selamat Datang, ${data.user.nama}! 🎉`;

    const kodeInfoEl = $('guru-kode-info');
    if (kodeInfoEl) {
      kodeInfoEl.innerHTML = `
        <strong>✅ Akses Terverifikasi</strong><br>
        Email: <strong>${data.user.email}</strong><br>
        Kode akses Anda: <code style="font-family:monospace;font-size:1.1rem;font-weight:900;letter-spacing:3px">${data.kode_info?.kode || '—'}</code>
        <span style="font-size:.75rem;opacity:.8;margin-left:6px">(untuk referensi)</span><br>
        Total login: <strong>${data.kode_info?.loginCount || 1}x</strong>
      `;
    }

    const profilEl = $('guru-profil');
    if (profilEl && (data.user.no_telepon || data.user.alamat)) {
      profilEl.innerHTML = `
        <div class="card-title">📋 Profil Anda</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">No. Telepon</div>
            <div style="font-weight:700">${data.user.no_telepon || '—'}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Alamat</div>
            <div style="font-weight:700">${data.user.alamat || '—'}</div>
          </div>
        </div>
      `;
      profilEl.style.display = 'block';
    } else if (profilEl) {
      profilEl.style.display = 'none';
    }

    showSection('section-guru');
  } catch (e) {
    alert_('login-alert', 'Koneksi gagal: ' + e.message);
  }
}

// ── Tabs ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active-panel'));
      btn.classList.add('active');
      const panel = $(btn.dataset.tab);
      if (panel) panel.classList.add('active-panel');
      if (btn.dataset.tab === 'tab-list') loadKodeList();
      if (btn.dataset.tab === 'tab-guru') loadGuruList();
    });
  });
}

// ── Generate kode ────────────────────────────────────────────
function initGenerateKode() {
  const btn = $('btn-generate');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    clearAlert('gen-alert');
    const resultEl = $('gen-result');
    if (resultEl) resultEl.style.display = 'none';

    const nama    = ($('gen-nama')?.value    || '').trim();
    const email   = ($('gen-email')?.value   || '').trim();
    const label   = ($('gen-label')?.value   || '').trim() || null;
    const telepon = ($('gen-telepon')?.value || '').trim() || null;
    const alamat  = ($('gen-alamat')?.value  || '').trim() || null;

    if (!nama || !email) {
      alert_('gen-alert', 'Nama dan email guru wajib diisi.');
      return;
    }

    setLoading(btn, true);
    try {
      const { ok, data } = await api('POST', '/api/kode-guru', {
        nama_guru:  nama,
        email_guru: email,
        label,
        no_telepon: telepon,
        alamat
      }, true);

      if (!ok) { alert_('gen-alert', data.pesan || 'Gagal generate kode.'); return; }

      const e = data.data;
      const displayEl = $('gen-kode-display');
      const metaEl    = $('gen-kode-meta');
      if (displayEl) displayEl.textContent = e.kode;
      if (metaEl)    metaEl.textContent    = `Untuk: ${e.namaGuru} (${e.emailGuru}) · Permanen · Login: 0x`;
      if (resultEl)  resultEl.style.display = 'block';

      // Reset form
      ['gen-nama','gen-email','gen-label','gen-telepon','gen-alamat'].forEach(id => {
        const el = $(id);
        if (el) el.value = '';
      });

      loadKodeList();
    } catch (e) {
      alert_('gen-alert', 'Koneksi gagal: ' + e.message);
    } finally {
      setLoading(btn, false);
    }
  });
}

// Copy kode
function initCopyKode() {
  const displayEl = $('gen-kode-display');
  const copyBtn   = $('btn-copy');

  if (displayEl) {
    displayEl.addEventListener('click', () => {
      const kode = displayEl.textContent;
      if (!kode) return;
      navigator.clipboard.writeText(kode).then(() => {
        displayEl.style.background = 'rgba(16,185,129,.15)';
        setTimeout(() => displayEl.style.background = '', 800);
      });
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const kode = ($('gen-kode-display')?.textContent || '').trim();
      if (!kode) return;
      navigator.clipboard.writeText(kode).then(() => {
        copyBtn.textContent = '✅ Tersalin!';
        setTimeout(() => copyBtn.textContent = '📋 Salin Kode', 2000);
      });
    });
  }
}

// ── Load daftar kode ─────────────────────────────────────────
async function loadKodeList() {
  const tbody = $('tbl-kode-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="empty"><span class="spinner spinner-dark"></span> Memuat...</td></tr>';
  try {
    const { ok, data } = await api('GET', '/api/kode-guru', null, true);
    if (!ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">Gagal: ${data.pesan}</td></tr>`;
      return;
    }
    const list = data.data || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Belum ada kode. Generate kode untuk guru pertama!</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(e => {
      const statusBadge = e.status === 'active'
        ? '<span class="badge-active">✅ Aktif</span>'
        : '<span class="badge-revoked">🚫 Dicabut</span>';
      const revokeBtn = e.status === 'active'
        ? `<button class="btn btn-danger btn-sm" data-id="${e.id}">Cabut</button>`
        : '<span style="color:var(--muted);font-size:.78rem">—</span>';
      return `<tr>
        <td><code style="font-family:monospace;font-size:.95rem;font-weight:900;letter-spacing:2px;color:var(--primary)">${e.kode}</code></td>
        <td><strong>${e.namaGuru || '—'}</strong></td>
        <td style="font-size:.82rem">${e.emailGuru || '—'}</td>
        <td style="font-size:.82rem">${e.noTelepon || '—'}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;font-size:.82rem">${e.loginCount ?? 0}x</td>
        <td style="font-size:.82rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.label || ''}">${e.label || '—'}</td>
        <td>${revokeBtn}</td>
      </tr>`;
    }).join('');

    // Event delegation — no inline onclick (CSP safe)
    tbody.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => revokeKode(btn.dataset.id));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Error: ${e.message}</td></tr>`;
  }
}

async function revokeKode(id) {
  if (!confirm('Yakin ingin mencabut akses guru ini? Guru tidak bisa login lagi sampai kode baru dibuat.')) return;
  try {
    const { ok, data } = await api('PATCH', `/api/kode-guru/${id}/revoke`, {}, true);
    if (!ok) { alert(data.pesan || 'Gagal mencabut.'); return; }
    loadKodeList();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ── Load daftar guru ─────────────────────────────────────────
async function loadGuruList() {
  const tbody = $('tbl-guru-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="empty"><span class="spinner spinner-dark"></span> Memuat...</td></tr>';
  try {
    const { ok, data } = await api('GET', '/api/kepala/guru', null, true);
    if (!ok) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty">Gagal memuat.</td></tr>`;
      return;
    }
    const list = data.data || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada guru yang login.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((g, i) => `
      <tr>
        <td style="color:var(--muted);font-size:.82rem">${i + 1}</td>
        <td><strong>${g.nama}</strong></td>
        <td style="font-size:.85rem">${g.email}</td>
        <td style="font-size:.82rem;color:var(--muted)">${fmtDate(g.createdAt || g.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Error: ${e.message}</td></tr>`;
  }
}

// ── Init: ambil Google Client ID dari server ─────────────────
async function init() {
  // Dark mode init
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  const toggleBtn = $('dark-mode-toggle');
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    if (toggleBtn) toggleBtn.textContent = '🌙';
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const mode = document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', mode);
      toggleBtn.textContent = mode ? '☀️' : '🌙';
    });
  }

  try {
    const { ok, data } = await api('GET', '/api/config/google-client-id');
    if (ok && data.clientId) {
      GOOGLE_CLIENT_ID = data.clientId;
      const script = document.createElement('script');
      script.src   = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (loginRole === 'guru') initGoogleGSI();
      };
      document.head.appendChild(script);
    }
  } catch (_) {
    // Tidak fatal — Google login tidak tersedia
  }
}

// ── Wire up all event listeners ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Role toggle
  const kepalaBtn = $('role-kepala-btn');
  const guruBtn   = $('role-guru-btn');
  if (kepalaBtn) kepalaBtn.addEventListener('click', () => setLoginRole('kepala'));
  if (guruBtn)   guruBtn.addEventListener('click',   () => setLoginRole('guru'));

  // Logout
  const logoutBtn = $('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Refresh buttons
  const refreshList = $('btn-refresh-list');
  const refreshGuru = $('btn-refresh-guru');
  if (refreshList) refreshList.addEventListener('click', loadKodeList);
  if (refreshGuru) refreshGuru.addEventListener('click', loadGuruList);

  // Init components
  initLoginKepala();
  initGenerateKode();
  initCopyKode();
  initTabs();
  init();
});
