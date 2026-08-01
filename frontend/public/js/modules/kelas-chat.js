// ============================================================
//  KELAS CARD RENDERER
// ============================================================
const KELAS_COLORS = ['bg-c1','bg-c2','bg-c3','bg-c4','bg-c5','bg-c6','bg-c7','bg-c8'];
const KELAS_EMOJIS = ['📐','🔬','📖','🗺️','🎨','🏃','🎵','💻'];

function kelasHashIdx(id) {
  let h = 0;
  const s = id || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

function renderKelasCard(k, i, role) {
  const idx = kelasHashIdx(k.id);
  const colorClass = KELAS_COLORS[idx % KELAS_COLORS.length];
  // Cari emoji dari mapel kelas: cek custom mapel user dulu, lalu fuzzy match, lalu fallback
  let emoji = KELAS_EMOJIS[idx % KELAS_EMOJIS.length];
  if (k.mapel) {
    const customMapel = getMapelList().find(m => m.nama.toLowerCase() === k.mapel.toLowerCase());
    if (customMapel?.emoji) {
      emoji = customMapel.emoji;
    } else {
      const fuzzy = getMapelEmoji(k.mapel);
      if (fuzzy && fuzzy !== '📚') emoji = fuzzy;
    }
  }
  const isGuru = role === 'guru';
  return `<div class="kelas-card" onclick="openKelas('${k.id}',${idx % KELAS_COLORS.length})">
    <div class="kelas-card-header ${colorClass}">
      <div class="kelas-emoji">${emoji}</div>
      ${k.mapel ? `<div class="kelas-mapel-tag">${k.mapel}</div><br>` : ''}
      <div class="kelas-name">${escapeHtml(k.nama)}</div>
      <div class="kelas-guru-name">${isGuru ? (k.tahun_ajar || '') : ('Guru: ' + (k.guru_nama || k.guru?.nama || '–'))}</div>
    </div>
    <div class="kelas-card-footer">
      ${isGuru ? `
        <div class="kelas-code-wrap">
          <span class="kelas-code-label">Kode:</span>
          <span class="kelas-code kelas-code-hidden" id="kelas-code-card-${k.id}">${k.kode_akses || '–'}</span>
          <button class="kelas-code-toggle-btn" id="kelas-code-eye-${k.id}"
            onclick="event.stopPropagation();toggleKelasCodeVisibility('${k.id}')" title="Tampilkan/sembunyikan kode">👁️</button>
          <button class="kelas-copy-btn" onclick="event.stopPropagation();copyToClipboard('${k.kode_akses}')" title="Salin kode">📋</button>
        </div>
      ` : `<div class="kelas-stat">👨‍🏫 ${k.guru_nama || k.guru?.nama || 'Guru'}</div>`}
      <div style="display:flex;align-items:center;gap:8px">
        <div class="kelas-stat">📚 ${k.total_materi || 0} materi</div>
        ${!isGuru ? `<span id="card-chat-badge-${k.id}" style="display:none;background:var(--red);color:white;border-radius:50px;padding:1px 7px;font-size:10px;font-weight:800;line-height:1.5">0</span>` : ''}
        <div class="kelas-overflow-menu" onclick="event.stopPropagation()">
          <button class="kelas-overflow-btn" id="kelas-menu-btn-${k.id}"
            onclick="toggleKelasOverflow('${k.id}')" title="Opsi kelas">⋯</button>
          <div class="kelas-overflow-dropdown" id="kelas-menu-${k.id}">
            ${isGuru
              ? `<button class="kelas-overflow-item danger" onclick="toggleKelasOverflow('${k.id}');konfirmasiHapusKelas('${k.id}','${k.nama.replace(/'/g, "\\'")}')">🗑️ Hapus Kelas</button>`
              : `<button class="kelas-overflow-item danger" onclick="toggleKelasOverflow('${k.id}');konfirmasiKeluarKelas('${k.id}','${k.nama.replace(/'/g, "\\'")}')">🚪 Keluar Kelas</button>`
            }
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ============================================================
//  BUKA DETAIL KELAS
// ============================================================
let currentKelas = null;

async function openKelas(kelasId, colorIdx) {
  showLoading(true);
  classChatUnreadCount = 0;
  chatUnreadPerKelas[kelasId] = 0;
  updateClassChatBadge();
  updateClassCardChatBadge(kelasId);
  try {
    // Pakai data card yang sudah ada sebagai tampilan awal
    const cached = (window._kelasList || []).find(x => x.id === kelasId);
    let k = cached || { id: kelasId, nama: 'Kelas', mapel: '', guru_nama: '–', kode_akses: '–', total_materi: 0, total_murid: 0 };
    const resolvedColorIdx = kelasHashIdx(kelasId) % KELAS_COLORS.length;
    currentKelas = { ...k, id: kelasId, colorIdx: resolvedColorIdx };

    const colorClass = KELAS_COLORS[resolvedColorIdx];
    const isGuru = currentUser?.role === 'guru';

    document.getElementById('kelas-detail-title').textContent = k.nama;
    document.getElementById('kelas-banner-title').textContent = k.nama;
    document.getElementById('kelas-banner-mapel').textContent = k.mapel || 'Kelas';
    document.getElementById('kelas-banner-guru').textContent = isGuru ? `Tahun Ajaran: ${k.tahun_ajar || '–'}` : `Guru: ${k.guru_nama || k.guru?.nama || '–'}`;
    document.getElementById('kelas-banner-bg').className = `kelas-banner-content ${colorClass}`;
    document.getElementById('kelas-code-display').textContent = k.kode_akses || '–';
    document.getElementById('kelas-add-materi-btn').style.display = isGuru ? 'inline-flex' : 'none';
    document.getElementById('kelas-add-kuis-btn').style.display = isGuru ? 'inline-flex' : 'none';
    document.getElementById('kelas-code-card').style.display = isGuru ? 'block' : 'none';
    const bannerBtn = document.getElementById('kelas-ubah-banner-btn');
    if (bannerBtn) bannerBtn.style.display = isGuru ? 'block' : 'none';
    document.getElementById('tab-murid-btn').style.display = '';
    document.getElementById('tab-penilaian-btn').style.display = isGuru ? '' : 'none';
    const btnAnalitik = document.getElementById('tab-analitik-btn');
    if (isGuru) {
      if (btnAnalitik) btnAnalitik.style.display = '';
      if (typeof AnalitikGuru !== 'undefined') AnalitikGuru.aktifkanTab(k.id || kelasId);
    } else {
      if (btnAnalitik) btnAnalitik.style.display = 'none';
    }

    document.getElementById('kelas-info-sidebar').innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Mapel</span><span style="font-weight:700">${k.mapel || '–'}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Total Materi</span><span style="font-weight:700">${k.total_materi || 0}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Murid</span><span style="font-weight:700">${k.total_murid || 0} orang</span></div>
    `;

    const aksiCard = document.getElementById('kelas-aksi-card');
    if (isGuru) {
      aksiCard.innerHTML = `<div class="sidebar-card" style="display:flex;flex-direction:column;gap:10px">
        <button id="vc-meeting-btn" class="btn-meeting" onclick="vcMulaiMeeting()">
          📹 Mulai Meeting
        </button>
        <button onclick="konfirmasiHapusKelas('${k.id || kelasId}','${(k.nama||'').replace(/'/g,"\\'")}')"
          style="width:100%;padding:12px;border-radius:12px;border:none;background:#FFEFE8;color:var(--red);font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s"
          onmouseover="this.style.background='var(--red)';this.style.color='white'"
          onmouseout="this.style.background='#FFEFE8';this.style.color='var(--red)'">
          🗑️ Hapus Kelas
        </button>
      </div>`;

      updateMuridTabBadge(false);
      api('GET', '/chat/inbox').then(inboxData => {
        if (inboxData.success) {
          const hasUnread = (inboxData.data || []).some(c => c.unread > 0);
          updateMuridTabBadge(hasUnread);
        }
      }).catch(() => {});
    } else {
      const guruNama = k.guru?.nama || k.guru_nama || 'Guru';
      const guruId = k.guru_id || '';
      aksiCard.innerHTML = `<div class="sidebar-card" style="display:flex;flex-direction:column;gap:10px">
        <button id="vc-meeting-btn" class="btn-meeting" onclick="vcJoinMeeting()" style="display:none">
          📹 Gabung Meeting
        </button>
        <div style="position:relative;width:100%">
          <button onclick="chatDenganGuru()"
            style="width:100%;padding:12px;border-radius:12px;border:none;background:#EEF5FF;color:var(--blue);font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s"
            onmouseover="this.style.background='var(--blue)';this.style.color='white'"
            onmouseout="this.style.background='#EEF5FF';this.style.color='var(--blue)'">
            💬 Chat dengan Guru
          </button>
          <span id="pc-unread-badge-guru" style="display:none;position:absolute;top:-5px;right:-5px;background:var(--red);color:white;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:800;align-items:center;justify-content:center;border:2.5px solid white">!</span>
        </div>
        <button onclick="konfirmasiKeluarKelas('${k.id || kelasId}','${(k.nama||'').replace(/'/g,"\\'")}')"
          style="width:100%;padding:12px;border-radius:12px;border:none;background:#FFF0F5;color:var(--pink);font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s"
          onmouseover="this.style.background='var(--pink)';this.style.color='white'"
          onmouseout="this.style.background='#FFF0F5';this.style.color='var(--pink)'">
          🚪 Keluar dari Kelas
        </button>
      </div>`;

      if (guruId) {
        api('GET', '/chat/inbox').then(inboxData => {
          if (inboxData.success) {
            const conv = (inboxData.data || []).find(c => c.partner.id === guruId);
            const bg = document.getElementById('pc-unread-badge-guru');
            if (conv && conv.unread > 0) {
              if (bg) bg.style.display = 'flex';
            } else if (bg) {
              bg.style.display = 'none';
            }
          }
        }).catch(() => {});
      }
    }

    showPage('page-kelas');
    switchKelasTab('materi');
    showLoading(false);

    // Muat detail + semua tab secara paralel — tidak ada yang blocking
    api('GET', `/kelas/${kelasId}`).then(data => {
      const detail = data.kelas || data.data || data;
      if (detail && detail.nama) {
        currentKelas = { ...detail, id: kelasId, colorIdx: resolvedColorIdx };
        // Update sidebar info dengan data lengkap
        document.getElementById('kelas-code-display').textContent = detail.kode_akses || '–';
        document.getElementById('kelas-info-sidebar').innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Mapel</span><span style="font-weight:700">${detail.mapel || '–'}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Total Materi</span><span style="font-weight:700">${detail.total_materi || 0}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Murid</span><span style="font-weight:700">${detail.total_murid || 0} orang</span></div>
        `;
      }
    }).catch(() => {});
    loadKelasStream(kelasId);
    loadKelasKuis(kelasId);
    loadKelasChatHistory(kelasId);
    // Bergabung ke socket room kelas
    if (currentUser) {
      socket.emit('kelas:join', {
        kelasId,
        userId: currentUser.id,
        nama: currentUser.nama,
        avatar: currentUser.avatar || '🦁',
        role: currentUser.role
      });
    }
    vcCurrentKelasId = kelasId;

    // Restore banner jika meeting masih aktif (setelah refresh)
    hideMeetingBanner();
    const savedMeeting = localStorage.getItem('kb_meeting_' + kelasId);
    if (savedMeeting) {
      try {
        const m = JSON.parse(savedMeeting);
        // Abaikan jika lebih dari 8 jam (meeting sudah lama)
        if (Date.now() - (m.ts || 0) < 8 * 60 * 60 * 1000) {
          if (currentUser?.role === 'guru') {
            // Guru restore overlay panel dari localStorage
            // (server tidak mengirim meeting_banner ke guru)
            setTimeout(() => {
              const roomName = vcGetRoomName(kelasId);
              vcMeetingTabUrl = m.roomUrl;
              vcShowMeetingPanel(roomName);
            }, 300);
          }
          // Murid: TIDAK restore dari localStorage — biarkan server yang menentukan
          // status meeting via kelas:meeting_banner atau kelas:meeting_ended
        } else {
          localStorage.removeItem('kb_meeting_' + kelasId);
        }
      } catch(e) { localStorage.removeItem('kb_meeting_' + kelasId); }
    }
  } catch(e) {
    showLoading(false);
    toast('Gagal membuka kelas', 'error');
  }
}

// Dipanggil dari tombol "Chat dengan Guru" di halaman kelas murid
function chatDenganGuru() {
  const k = currentKelas;
  if (!k) return;
  const guruId   = k.guru_id || '';
  const guruNama = k.guru?.nama || k.guru_nama || 'Guru';
  const guruAva  = k.guru?.avatar || '👩‍🏫';
  if (!guruId) { toast('Tidak bisa membuka chat', 'error'); return; }
  bukaPrivateChat(guruId, guruNama, guruAva);
}

async function loadKelasStream(kelasId) {
  const stream = document.getElementById('kelas-stream');
  stream.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat materi...</div>';
  try {
    const data = await api('GET', `/materi?kelas_id=${kelasId}`);
    const list = data.materi || data.data || [];
    const isGuru = currentUser?.role === 'guru';

    if (list.length === 0) {
      if (isGuru) {
        stream.innerHTML = `<div style="padding:8px 0">
          <div onclick="document.getElementById('kelas-add-materi-btn')?.click()"
            style="border:2.5px dashed #C8B8F5;border-radius:18px;padding:36px 24px;text-align:center;cursor:pointer;transition:all 0.2s;background:#FAFAFF"
            onmouseover="this.style.borderColor='var(--purple)';this.style.background='#F3EEFF'"
            onmouseout="this.style.borderColor='#C8B8F5';this.style.background='#FAFAFF'">
            <div style="font-size:44px;margin-bottom:12px">📚</div>
            <div style="font-weight:800;font-size:15px;color:var(--purple);margin-bottom:6px">Belum ada materi</div>
            <div style="font-size:13px;color:var(--muted)">Klik di sini untuk menambahkan materi pertama</div>
          </div>
        </div>`;
      } else {
        stream.innerHTML = `<div style="text-align:center;padding:48px 24px">
          <div style="font-size:56px;margin-bottom:16px">📭</div>
          <p style="font-weight:700;font-size:16px;color:var(--text);margin-bottom:8px">Belum ada materi</p>
          <p style="font-size:14px;color:var(--muted)">Gurumu belum menambahkan materi. Tunggu ya!</p>
        </div>`;
      }
      return;
    }

    // Progress bar materi untuk murid
    if (!isGuru) {
      const total    = list.length;
      const selesai  = list.filter(m => m.sudah_dibaca).length;
      const pct      = total > 0 ? Math.round((selesai / total) * 100) : 0;
      const pctColor = pct === 100 ? '#00C851' : pct >= 50 ? '#7b2ff7' : '#4D96FF';
      stream.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:14px 18px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);border:2px solid #F0E8FF">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-weight:800;font-size:13px;color:#444">📚 Progress Materi</span>
            <span id="materi-prog-label" style="font-weight:900;font-size:13px;color:${pctColor}">${selesai}/${total} selesai</span>
          </div>
          <div style="height:8px;background:#F0E8FF;border-radius:50px;overflow:hidden">
            <div id="materi-prog-bar" style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7b2ff7,#4D96FF);border-radius:50px;transition:width .4s"></div>
          </div>
          ${pct === 100 ? '<div style="text-align:center;margin-top:8px;font-size:12px;font-weight:800;color:#00C851">🎉 Semua materi sudah selesai!</div>' : ''}
        </div>`;
    } else {
      stream.innerHTML = '';
    }

    stream.innerHTML += list.map(m => {
      const icon = m.jenis === 'video' ? '🎬' : m.jenis === 'pdf' ? '📄' : m.jenis === 'gambar' ? '🖼️' : '📝';
      const iconBg = m.jenis === 'video' ? '#FFF0F5' : m.jenis === 'pdf' ? '#FFEFE8' : m.jenis === 'gambar' ? '#F0FFF4' : '#EEF5FF';
      const tgl = new Date(m.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
      let bodyHtml = '';

      if (m.jenis === 'video' && m.konten) {
        const ytMatch = m.konten.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^?&]+)/);
        const videoId = ytMatch ? ytMatch[1] : null;
        const embedUrl = videoId
          ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`
          : m.konten;
        const watchUrl = videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : (m.file_url || m.konten);
        const thumbUrl = videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : '';

        if (videoId) {
          // Tampilkan thumbnail dulu — klik baru load iframe (menghindari Error 153 yang tampil jelek)
          bodyHtml = `<div id="yt-wrap-${m.id}" style="position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;background:#000;cursor:pointer" onclick="ytPlayClick('${m.id}','${embedUrl}','${watchUrl}')">
            <img src="${thumbUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:12px" onerror="this.style.background='#111'">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:48px;background:#FF0000;border-radius:12px;display:flex;align-items:center;justify-content:center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>`;
        } else {
          // Non-YouTube: langsung iframe
          bodyHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden">
            <iframe src="${escapeHtml(m.konten)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe>
          </div>`;
        }
      } else if (m.jenis === 'pdf' && m.file_url) {
        bodyHtml = `<a href="${escapeHtml(m.file_url)}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:var(--orange);color:white;padding:10px 20px;border-radius:50px;font-weight:700;font-size:14px;text-decoration:none">📄 Buka / Download PDF</a>
        ${m.deskripsi ? `<p style="margin-top:12px;font-size:14px;color:var(--muted)">${escapeHtml(m.deskripsi)}</p>` : ''}`;
      } else if (m.jenis === 'gambar' && m.konten) {
        bodyHtml = `<img src="${escapeHtml(m.konten)}" style="max-width:100%;border-radius:12px" onerror="this.style.display='none'">`;
      } else {
        const raw = m.konten || '';
        const rendered = renderMarkdown(raw);
        const postId = 'post-' + (m.id || Math.random().toString(36).slice(2));
        const isLong = raw.length > 400;
        bodyHtml = `
          <div id="${postId}-content" class="stream-post-body-text markdown-body" style="${isLong ? 'max-height:160px;overflow:hidden;position:relative;' : ''}">${rendered}${isLong ? `<div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent,white)"></div>` : ''}</div>
          ${isLong ? `<button class="stream-toggle" onclick="toggleMateri('${postId}', this)" style="margin-top:8px">📖 Baca Selengkapnya</button>` : ''}
        `;
      }

      const sudah = m.sudah_dibaca;

      // Footer ceklis — hanya untuk murid
      const ceklisHtml = !isGuru ? `
        <div class="materi-ceklis-footer" id="ceklis-footer-${m.id}">
          <button
            class="materi-ceklis-btn ${sudah ? 'done' : ''}"
            id="ceklis-btn-${m.id}"
            data-xp-claimed="${m.xp_sudah_diklaim ? 'true' : 'false'}"
            onclick="toggleMateriDibaca('${m.id}', '${(m.judul||'').replace(/'/g,"\\'")}', this)"
            title="${sudah ? 'Klik untuk batal tandai dibaca' : 'Tandai sudah dibaca'}">
            <span class="ceklis-box">${sudah ? '✓' : ''}</span>
            <span class="ceklis-label">${sudah ? 'Sudah dibaca' : 'Tandai sudah dibaca'}</span>
            ${(!sudah && !m.xp_sudah_diklaim) ? '<span class="ceklis-xp">+20 XP</span>' : ''}
          </button>
        </div>` : '';

      return `<div class="stream-post ${sudah && !isGuru ? 'materi-done' : ''}" id="stream-post-${m.id}">
        <div class="stream-post-header">
          <div class="stream-post-icon" style="background:${iconBg}">${icon}</div>
          <div class="stream-post-meta">
            <h4>${escapeHtml(m.judul)}</h4>
            <p>${m.mapel || ''} · ${tgl}</p>
          </div>
          ${isGuru ? `<div class="stream-post-actions">
            <button class="btn-icon btn-edit" data-id="${m.id}" data-judul="${m.judul.replace(/"/g,'&quot;')}" data-mapel="${m.mapel}" data-jenis="${m.jenis}" data-status="${m.status}" onclick="editMateriBtn(this)" title="Edit">✏️</button>
            <button class="btn-icon btn-delete" data-id="${m.id}" data-judul="${m.judul.replace(/"/g,'&quot;')}" onclick="deleteMateriBtn(this)" title="Hapus">🗑️</button>
          </div>` : (!isGuru && sudah ? '<span style="font-size:18px;color:#00C851;flex-shrink:0">✅</span>' : '')}
        </div>
        ${m.deskripsi ? `<div style="padding:0 20px 10px;font-size:13px;color:var(--muted);line-height:1.5">${m.deskripsi}</div>` : ''}
        <div class="stream-post-body">
          ${bodyHtml}
        </div>
        ${ceklisHtml}
      </div>`;
    }).join('');
  } catch(e) {
    stream.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat materi</p></div>';
  }
}

function kembaliDashboard() {
  if (currentKelas?.id) socket.emit('kelas:leave', { kelasId: currentKelas.id });
  currentKelas = null;
  if (currentUser?.role === 'guru') loadGuruDashboard();
  else if (currentUser?.role === 'orangtua') loadOrangtuaDashboard();
  else loadMuridDashboard();
}

// ── Toggle materi sudah/belum dibaca (ceklis) ────────────────────
async function toggleMateriDibaca(materiId, judulMateri, btnEl) {
  if (btnEl.classList.contains('loading')) return;

  const wasDone = btnEl.classList.contains('done');
  btnEl.classList.add('loading');
  btnEl.querySelector('.ceklis-label').textContent = 'Menyimpan...';

  try {
    const token = localStorage.getItem('kb_token') || '';
    const res = await fetch(`/api/materi/${materiId}/selesai`, {
      method: wasDone ? 'DELETE' : 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    const json = await res.json();

    if (json.success) {
      btnEl.classList.remove('loading');
      const isDone = json.selesai !== undefined ? json.selesai === true : !wasDone;
      if (json.xp_sudah_diklaim) btnEl.dataset.xpClaimed = 'true';
      setMateriDibacaUI(materiId, btnEl, isDone);
      const xp = json.xp_dapat || 0;
      toast(isDone ? `✅ "${judulMateri}" sudah dibaca${xp > 0 ? `! +${xp} XP` : ''}` : `↩️ "${judulMateri}" ditandai belum dibaca`);
      updateMateriProgressBar();
    } else {
      btnEl.classList.remove('loading');
      setMateriDibacaUI(materiId, btnEl, wasDone);
      toast('Gagal menyimpan. Coba lagi.');
    }
  } catch(e) {
    btnEl.classList.remove('loading');
    setMateriDibacaUI(materiId, btnEl, wasDone);
    toast('Gagal terhubung ke server.');
  }
}

function setMateriDibacaUI(materiId, btnEl, done) {
  btnEl.classList.toggle('done', done);
  btnEl.title = done ? 'Klik untuk batal tandai dibaca' : 'Tandai sudah dibaca';
  btnEl.querySelector('.ceklis-box').textContent = done ? '✓' : '';
  btnEl.querySelector('.ceklis-label').textContent = done ? 'Sudah dibaca' : 'Tandai sudah dibaca';

  let xpEl = btnEl.querySelector('.ceklis-xp');
  if (done && xpEl) xpEl.remove();
  if (!done && !xpEl && btnEl.dataset.xpClaimed !== 'true') {
    xpEl = document.createElement('span');
    xpEl.className = 'ceklis-xp';
    xpEl.textContent = '+20 XP';
    btnEl.appendChild(xpEl);
  }

  const card = document.getElementById(`stream-post-${materiId}`);
  if (!card) return;
  card.classList.toggle('materi-done', done);
  const header = card.querySelector('.stream-post-header');
  const icon = header?.querySelector('.materi-done-icon, .stream-post-header > span[style*="#00C851"]');
  if (done && header && !icon) {
    const badge = document.createElement('span');
    badge.className = 'materi-done-icon';
    badge.style.cssText = 'font-size:18px;color:#00C851;flex-shrink:0';
    badge.textContent = '✅';
    header.appendChild(badge);
  } else if (!done && icon) {
    icon.remove();
  }
}

// Update angka progress bar materi tanpa reload seluruh stream
function updateMateriProgressBar() {
  const stream   = document.getElementById('kelas-stream');
  if (!stream) return;
  const allCards = stream.querySelectorAll('[id^="stream-post-"]');
  const total    = allCards.length;
  const selesai  = stream.querySelectorAll('.stream-post.materi-done').length;
  const pct      = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const pctColor = pct === 100 ? '#00C851' : pct >= 50 ? '#7b2ff7' : '#4D96FF';

  const barEl    = stream.querySelector('[id="materi-prog-bar"]') ||
                   stream.querySelector('div > div[style*="height:8px"]');
  const labelEl  = stream.querySelector('[id="materi-prog-label"]');

  if (barEl)   barEl.style.width    = pct + '%';
  if (labelEl) labelEl.textContent  = `${selesai}/${total} selesai`;

  if (pct === 100) toast('🎉 Semua materi sudah selesai!');
}

function copyKodeKelas() {
  const kode = document.getElementById('kelas-code-display').textContent.trim();
  copyToClipboard(kode);
}

// Toggle overflow menu (titik tiga) pada card kelas
function toggleKelasOverflow(kelasId) {
  const menu = document.getElementById('kelas-menu-' + kelasId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  // Tutup semua dropdown lain dulu
  document.querySelectorAll('.kelas-overflow-dropdown.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) {
    menu.classList.add('open');
    // Tutup saat klik di luar
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!menu.contains(e.target)) { menu.classList.remove('open'); document.removeEventListener('click', closeHandler); }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  }
}

// Toggle show/hide untuk kode kelas di card guru
function toggleKelasCodeVisibility(kelasId) {
  const span = document.getElementById('kelas-code-card-' + kelasId);
  const btn  = document.getElementById('kelas-code-eye-' + kelasId);
  if (!span) return;
  const isHidden = span.classList.contains('kelas-code-hidden');
  span.classList.toggle('kelas-code-hidden', !isHidden);
  if (btn) btn.textContent = isHidden ? '🙈' : '👁️';
}

// ============================================================
//  LIST MURID KELAS + ONLINE/OFFLINE
// ============================================================
let kelasOnlineUsers = []; // diupdate via socket

async function loadKelasMurid(kelasId) {
  const el = document.getElementById('kelas-murid-stream');
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat daftar murid...</div>';
  try {
    const [kelasData, inboxData] = await Promise.all([
      api('GET', `/kelas/${kelasId}`),
      currentUser?.role === 'guru' ? api('GET', '/chat/inbox') : Promise.resolve({ data: [] })
    ]);
    const muridList = kelasData.data?.murid || [];
    window._privateChatUnreadMap = {};
    if (inboxData?.success) {
      (inboxData.data || []).forEach(c => {
        if (c.unread > 0) window._privateChatUnreadMap[c.partner.id] = c.unread;
      });
    }
    renderMuridList(muridList);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat murid</p></div>';
  }
}

function renderMuridList(muridList) {
  const el = document.getElementById('kelas-murid-stream');
  if (!muridList.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>Belum ada murid yang bergabung</p></div>';
    return;
  }
  const onlineIds = new Set(kelasOnlineUsers.filter(u => u.role === 'murid').map(u => u.userId));
  const onlineMuridCount = muridList.filter(m => onlineIds.has(m.id)).length;
  const sortedList = [...muridList].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1;
    const bOnline = onlineIds.has(b.id) ? 0 : 1;
    return aOnline - bOnline;
  });
  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--muted);font-weight:700">
      ${muridList.length} murid · <span style="color:#22C55E">● ${onlineMuridCount} online</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${(() => {
        window._muridAvatarMap = window._muridAvatarMap || {};
        return sortedList.map(m => {
          window._muridAvatarMap[m.id] = m.avatar || '🦁';
          const isOnline = onlineIds.has(m.id);
          const unreadCount = window._privateChatUnreadMap?.[m.id] || 0;
          const unreadBadge = unreadCount > 0
            ? `<span id="pc-unread-badge-${m.id}" style="position:absolute;top:-5px;right:-5px;background:var(--red);color:white;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2.5px solid white">!</span>`
            : '';
          return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:white;border-radius:14px;border:2px solid ${isOnline ? '#D1FAE5' : '#F3F4F6'};transition:all 0.2s">
          <div style="position:relative;flex-shrink:0">
            <div style="width:40px;height:40px;border-radius:50%;background:${isOnline ? '#D1FAE5' : '#F3F4F6'};display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden">${chatAvatarHtml(m.avatar || '🦁')}</div>
            <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${isOnline ? '#22C55E' : '#9CA3AF'};border:2px solid white"></div>
          </div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:14px">${m.nama}</div>
            <div style="font-size:12px;color:${isOnline ? '#16A34A' : 'var(--muted)'};font-weight:600">${isOnline ? '● Online' : '○ Offline'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="text-align:right">
              <div style="font-size:12px;color:var(--muted);font-weight:700">Lv.${m.level || 1}</div>
              <div style="font-size:11px;color:var(--orange);font-weight:700">${m.xp || 0} XP</div>
            </div>
            ${currentUser?.role === 'guru' ? `
              <div style="position:relative">
                <button onclick="bukaPrivateChat('${m.id}','${m.nama.replace(/'/g,"\\'")}',window._muridAvatarMap['${m.id}']||'🦁')"
                  style="background:var(--blue);color:white;border:none;padding:7px 12px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:12px;cursor:pointer;flex-shrink:0"
                  title="Chat privat dengan ${m.nama}">💬</button>
                ${unreadBadge}
              </div>` : ''}
          </div>
        </div>`;
        }).join('');
      })()}
    </div>`;
}

// ============================================================
//  CHAT KELAS
// ============================================================
let kelasChatKelasId = null;

async function loadKelasChatHistory(kelasId) {
  kelasChatKelasId = kelasId;
  const box = document.getElementById('kelas-chat-messages');
  box.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Memuat pesan...</div>';
  try {
    const data = await api('GET', `/kelas/${kelasId}/chat`);
    const pesanList = data.data || [];
    box.innerHTML = '';
    pesanList.forEach(p => appendChatMessage(p));
    scrollChatToBottom();
  } catch(e) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Gagal memuat chat</div>';
  }
}

let classChatUnreadCount = 0;
let chatUnreadPerKelas = {};

function updateClassCardChatBadge(kelasId) {
  const badge = document.getElementById('card-chat-badge-' + kelasId);
  if (!badge) return;
  const count = chatUnreadPerKelas[kelasId] || 0;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function updateClassChatBadge() {
  const btn = document.getElementById('tab-chat-btn');
  if (!btn) return;
  if (classChatUnreadCount > 0) {
    const displayCount = classChatUnreadCount > 99 ? '99+' : classChatUnreadCount;
    btn.innerHTML = `💬 Chat <span style="background:var(--red);color:white;border-radius:50px;padding:2px 8px;font-size:11px;font-weight:800;margin-left:4px">${displayCount}</span>`;
  } else {
    btn.innerHTML = '💬 Chat';
  }
}

function updateMuridTabBadge(hasUnread) {
  const btn = document.getElementById('tab-murid-btn');
  if (!btn) return;
  if (hasUnread) {
    btn.innerHTML = `👥 Murid <span id="murid-tab-unread-dot" style="background:var(--red);color:white;border-radius:50%;padding:1px 6px;font-size:10px;font-weight:800;margin-left:4px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle">!</span>`;
  } else {
    btn.innerHTML = '👥 Murid';
  }
}

function formatChatContent(isi, isSelf) {
  const parts = String(isi || '').split(/(\[FILE:[^|\]]+\|[^\]]+\])/g);
  if (parts.length === 1) return escapeHtml(parts[0]);
  const fileRe = /^\[FILE:([^|\]]+)\|([^\]]+)\]$/;
  return parts.map(part => {
    const m = part.match(fileRe);
    if (m) {
      const url = m[1], name = m[2];
      const safeUrl = escapeHtml(url), safeName = escapeHtml(name);
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
      if (isImage) {
        const imgId = 'chat-img-' + Math.random().toString(36).slice(2, 8);
        return `<div style="margin-top:4px"><a href="${safeUrl}" target="_blank">` +
          `<span class="chat-img-skeleton" id="${imgId}-sk" style="display:inline-block;width:160px"></span>` +
          `<img src="${safeUrl}" id="${imgId}" style="max-width:100%;max-height:200px;border-radius:12px;border:1px solid #eee;display:none" ` +
          `onload="this.style.display='block';var sk=document.getElementById('${imgId}-sk');if(sk)sk.remove();" ` +
          `onerror="this.style.display='block';var sk=document.getElementById('${imgId}-sk');if(sk)sk.remove();">` +
          `</a><div style="font-size:11px;margin-top:4px;opacity:0.8">${safeName}</div></div>`;
      }
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${isSelf ? 'rgba(255,255,255,0.18)' : '#F3F4F6'};border-radius:10px;margin-top:4px"><span style="font-size:20px">📁</span><div style="flex:1;min-width:0;text-align:left"><div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${isSelf ? 'white' : 'var(--text)'}">${safeName}</div></div><a href="${safeUrl}" target="_blank" style="background:${isSelf ? 'white' : 'var(--blue)'};color:${isSelf ? 'var(--blue)' : 'white'};border:none;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;text-decoration:none">Unduh</a></div>`;
    }
    return escapeHtml(part);
  }).join('');
}

// Render avatar di dalam chat (emoji atau foto kecil)
function chatAvatarHtml(avatarStr, size = '100%') {
  if (avatarStr && (avatarStr.startsWith('data:') || avatarStr.startsWith('http'))) {
    return `<img src="${escapeHtml(avatarStr)}" style="width:${size};height:${size};border-radius:50%;object-fit:cover;vertical-align:middle;display:inline-block;flex-shrink:0">`;
  }
  return `<span>${escapeHtml(avatarStr || '🦁')}</span>`;
}

function appendChatMessage(p) {
  const box = document.getElementById('kelas-chat-messages');
  if (!box) return;
  const isSelf = p.pengirim?.id === currentUser?.id || p.pengirim_id === currentUser?.id;
  const isGuruUser = currentUser?.role === 'guru';
  const msgAgeMs = new Date() - new Date(p.created_at);
  const isRecent = msgAgeMs <= 5 * 60 * 1000;
  const canDelete = (isSelf && isRecent) || (isGuruUser && !isSelf);
  const canEditMsg = isSelf && isRecent;
  const pengirim = p.pengirim || { nama: 'Pengguna', avatar: '🦁', role: 'murid' };
  const waktu = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const isGuru = pengirim.role === 'guru';
  const msgId = p.id || '';
  const div = document.createElement('div');
  div.id = 'msg-' + msgId;
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isSelf ? 'flex-end' : 'flex-start'};gap:2px`;
  const actionBtns = msgId && (canEditMsg || canDelete) ? `
    <span style="display:inline-flex;gap:4px;opacity:0.6">
      ${canEditMsg ? `<button onclick="editPesanKelas('${msgId}')" title="Edit" style="background:none;border:none;cursor:pointer;font-size:11px;padding:2px 4px;border-radius:6px;color:inherit">✏️</button>` : ''}
      ${canDelete ? `<button onclick="hapusPesanKelas('${msgId}')" title="Hapus" style="background:none;border:none;cursor:pointer;font-size:11px;padding:2px 4px;border-radius:6px;color:inherit">🗑️</button>` : ''}
    </span>` : '';
  div.innerHTML = `
    ${!isSelf ? `<div style="font-size:11px;color:var(--muted);font-weight:700;padding:0 8px;display:flex;align-items:center;gap:4px">${chatAvatarHtml(pengirim.avatar, '18px')} ${escapeHtml(pengirim.nama)}${isGuru ? ' 👩‍🏫' : ''}</div>` : ''}
    <div id="msg-bubble-${msgId}" data-isi="${escapeHtml(p.isi)}" style="max-width:75%;padding:10px 14px;border-radius:${isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isSelf ? 'var(--orange)' : 'white'};color:${isSelf ? 'white' : 'var(--text)'};font-size:14px;font-weight:600;border:${isSelf ? 'none' : '1.5px solid #E8E8E8'};word-break:break-word">${formatChatContent(p.isi, isSelf)}</div>
    <div style="display:flex;align-items:center;gap:6px;padding:0 8px">
      <span style="font-size:10px;color:var(--muted)">${waktu}</span>
      ${actionBtns}
    </div>`;
  box.appendChild(div);
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#96;');
}

function scrollChatToBottom() {
  const box = document.getElementById('kelas-chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function editPesanKelas(msgId) {
  const bubble = document.getElementById('msg-bubble-' + msgId);
  if (!bubble || bubble.querySelector('textarea')) return;

  const originalHTML = bubble.innerHTML;
  const originalIsi = bubble.dataset.isi || '';
  const currentText = originalIsi || bubble.textContent.replace(/\s*[\u270F\uFE0F]+\s*$/, '').trim();

  // Simpan semua inline styles yang relevan agar bisa di-restore persis
  const origStyle = {
    padding:   bubble.style.padding,
    maxWidth:  bubble.style.maxWidth,
    minWidth:  bubble.style.minWidth,
    width:     bubble.style.width
  };

  function applyOrigStyle(html, isi) {
    bubble.innerHTML = html;
    bubble.dataset.isi = isi;
    bubble.style.padding  = origStyle.padding;
    bubble.style.maxWidth = origStyle.maxWidth;
    bubble.style.minWidth = origStyle.minWidth;
    bubble.style.width    = origStyle.width;
  }

  const restore = () => applyOrigStyle(originalHTML, originalIsi);

  // Mode edit: expand sedikit agar textarea nyaman, tapi JANGAN set width tetap
  bubble.style.padding  = '8px';
  bubble.style.maxWidth = '85%';
  bubble.style.minWidth = '180px';
  bubble.style.width    = 'auto';
  bubble.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.value = currentText;
  ta.style.cssText = 'width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:6px 8px;font-family:Nunito,sans-serif;font-size:14px;font-weight:600;resize:none;background:rgba(255,255,255,0.15);color:inherit;outline:none;display:block;overflow:hidden';

  // Auto-resize textarea sesuai isi
  const autoResize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.addEventListener('input', autoResize);
  setTimeout(autoResize, 0);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓ Simpan';
  saveBtn.style.cssText = 'background:rgba(255,255,255,0.9);color:var(--blue);border:none;border-radius:8px;padding:4px 14px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Batal';
  cancelBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:inherit;border:none;border-radius:8px;padding:4px 14px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  cancelBtn.onclick = restore;
  saveBtn.onclick = async () => {
    const newText = ta.value.trim();
    if (!newText) return;
    if (newText === currentText) { restore(); return; }
    saveBtn.disabled = true; saveBtn.textContent = '...';
    try {
      const data = await api('PUT', `/kelas/${kelasChatKelasId}/chat/${msgId}`, { isi: newText });
      if (data.success) {
        const newHTML = escapeHtml(newText) + ' <span style="font-size:11px;opacity:0.7">✏️</span>';
        applyOrigStyle(newHTML, newText);
        socket.emit('kelas:edit_pesan', { kelasId: kelasChatKelasId, msgId, isi: newText });
      } else { toast('Gagal mengedit pesan', 'error'); restore(); }
    } catch(e) { toast('Gagal mengedit pesan', 'error'); restore(); }
  };

  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  bubble.appendChild(ta); bubble.appendChild(btnRow);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}

async function hapusPesanKelas(msgId) {
  showConfirmHapusPesan(msgId);
}

async function _eksekusiHapusPesan(msgId) {
  closeModal('modal-hapus-pesan');
  try {
    const data = await api('DELETE', `/kelas/${kelasChatKelasId}/chat/${msgId}`);
    if (data.success) {
      const el = document.getElementById('msg-' + msgId);
      if (el) el.remove();
      socket.emit('kelas:hapus_pesan', { kelasId: kelasChatKelasId, msgId });
    }
  } catch(e) {
    toast('Gagal menghapus pesan', 'error');
  }
}

function showConfirmHapusPesan(msgId) {
  document.getElementById('btn-hapus-pesan-ok').onclick = () => _eksekusiHapusPesan(msgId);
  openModal('modal-hapus-pesan');
}

async function kirimPesanKelas() {
  const input = document.getElementById('kelas-chat-input');
  let isi = input.value.trim();

  if (pendingKelasAttachment) {
    const fileMessage = `[FILE:${pendingKelasAttachment.url}|${pendingKelasAttachment.name}]`;
    isi = isi ? `${isi}\n${fileMessage}` : fileMessage;
  }

  if (!isi || !kelasChatKelasId) return;
  input.value = '';
  clearChatFileAttachment('kelas');
  try {
    const data = await api('POST', `/kelas/${kelasChatKelasId}/chat`, { isi });
    if (data.success) {
      // Kirim via socket untuk real-time ke user lain (sertakan DB id agar hapus/edit sinkron)
      socket.emit('kelas:chat', {
        kelasId: kelasChatKelasId,
        id: data.data.id,
        isi,
        pengirim: { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar, role: currentUser.role }
      });
      // Tampilkan langsung di sisi pengirim
      appendChatMessage({ ...data.data, pengirim: currentUser });
      scrollChatToBottom();
    }
  } catch(e) {
    toast('Gagal mengirim pesan', 'error');
    input.value = isi;
  }
}

// Socket listeners untuk kelas
socket.on('kelas:online_list', (list) => {
  kelasOnlineUsers = list;
  if (currentKelasTab === 'murid' && currentKelas) {
    // Re-render list murid dengan status online terbaru
    api('GET', `/kelas/${currentKelas.id}`).then(data => {
      const muridList = data.data?.murid || [];
    const hasUnread = Object.keys(window._privateChatUnreadMap).length > 0;
    updateMuridTabBadge(hasUnread);
    renderMuridList(muridList);
    }).catch(() => {});
  }
});

socket.on('kelas:pesan_baru', (pesan) => {
  // Jangan duplikat pesan yang dikirim sendiri (sudah di-append oleh kirimPesanKelas)
  if (pesan.pengirim?.id === currentUser?.id) return;
  appendChatMessage(pesan);
  scrollChatToBottom();
  // Notifikasi jika tidak sedang di tab chat
  if (currentKelasTab !== 'chat') {
    classChatUnreadCount++;
    updateClassChatBadge();
  }
  // Per-class unread untuk dashboard card badge
  if (pesan.kelas_id) {
    chatUnreadPerKelas[pesan.kelas_id] = (chatUnreadPerKelas[pesan.kelas_id] || 0) + 1;
    // Hanya update badge card jika halaman murid sedang aktif
    if (document.getElementById('page-murid')?.classList.contains('active') ||
        !document.getElementById('page-kelas-detail')?.classList.contains('active')) {
      updateClassCardChatBadge(pesan.kelas_id);
    }
  }
  // Tambah ke bell notification
  addBellNotif({
    id: 'kelas_' + (pesan.id || Date.now()),
    tipe: 'kelas',
    judul: `${pesan.pengirim?.nama || 'Seseorang'} — ${currentKelas?.nama || 'Kelas'}`,
    pesan: pesan.isi || '',
    created_at: pesan.created_at || new Date().toISOString(),
    dibaca: false,
    kelas_id: pesan.kelas_id
  });
});

socket.on('kelas:pesan_diedit', ({ msgId, isi }) => {
  const bubble = document.getElementById('msg-bubble-' + msgId);
  if (!bubble) return;
  if (bubble.querySelector('textarea')) return; // jangan timpa textarea yang sedang terbuka
  bubble.dataset.isi = isi;
  bubble.innerHTML = escapeHtml(isi) + ' <span style="font-size:11px;opacity:0.7">✏️</span>';
});

socket.on('kelas:pesan_dihapus', ({ msgId }) => {
  const el = document.getElementById('msg-' + msgId);
  if (el) el.remove();
});

// ============================================================
//  VIDEO CALL — Daily.co (iframe embed, maks 64 peserta)
// ============================================================

let vcCurrentKelasId = null;

// ── Jitsi Meeting (External API — auto login nama akun) ───────
let vcJitsiApi    = null;
let vcCurrentRoomUrl = null;
let vcJitsiWindow = null; // referensi tab Jitsi yang dibuka

function vcGetRoomName(kelasId) {
  return 'kitabelajar-' + kelasId.replace(/-/g, '').slice(0, 16);
}

// ── Guru: mulai meeting ───────────────────────────────────────
function vcMulaiMeeting() {
  const kelasId = currentKelas?.id;
  if (!kelasId) return;
  const roomName = vcGetRoomName(kelasId);
  const roomUrl  = 'https://meet.ffmuc.net/' + roomName;
  vcCurrentKelasId = kelasId;
  vcStartJitsi(roomName);
  // Broadcast banner ke semua murid di kelas
  socket.emit('kelas:meeting_banner', { kelasId, roomUrl, nama: currentKelas?.nama || 'Kelas' });
  // Simpan ke localStorage agar overlay bisa di-restore setelah refresh
  localStorage.setItem('kb_meeting_' + kelasId, JSON.stringify({ roomUrl, ts: Date.now() }));
  // Ubah tombol sidebar → Akhiri Meeting
  const btn = document.getElementById('vc-meeting-btn');
  if (btn) {
    btn.textContent = '📵 Akhiri Meeting';
    btn.onclick = () => vcLeave();
    btn.style.background = 'var(--red)';
  }
}

// ── Murid: join meeting ───────────────────────────────────────
function vcJoinMeeting() {
  const kelasId = currentKelas?.id;
  if (!kelasId) { toast('Buka kelas dulu', 'error'); return; }
  const roomName = vcGetRoomName(kelasId);
  vcCurrentKelasId = kelasId;
  vcStartJitsi(roomName);
}

// ── Buka Jitsi di tab baru dengan nama akun yang login ────────
function vcStartJitsi(roomName) {
  const displayName = encodeURIComponent(
    (currentUser?.nama || 'Peserta') + (currentUser?.role === 'guru' ? ' 👩‍🏫' : '')
  );
  // Parameter #config & #userInfo dikirim lewat fragment URL — didukung meet.ffmuc.net dan Jitsi lainnya
  const url = `https://meet.ffmuc.net/${roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.defaultLanguage="id"`;
  vcJitsiWindow = window.open(url, '_blank');
  // Tampilkan panel info di halaman (bukan overlay)
  vcShowMeetingPanel(roomName);
}

// ── Tampilkan panel info meeting ──────────────────────────────
let vcMeetingTabUrl = null;

function vcShowMeetingPanel(roomName) {
  const url = 'https://meet.ffmuc.net/' + roomName;
  vcMeetingTabUrl = url;
  document.getElementById('vc-panel-title').textContent = '📹 ' + (currentKelas?.nama || 'Meeting Aktif');
  document.getElementById('vc-panel-url').textContent = url;
  document.getElementById('vc-overlay').classList.add('active');
}

// ── Buka ulang tab meeting ────────────────────────────────────
function vcReopenTab() {
  if (vcMeetingTabUrl) {
    const displayName = encodeURIComponent(
      (currentUser?.nama || 'Peserta') + (currentUser?.role === 'guru' ? ' 👩‍🏫' : '')
    );
    const url = vcMeetingTabUrl + `#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`;
    window.open(url, '_blank');
  }
}

// ── Salin & bagikan link ke chat kelas ───────────────────────
function vcShareLink() {
  const kelasId = vcCurrentKelasId || currentKelas?.id;
  if (!kelasId) return;
  const url = 'https://meet.ffmuc.net/' + vcGetRoomName(kelasId);

  // Copy clipboard — fallback ke select+copy jika API gagal
  function copyToClipboardFallback(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el);
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => copyToClipboardFallback(url));
  } else {
    copyToClipboardFallback(url);
  }
  toast('🔗 Link meeting disalin!', 'info');

  // Kirim ke chat kelas
  const chatKelasId = kelasChatKelasId || kelasId;
  api('POST', `/kelas/${chatKelasId}/chat`, {
    isi: `📹 Bergabung ke meeting kelas: ${url}`
  }).then(data => {
    if (data.success) {
      socket.emit('kelas:chat', {
        kelasId: chatKelasId,
        isi: `📹 Bergabung ke meeting kelas: ${url}`,
        pengirim: { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar, role: currentUser.role }
      });
      toast('✅ Link dikirim ke chat kelas!', 'info');
    } else {
      toast('🔗 Link disalin! (Chat gagal terkirim)', 'info');
    }
  }).catch(() => {
    toast('🔗 Link disalin! (Chat gagal terkirim)', 'info');
  });
}

function vcLeave() {
  const kelasId = vcCurrentKelasId || currentKelas?.id;
  if (kelasId) {
    // Broadcast ke semua (termasuk guru sendiri via io.to di server)
    socket.emit('kelas:meeting_ended', { kelasId });
    localStorage.removeItem('kb_meeting_' + kelasId);
  }
  // Tutup tab Jitsi jika masih buka
  if (vcJitsiWindow && !vcJitsiWindow.closed) {
    try { vcJitsiWindow.close(); } catch(e) {}
  }
  vcJitsiWindow = null;
  // UI cleanup langsung (tidak tunggu socket bounce-back)
  vcJitsiApi = null;
  vcMeetingTabUrl = null;
  vcCurrentKelasId = null;
  document.getElementById('vc-overlay').classList.remove('active');
  hideMeetingBanner();
  // Reset tombol sidebar guru
  const btn = document.getElementById('vc-meeting-btn');
  if (btn && currentUser?.role === 'guru') {
    btn.textContent = '📹 Mulai Meeting';
    btn.onclick = () => vcMulaiMeeting();
    btn.style.background = '';
  }
}

// ── Meeting Banner helpers ────────────────────────────────────
function showMeetingBanner(roomUrl) {
  const banner = document.getElementById('kelas-meeting-banner');
  if (!banner) return;
  const link = document.getElementById('kelas-meeting-banner-link');
  if (link && roomUrl) {
    const displayName = encodeURIComponent(currentUser?.nama || 'Peserta');
    link.href = `${roomUrl}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.defaultLanguage="id"`;
  }
  banner.style.display = 'block';
}

function hideMeetingBanner() {
  const banner = document.getElementById('kelas-meeting-banner');
  if (banner) banner.style.display = 'none';
}

// Murid terima banner meeting dari guru
socket.on('kelas:meeting_banner', ({ kelasId, roomUrl }) => {
  if (currentUser?.role !== 'murid') return;
  if (currentKelas?.id !== kelasId) return;
  // Simpan ke localStorage agar banner tetap muncul setelah refresh
  localStorage.setItem('kb_meeting_' + kelasId, JSON.stringify({ roomUrl, ts: Date.now() }));
  showMeetingBanner(roomUrl);
  // Tampilkan juga tombol join di sidebar
  const btn = document.getElementById('vc-meeting-btn');
  if (btn) { btn.style.display = 'flex'; btn.textContent = '📹 Gabung Meeting'; }
  toast('📹 Guru memulai meeting! Lihat banner di atas untuk bergabung.', 'info');
});

// Guru akhiri meeting → semua orang (termasuk guru) tutup overlay & banner
socket.on('kelas:meeting_ended', ({ kelasId }) => {
  // Cek apakah murid memang sedang/pernah ada di meeting SEBELUM dihapus
  const sedangDiMeeting = !!localStorage.getItem('kb_meeting_' + kelasId);
  // Selalu hapus localStorage, terlepas dari halaman yang sedang dibuka
  localStorage.removeItem('kb_meeting_' + kelasId);
  if (currentKelas?.id !== kelasId) return;

  const bannerAktif = document.getElementById('kelas-meeting-banner')?.style.display === 'block';
  hideMeetingBanner();

  // Tutup tab Jitsi jika masih terbuka
  if (vcJitsiWindow && !vcJitsiWindow.closed) {
    try { vcJitsiWindow.close(); } catch(e) {}
    vcJitsiWindow = null;
  }
  // Tutup vc-overlay untuk semua role
  const overlay = document.getElementById('vc-overlay');
  if (overlay && overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    vcCurrentKelasId = null;
    vcJitsiApi = null;
    vcMeetingTabUrl = null;
  }
  const btn = document.getElementById('vc-meeting-btn');
  if (btn) {
    if (currentUser?.role === 'murid') {
      btn.style.display = 'none';
    } else if (currentUser?.role === 'guru') {
      btn.textContent = '📹 Mulai Meeting';
      btn.onclick = () => vcMulaiMeeting();
      btn.style.background = '';
    }
  }
  // Tampilkan toast HANYA jika murid memang sedang ada di meeting (banner aktif atau localStorage ada)
  if (currentUser?.role !== 'guru' && (bannerAktif || sedangDiMeeting)) {
    toast('⏹️ Guru telah mengakhiri meeting.', 'info');
  }
});

// ============================================================
//  PRIVATE CHAT
// ============================================================
let privateChatTargetId = null;
let privateChatTargetNama = '';
let privateChatTargetAvatar = '';

// Bergabung ke channel private — dipanggil setelah login berhasil
function joinPrivateChannel() {
  if (currentUser?.id) socket.emit('private:join', { userId: currentUser.id });
}
// Jika socket reconnect (misal setelah internet terputus), join ulang
socket.on('connect', () => { joinPrivateChannel(); });

// ============================================================
//  PUSH NOTIFICATION — Service Worker + Browser Notifications
// ============================================================
let _swRegistration = null;
let _pushEnabled = false;

async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    _swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('[SW] Service worker terdaftar.');

    // Auto-deteksi SW baru: kalau ada versi baru terpasang,
    // tampilkan toast + reload otomatis setelah 3 detik
    _swRegistration.addEventListener('updatefound', () => {
      const newWorker = _swRegistration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Ada SW baru menunggu — paksa reload supaya aset lama tidak ke-cache
          console.log('[SW] Versi baru tersedia, reload...');
          if (typeof toast === 'function') {
            toast('Versi baru tersedia. Halaman akan diperbarui...', 'info');
          }
          setTimeout(() => location.reload(), 3000);
        }
      });
    });
  } catch(e) {
    console.warn('[SW] Gagal daftar service worker:', e.message);
  }
}

async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function subscribePush() {
  if (!currentUser) return;
  const granted = await requestPushPermission();
  if (!granted) return;
  if (!_swRegistration) return;

  try {
    // Gunakan VAPID public key dari server jika ada, fallback ke browser notification
    let sub = await _swRegistration.pushManager.getSubscription();
    if (!sub) {
      // Coba subscribe dengan dummy key jika VAPID tidak dikonfigurasi
      // Server akan abaikan jika tidak ada web-push
      try {
        const vapidPublicKey = await fetch('/api/push/vapid-key').then(r => r.json()).then(d => d.key).catch(() => null);
        if (vapidPublicKey) {
          const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
          sub = await _swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
        }
      } catch(e) {
        console.warn('[Push] Subscribe gagal:', e.message);
      }
    }

    if (sub) {
      const subData = sub.toJSON();
      await api('POST', '/push/subscribe', {
        endpoint: subData.endpoint,
        keys: subData.keys
      }).catch(() => {});
      _pushEnabled = true;
    }
  } catch(e) {
    console.warn('[Push] Error subscribe:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Tampilkan browser notification saat halaman di background
function showBrowserNotif(judul, pesan, tag, force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && !force) return;
  try {
    if (_swRegistration) {
      _swRegistration.showNotification(judul, {
        body: pesan,
        icon: '/assets/icon-192.png',
        tag: tag || 'kb-notif',
        vibrate: [200, 100, 200]
      });
    } else {
      new Notification(judul, { body: pesan });
    }
  } catch(e) {}
}

// Init SW saat halaman load
initServiceWorker();

let _notifPrivateChatData = null;
let _notifPrivateChatTimer = null;

socket.on('private:receive', (pesan) => {
  const modalOpen = document.getElementById('modal-private-chat')?.classList.contains('open');
  if (modalOpen && privateChatTargetId === pesan.dari_id) {
    // Modal sudah terbuka dengan pengirim ini — langsung tampilkan
    appendPrivateMessage(pesan, false);
    scrollPrivateChatToBottom();
  } else {
    // Simpan data untuk tombol "Balas"
    _notifPrivateChatData = pesan;
    tampilkanNotifPrivateChat(pesan);

    // Tampilkan badge di UI jika ada
    const badge = document.getElementById('pc-unread-badge-' + pesan.dari_id) || document.getElementById('pc-unread-badge-guru');
    if (badge) badge.style.display = 'flex';
    if (currentUser?.role === 'guru') {
      updateMuridTabBadge(true);
    }
  }
  // Selalu tambah ke bell notification (private = prioritas tinggi)
  addBellNotif({
    id: 'priv_' + (pesan.id || Date.now()),
    tipe: 'private',
    judul: pesan.pengirim_nama || 'Pesan Privat',
    pesan: pesan.isi || '',
    created_at: new Date().toISOString(),
    dibaca: false,
    dari_id: pesan.dari_id,
    pengirim_nama: pesan.pengirim_nama,
    pengirim_avatar: pesan.pengirim_avatar
  });
  // Tampilkan browser notification jika chat dengan pengirim ini tidak sedang terbuka
  const isTargetChatOpen = modalOpen && privateChatTargetId === pesan.dari_id;
  showBrowserNotif(
    `💬 Pesan dari ${pesan.pengirim_nama || 'Seseorang'}`,
    pesan.isi || 'Pesan baru',
    'private-' + pesan.dari_id,
    !isTargetChatOpen
  );
});

function tampilkanNotifPrivateChat(pesan) {
  const nama = pesan.pengirim_nama || 'Seseorang';
  const ava  = pesan.pengirim_avatar || '🦁';
  const isi  = pesan.isi || '';

  setAvatarEl(document.getElementById('notif-pc-avatar'), ava, 'big');
  document.getElementById('notif-pc-nama').textContent   = nama;
  document.getElementById('notif-pc-isi').textContent    = isi.length > 50 ? isi.substring(0, 50) + '…' : isi;

  const el = document.getElementById('notif-private-chat');
  el.style.display = 'flex';

  // Auto-hilang setelah 6 detik
  if (_notifPrivateChatTimer) clearTimeout(_notifPrivateChatTimer);
  _notifPrivateChatTimer = setTimeout(tutupNotifPrivateChat, 6000);
}

function tutupNotifPrivateChat() {
  document.getElementById('notif-private-chat').style.display = 'none';
  if (_notifPrivateChatTimer) clearTimeout(_notifPrivateChatTimer);
}

function bukaNotifPrivateChat() {
  tutupNotifPrivateChat();
  if (!_notifPrivateChatData) return;
  const p = _notifPrivateChatData;
  bukaPrivateChat(
    p.dari_id,
    p.pengirim_nama || 'Seseorang',
    p.pengirim_avatar || '🦁'
  );
}

// ============================================================
//  UBAH BANNER KELAS (GURU)
// ============================================================
const BANNER_PRESETS = [
  { kelas: 'bg-c1', label: 'Biru', color: '#4D96FF' },
  { kelas: 'bg-c2', label: 'Hijau', color: '#6BCB77' },
  { kelas: 'bg-c3', label: 'Ungu', color: '#7B2FF7' },
  { kelas: 'bg-c4', label: 'Orange', color: '#FF6B35' },
  { kelas: 'bg-c5', label: 'Merah', color: '#D12B00' },
  { kelas: 'bg-c6', label: 'Tosca', color: '#00C8B0' },
  { kelas: 'bg-c7', label: 'Coklat', color: '#A0522D' },
  { kelas: 'bg-c8', label: 'Abu', color: '#5E6D7A' },
];

let _bannerSelectedClass = null;
let _bannerUploadDataUrl = null;

function bukaUbahBanner() {
  _bannerSelectedClass = null;
  _bannerUploadDataUrl = null;
  // Render preset warna
  const container = document.getElementById('banner-color-presets');
  if (container) {
    container.innerHTML = BANNER_PRESETS.map(p => `
      <div onclick="pilihBannerPreset('${p.kelas}',this)"
        style="width:52px;height:52px;border-radius:12px;background:${p.color};cursor:pointer;
          border:3px solid transparent;transition:all 0.15s;flex-shrink:0"
        title="${p.label}"></div>`).join('');
  }
  const preview = document.getElementById('banner-preview');
  if (preview) preview.style.display = 'none';
  openModal('modal-ubah-banner');
}

function pilihBannerPreset(bgClass, el) {
  _bannerSelectedClass = bgClass;
  _bannerUploadDataUrl = null;
  // Highlight pilihan
  document.querySelectorAll('#banner-color-presets div').forEach(d => d.style.border = '3px solid transparent');
  el.style.border = '3px solid var(--text)';
  const preview = document.getElementById('banner-preview');
  if (preview) preview.style.display = 'none';
}

function previewBannerUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Gambar terlalu besar (maks 2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    _bannerUploadDataUrl = e.target.result;
    _bannerSelectedClass = null;
    document.querySelectorAll('#banner-color-presets div').forEach(d => d.style.border = '3px solid transparent');
    const preview = document.getElementById('banner-preview');
    const img = document.getElementById('banner-preview-img');
    if (preview && img) { img.src = _bannerUploadDataUrl; preview.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}

async function simpanBannerKelas() {
  if (!currentKelas) return;
  if (_bannerUploadDataUrl) {
    // Upload gambar ke server
    showLoading(true, 'Mengupload banner...');
    try {
      const blob = await fetch(_bannerUploadDataUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('banner', blob, 'banner.jpg');
      formData.append('kelas_id', currentKelas.id);
      const token = localStorage.getItem('kb_token') || '';
      const res = await fetch('/api/kelas/' + currentKelas.id + '/banner', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });
      const json = await res.json();
      if (json.success && json.banner_url) {
        const bg = document.getElementById('kelas-banner-bg');
        if (bg) {
          bg.style.backgroundImage = `url('${json.banner_url}')`;
          bg.style.backgroundSize = 'cover';
          bg.style.backgroundPosition = 'center';
        }
        toast('Banner diperbarui! 🎨', 'success');
      } else {
        toast(json.pesan || 'Gagal upload banner', 'error');
      }
    } catch(e) {
      toast('Tidak bisa mengupload banner', 'error');
    }
    showLoading(false);
  } else if (_bannerSelectedClass) {
    // Simpan preferensi warna lokal (tidak perlu server call — color class sudah ada)
    const bg = document.getElementById('kelas-banner-bg');
    if (bg) {
      KELAS_COLORS.forEach(c => bg.classList.remove(c));
      bg.classList.add(_bannerSelectedClass);
      bg.style.backgroundImage = '';
    }
    // Update currentKelas state agar konsisten jika halaman di-refresh
    if (currentKelas) currentKelas._bannerClass = _bannerSelectedClass;
    toast('Warna banner diperbarui! 🎨', 'success');
  } else {
    toast('Pilih warna atau upload gambar dulu!', 'error');
    return;
  }
  closeModal('modal-ubah-banner');
}