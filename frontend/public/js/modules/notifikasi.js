//  NOTIFICATION BELL
// ============================================================
bellNotifs = [];
bellUnreadCount = 0;

function addBellNotif(notif) {
  if (notif.id && bellNotifs.find(n => n.id === notif.id)) return; // cegah duplikat
  bellNotifs.unshift(notif);
  if (bellNotifs.length > 50) bellNotifs.pop();
  if (!notif.dibaca) {
    bellUnreadCount++;
    updateBellBadge();
  }
  if (document.getElementById('bell-dropdown').classList.contains('open')) {
    renderBellDropdown();
  }
}

function updateBellBadge() {
  const count = bellUnreadCount > 0 ? (bellUnreadCount > 99 ? '99+' : String(bellUnreadCount)) : '';
  document.querySelectorAll('.bell-badge').forEach(b => {
    b.textContent = count;
    if (bellUnreadCount > 0) b.classList.add('show');
    else b.classList.remove('show');
  });
}

function toggleBellDropdown() {
  const dd = document.getElementById('bell-dropdown');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open');
  } else {
    renderBellDropdown();
    dd.classList.add('open');
  }
}

function closeBellDropdown() {
  document.getElementById('bell-dropdown')?.classList.remove('open');
}

function renderBellDropdown() {
  const list = document.getElementById('bell-list');
  if (!list) return;
  if (bellNotifs.length === 0) {
    list.innerHTML = '<div class="bell-empty">🔔<br>Belum ada notifikasi</div>';
    return;
  }
  list.innerHTML = bellNotifs.slice(0, 30).map(n => {
    const icon = { private: '💬', kelas: '🏫', materi: '📚', quiz: '📝', quiz_invite: '🎯', deadline: '⏰' }[n.tipe] || '🔔';
    const timeStr = n.created_at ? formatBellTime(new Date(n.created_at)) : '';
    const safe_id     = escapeHtml(n.id || '');
    const safe_tipe   = escapeHtml(n.tipe || '');
    const safe_dariId = escapeHtml(n.dari_id || '');
    const safe_nama   = (n.pengirim_nama || '').replace(/'/g, '&apos;');
    const safe_ava    = (n.pengirim_avatar || '').replace(/'/g, '&apos;');
    const safe_kelas  = escapeHtml(n.kelas_id || '');
    return `<div class="bell-notif-item type-${safe_tipe}${n.dibaca ? '' : ' unread'}"
      onclick="klikBellNotif('${safe_id}','${safe_tipe}','${safe_dariId}','${safe_nama}','${safe_ava}','${safe_kelas}')">
      <div class="bell-notif-icon">${icon}</div>
      <div class="bell-notif-body">
        <div class="bell-notif-judul">${escapeHtml(n.judul || '')}</div>
        <div class="bell-notif-isi">${escapeHtml(n.pesan || '')}</div>
        <div class="bell-notif-time">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

function formatBellTime(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

async function klikBellNotif(id, tipe, dariId, namaPengirim, avatarPengirim, kelasId) {
  closeBellDropdown();
  const notif = bellNotifs.find(n => n.id === id);
  if (notif && !notif.dibaca) {
    notif.dibaca = true;
    bellUnreadCount = Math.max(0, bellUnreadCount - 1);
    updateBellBadge();
  }

  // Private chat → buka chat langsung
  if (tipe === 'private' && dariId) {
    bukaPrivateChat(dariId, namaPengirim || 'Seseorang', avatarPengirim || '🦁');
    return;
  }

  // Quiz invite → buka quiz langsung
  if (tipe === 'quiz_invite' && notif) {
    let kode = null;
    try {
      const extra = typeof notif.data_extra === 'string' ? JSON.parse(notif.data_extra) : notif.data_extra;
      kode = extra?.kode_room;
    } catch(e) {}
    if (kode) {
      bukaZepQuizDariKode(kode);
    } else {
      bukaZepQuizMurid();
    }
    return;
  }

  // Deadline reminder → buka kelas tab kuis
  if (tipe === 'deadline' && kelasId) {
    try {
      await openKelas(kelasId, 0);
      setTimeout(() => switchKelasTab('kuis'), 400);
    } catch(e) {
      toast('Gagal membuka kelas terkait.', 'error');
    }
    return;
  }

  // Kelas (materi, kuis/tugas) → buka kelas yang benar
  if (kelasId) {
    try {
      await openKelas(kelasId, 0);
      // Tunggu halaman kelas terbuka, lalu switch tab sesuai tipe
      setTimeout(() => {
        if (tipe === 'materi') {
          switchKelasTab('materi');
        } else if (tipe === 'quiz' || tipe === 'kuis' || tipe === 'tugas' || tipe === 'tugas_baru') {
          switchKelasTab('kuis');
        } else {
          switchKelasTab('materi');
        }
      }, 400);
    } catch(e) {
      toast('Gagal membuka kelas terkait.', 'error');
    }
    return;
  }

  // Fallback: buka halaman sesuai role
  if (currentUser) {
    if (currentUser.role === 'guru') showPage('page-guru');
    else if (currentUser.role === 'orangtua') showPage('page-orangtua');
    else if (currentUser.role === 'kepala_sekolah') window.location.href = '/portal-kepala.html';
    else showPage('page-murid');
  }
}

async function bellTandaiSemuaDibaca() {
  bellNotifs.forEach(n => { n.dibaca = true; });
  bellUnreadCount = 0;
  updateBellBadge();
  renderBellDropdown();
  try { await api('PATCH', '/notifikasi/baca-semua'); } catch(e) {}
}

async function loadBellNotifications() {
  if (!currentUser) return;
  bellNotifs = [];
  bellUnreadCount = 0;
  try {
    const data = await api('GET', '/notifikasi');
    (data.data || []).forEach(n => {
      let tipe = n.tipe || 'notif';
      let kelas_id = null;
      let dari_id = null;
      let pengirim_nama = null;
      let pengirim_avatar = null;
      let data_extra = n.data_extra;
      if (data_extra) {
        try {
          const extra = typeof data_extra === 'string' ? JSON.parse(data_extra) : data_extra;
          kelas_id       = extra?.kelas_id       || null;
          dari_id        = extra?.dari_id        || null;
          pengirim_nama  = extra?.pengirim_nama  || null;
          pengirim_avatar= extra?.pengirim_avatar|| null;
        } catch(e) {}
      }
      bellNotifs.push({
        id: n.id,
        tipe,
        judul: n.judul,
        pesan: n.pesan,
        created_at: n.created_at,
        dibaca: n.dibaca,
        kelas_id,
        dari_id,
        pengirim_nama,
        pengirim_avatar,
        data_extra
      });
      if (!n.dibaca) bellUnreadCount++;
    });
    updateBellBadge();
  } catch(e) {
    console.error('[loadBellNotifications] error:', e);
  }
}

// Tutup dropdown jika klik di luar
document.addEventListener('click', (e) => {
  const dd = document.getElementById('bell-dropdown');
  if (dd?.classList.contains('open') && !dd.contains(e.target) && !e.target.closest('.bell-btn')) {
    closeBellDropdown();
  }
});

// Socket: notifikasi materi/quiz dari backend
socket.on('notif:baru', (notif) => {
  let kelas_id = null, dari_id = null, pengirim_nama = null, pengirim_avatar = null;
  if (notif.data_extra) {
    try {
      const extra = typeof notif.data_extra === 'string' ? JSON.parse(notif.data_extra) : notif.data_extra;
      kelas_id        = extra?.kelas_id        || null;
      dari_id         = extra?.dari_id         || null;
      pengirim_nama   = extra?.pengirim_nama   || null;
      pengirim_avatar = extra?.pengirim_avatar || null;
    } catch(e) {}
  }
  addBellNotif({
    id: 'n_' + Date.now() + '_' + Math.random(),
    tipe: notif.tipe || 'notif',
    judul: notif.judul,
    pesan: notif.pesan,
    created_at: notif.created_at || new Date().toISOString(),
    dibaca: false,
    kelas_id, dari_id, pengirim_nama, pengirim_avatar,
    data_extra: notif.data_extra
  });
  // Browser notification saat tab tidak aktif
  showBrowserNotif(notif.judul || 'KitaBelajar', notif.pesan || '', 'notif-' + (notif.tipe || 'umum'), true);
});

// ─── Deadline reminder: tambah bell notif untuk tugas yang mau deadline ───
_deadlineReminderSent = new Set();

function cekDeadlineReminder(deadlines) {
  if (!Array.isArray(deadlines)) return;
  const now = Date.now();
  deadlines.forEach(q => {
    if (!q.deadline || q.sudah_dikerjakan || q.tipe === 'fun') return;
    const diff = new Date(q.deadline) - now;
    if (diff <= 0 || diff > 86400000 * 2) return; // hanya 2 hari ke depan
    const key = `deadline_${q.id}`;
    if (_deadlineReminderSent.has(key)) return; // sudah pernah dikirim
    _deadlineReminderSent.add(key);

    const jamSisa = Math.floor(diff / 3600000);
    const menitSisa = Math.floor(diff / 60000);
    const label = menitSisa < 60
      ? `${menitSisa} menit lagi`
      : jamSisa < 24
      ? `${jamSisa} jam lagi`
      : `${Math.floor(diff / 86400000)} hari lagi`;

    addBellNotif({
      id: key,
      tipe: 'deadline',
      judul: `⏰ Deadline: ${q.judul}`,
      pesan: `Tugas "${q.judul}" di kelas ${q.kelas_nama || ''} — ${label}!`,
      created_at: new Date().toISOString(),
      dibaca: false,
      kelas_id: q.kelas_id || null,
      dari_id: null,
      pengirim_nama: null,
      pengirim_avatar: null,
      data_extra: null
    });
  });
}

async function bukaPrivateChat(userId, nama, avatar) {
  if (!userId) { toast('Tidak bisa membuka chat', 'error'); return; }
  privateChatTargetId = userId;
  privateChatTargetNama = nama;
  privateChatTargetAvatar = avatar;

  const badge = document.getElementById('pc-unread-badge-' + userId) || document.getElementById('pc-unread-badge-guru');
  if (badge) badge.style.display = 'none';

  if (window._privateChatUnreadMap) {
    delete window._privateChatUnreadMap[userId];
    const hasUnread = Object.keys(window._privateChatUnreadMap).length > 0;
    updateMuridTabBadge(hasUnread);
  }

  setAvatarEl(document.getElementById('pc-avatar'), avatar, 'big');
  document.getElementById('pc-nama').textContent = nama;
  document.getElementById('pc-status').textContent = 'Chat Privat';
  document.getElementById('pc-messages').innerHTML =
    '<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">Memuat pesan...</div>';

  openModal('modal-private-chat');

  try {
    const data = await api('GET', `/chat/private/${userId}`);
    const box = document.getElementById('pc-messages');
    box.innerHTML = '';
    (data.data || []).forEach(p => appendPrivateMessage(p, p.dari_id === currentUser.id));
    scrollPrivateChatToBottom();
  } catch(e) {
    document.getElementById('pc-messages').innerHTML =
      '<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">Gagal memuat pesan</div>';
  }
}

function appendPrivateMessage(p, isSelf) {
  const box = document.getElementById('pc-messages');
  if (!box) return;
  const waktu = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const ava = isSelf ? (currentUser?.avatar || '🦁') : privateChatTargetAvatar;
  const msgId = p.id || '';
  const div = document.createElement('div');
  div.dataset.msgId = msgId;
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isSelf ? 'flex-end' : 'flex-start'};gap:2px`;
  const editedLabel = p.edited ? '<span style="font-size:10px;opacity:0.7;font-style:italic"> (diedit)</span>' : '';
  const msgAgeMs = new Date() - new Date(p.created_at);
  const isRecent = msgAgeMs <= 5 * 60 * 1000;
  const selfActions = isSelf && msgId && isRecent ? `
    <div class="pc-msg-actions" style="display:none;gap:4px;margin-top:2px">
      <button onclick="editPesanPrivat('${msgId}',this)" style="background:none;border:1px solid #ddd;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;color:var(--blue)">✏️ Edit</button>
      <button onclick="hapusPesanPrivat('${msgId}',this)" style="background:none;border:1px solid #ddd;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;color:var(--red)">🗑️ Hapus</button>
    </div>` : '';
  div.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:6px;flex-direction:${isSelf ? 'row-reverse' : 'row'}"
         onmouseenter="${isSelf && msgId && isRecent ? `this.querySelector('.pc-msg-actions')&&(this.querySelector('.pc-msg-actions').style.display='flex')` : ''}"
         onmouseleave="${isSelf && msgId && isRecent ? `this.querySelector('.pc-msg-actions')&&(this.querySelector('.pc-msg-actions').style.display='none')` : ''}">
      <div style="font-size:18px;flex-shrink:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%">${chatAvatarHtml(ava)}</div>
      <div style="max-width:78%">
        <div class="pc-msg-bubble" style="padding:10px 14px;border-radius:${isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isSelf ? 'var(--blue)' : 'white'};color:${isSelf ? 'white' : 'var(--text)'};font-size:14px;font-weight:600;border:${isSelf ? 'none' : '1.5px solid #E8E8E8'};word-break:break-word">${formatChatContent(p.isi, isSelf)}${editedLabel}</div>
        ${selfActions}
      </div>
    </div>
    <div style="font-size:10px;color:var(--muted);padding:0 32px">${waktu}</div>`;
  box.appendChild(div);
}

async function editPesanPrivat(msgId, btn) {
  const div = btn.closest('[data-msg-id]');
  const bubble = div?.querySelector('.pc-msg-bubble');
  if (!bubble || bubble.querySelector('textarea')) return;
  const originalHTML = bubble.innerHTML;
  const currentText = bubble.textContent.replace(/\s*\(diedit\)\s*$/, '').trim();

  const restore = () => { bubble.innerHTML = originalHTML; };

  bubble.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.value = currentText;
  ta.style.cssText = 'width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:6px 8px;font-family:Nunito,sans-serif;font-size:14px;font-weight:600;resize:none;min-height:56px;background:rgba(255,255,255,0.15);color:white;outline:none';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓ Simpan';
  saveBtn.style.cssText = 'background:rgba(255,255,255,0.9);color:var(--blue);border:none;border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Batal';
  cancelBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  cancelBtn.onclick = restore;
  saveBtn.onclick = async () => {
    const newText = ta.value.trim();
    if (!newText) return;
    if (newText === currentText) { restore(); return; }
    saveBtn.disabled = true; saveBtn.textContent = '...';
    try {
      const data = await api('PUT', `/chat/private/msg/${msgId}`, { isi: newText });
      if (data.success) {
        bubble.innerHTML = escapeHtml(newText) + '<span style="font-size:10px;opacity:0.7;font-style:italic"> (diedit)</span>';
      } else { toast('Gagal edit pesan', 'error'); restore(); }
    } catch(e) { toast('Gagal edit pesan', 'error'); restore(); }
  };

  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  bubble.appendChild(ta); bubble.appendChild(btnRow);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}

async function hapusPesanPrivat(msgId, btn) {
  document.getElementById('btn-hapus-pesan-ok').onclick = async () => {
    closeModal('modal-hapus-pesan');
    try {
      const data = await api('DELETE', `/chat/private/msg/${msgId}`);
      if (data.success) {
        const div = btn.closest('[data-msg-id]');
        if (div) div.remove();
      }
    } catch(e) { toast('Gagal hapus pesan', 'error'); }
  };
  openModal('modal-hapus-pesan');
}

function scrollPrivateChatToBottom() {
  const box = document.getElementById('pc-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function kirimPrivateChat() {
  const input = document.getElementById('pc-input');
  let isi = input.value.trim();

  if (pendingPrivateAttachment) {
    const fileMessage = `[FILE:${pendingPrivateAttachment.url}|${pendingPrivateAttachment.name}]`;
    isi = isi ? `${isi}\n${fileMessage}` : fileMessage;
  }

  if (!isi || !privateChatTargetId) return;
  input.value = '';
  clearChatFileAttachment('private');
  try {
    const data = await api('POST', `/chat/private/${privateChatTargetId}`, { isi });
    if (data.success) {
      const msgId = data.data?.id;
      appendPrivateMessage({ id: msgId, isi, created_at: new Date().toISOString() }, true);
      scrollPrivateChatToBottom();
    }
  } catch(e) {
    toast('Gagal mengirim pesan', 'error');
    input.value = isi;
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => toast(`Kode "${text}" disalin! 📋`, 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast(`Kode "${text}" disalin! 📋`, 'success');
    });
}