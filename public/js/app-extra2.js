let _elogFilter = 'semua';

async function bukaErrorLog() {
  if (currentUser?.role !== 'guru') return;
  showPage('page-error-log');
  loadErrorLog('semua');
}

async function loadErrorLog(filter) {
  _elogFilter = filter;
  // Update tab style
  ['semua','frontend','backend'].forEach(f => {
    const btn = document.getElementById('elog-tab-' + f);
    if (!btn) return;
    if (f === filter) {
      btn.style.background = 'var(--red)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--red)';
    } else {
      btn.style.background = 'white'; btn.style.color = 'var(--text)'; btn.style.borderColor = '#eee';
    }
  });

  const el = document.getElementById('error-log-list');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Memuat...</div>';
  try {
    const data = await api('GET', '/error-logs');
    if (!data.success) { el.innerHTML = '<div style="padding:24px;color:var(--muted)">Gagal memuat log.</div>'; return; }

    let logs = data.data || [];
    if (filter !== 'semua') logs = logs.filter(l => l.sumber === filter);

    if (logs.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">🎉 Tidak ada error!</div>';
      return;
    }

    el.innerHTML = logs.map(l => {
      const eSumber = escapeHtml(l.sumber || 'frontend');
      const ePesan  = escapeHtml(l.pesan || '–');
      const eUrl    = l.url ? escapeHtml(l.url) : '';
      const eMethod = l.method ? escapeHtml(l.method) : '';
      const eStack  = l.stack ? escapeHtml(l.stack) : '';
      const color   = eSumber === 'backend' ? 'var(--red)' : 'var(--orange)';
      return `<div style="background:white;border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:var(--shadow);border-left:4px solid ${color}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <span style="background:${color};color:white;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:800">${eSumber.toUpperCase()}</span>
          <span style="font-size:12px;color:var(--muted)">${l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '–'}</span>
        </div>
        <div style="font-weight:800;font-size:14px;margin-bottom:6px;word-break:break-word">${ePesan}</div>
        ${eUrl ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">📍 ${eUrl}${eMethod ? ' [' + eMethod + ']' : ''}</div>` : ''}
        ${eStack ? `<details style="margin-top:8px"><summary style="font-size:12px;color:var(--blue);cursor:pointer;font-weight:700">Stack trace</summary><pre style="font-size:11px;background:#f8f8f8;padding:10px;border-radius:8px;overflow-x:auto;margin-top:6px;white-space:pre-wrap;word-break:break-all">${eStack}</pre></details>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="padding:24px;color:var(--red)">Gagal memuat error log.</div>';
  }
}

// ===== GURU AI CHATBOT =====
let guruChatOpen = false;
let guruChatHistory = [];

const GURU_SYSTEM_PROMPT = `Kamu adalah asisten AI khusus untuk guru Indonesia bernama "Asisten Guru". Tugasmu membantu guru dalam:
- Merangkum artikel dari link/URL yang diberikan guru
- Mencari artikel dan referensi untuk bahan ajar
- Merekomendasikan video YouTube edukatif (sertakan link YouTube jika tahu)
- Memberikan ide soal, kuis, dan aktivitas pembelajaran kreatif
- Membantu membuat RPP, silabus, dan rencana pembelajaran
- Memberikan tips motivasi siswa dan manajemen kelas
- Menjelaskan konsep materi pelajaran dengan cara yang mudah diajarkan
Gunakan bahasa Indonesia yang ramah dan profesional.
PENTING: Kamu BOLEH dan HARUS memberikan URL/link nyata jika relevan (Wikipedia, Kemdikbud, YouTube, dll). Format link sebagai [teks](https://url). Jika diminta carikan artikel tapi tidak ada hasil pencarian yang diberikan, rekomendasikan sumber tepercaya seperti Wikipedia, Kemdikbud.go.id, atau Google Scholar dengan link lengkap.
FORMAT MATEMATIKA: Untuk ekspresi matematika, SELALU gunakan notasi LaTeX dengan tanda dolar. Contoh: $f(x) = 3x^4 - 2x^3 + 5x - 1$ untuk inline, atau $$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$ untuk display. Jangan tulis rumus matematika dalam teks biasa tanpa tanda dolar.
PENTING: Selalu selesaikan jawaban hingga tuntas. Jangan berhenti di tengah kalimat, di tengah perhitungan, atau di tengah penjelasan. Jika jawabannya panjang, tetap lanjutkan sampai benar-benar selesai.`;

function guruChatSetVisible(show) {
  const fab = document.getElementById('guru-chat-fab');
  if (!fab) return;
  fab.style.display = show ? 'flex' : 'none';
  if (!show && guruChatOpen) {
    guruChatOpen = false;
    const panel = document.getElementById('guru-chatbot-panel');
    if (panel) panel.style.display = 'none';
  }
}

function toggleGuruChat() {
  const panel = document.getElementById('guru-chatbot-panel');
  guruChatOpen = !guruChatOpen;
  if (guruChatOpen) {
    panel.style.display = 'flex';
    panel.style.pointerEvents = 'all';
    // animate open
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.85) translateY(20px)';
    requestAnimationFrame(() => {
      panel.style.transition = 'opacity .22s ease, transform .22s cubic-bezier(.34,1.56,.64,1)';
      panel.style.opacity = '1';
      panel.style.transform = 'scale(1) translateY(0)';
    });
    setTimeout(() => document.getElementById('gchat-input').focus(), 250);
  } else {
    panel.style.pointerEvents = 'none';
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.85) translateY(20px)';
    setTimeout(() => { panel.style.display = 'none'; }, 200);
  }
}

// Panggil dari loadGuruDashboard dan showPage
function onGuruPageShown() { guruChatSetVisible(true); }
function onGuruPageHidden() { guruChatSetVisible(false); }

function guruChatChip(text) {
  document.getElementById('gchat-input').value = text;
  kirimGuruChat();
}

// ── File attachment ──
let guruChatFile = null; // { type: 'pdf'|'image', name, content (text or base64), mime }

async function guruChatPilihFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) { toast('File terlalu besar! Maks 15MB', 'error'); return; }

  const previewEl = document.getElementById('gchat-file-preview');
  previewEl.innerHTML = '<span style="font-size:12px;color:#9CA3AF">Memuat file...</span>';
  previewEl.style.display = 'flex';

  try {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const teks = await bacaPDF(file);
      guruChatFile = { type: 'pdf', name: file.name, content: teks };
    } else if (file.type.startsWith('image/')) {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      guruChatFile = { type: 'image', name: file.name, content: b64, mime: file.type };
    } else {
      toast('Format tidak didukung. Gunakan PDF atau gambar.', 'error');
      previewEl.style.display = 'none';
      return;
    }
    const icon = guruChatFile.type === 'pdf' ? '📄' : '🖼️';
    previewEl.innerHTML = `<div class="gchat-file-chip">${icon} <span>${file.name}</span><button onclick="guruChatHapusFile()" title="Hapus">✕</button></div>`;
  } catch(e) {
    toast('Gagal memuat file: ' + e.message, 'error');
    previewEl.style.display = 'none';
    guruChatFile = null;
  }
  input.value = '';
}

function guruChatHapusFile() {
  guruChatFile = null;
  const el = document.getElementById('gchat-file-preview');
  el.style.display = 'none';
  el.innerHTML = '';
}

function gchatAddMsg(role, html) {
  const wrap = document.getElementById('gchat-messages');
  const div = document.createElement('div');
  div.className = `gchat-msg ${role}`;
  if (role === 'bot') {
    div.innerHTML = `<div class="gchat-avatar"><img src="/assets/robot-icon.svg" style="width:28px;height:28px"></div><div class="gchat-bubble">${html}</div>`;
  } else {
    div.innerHTML = `<div class="gchat-bubble">${html}</div>`;
  }
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  // Render span.gchat-math-pending yang disisipkan saat KaTeX belum siap
  _gchatRenderPendingMath(div);
  return div;
}

function gchatShowTyping() {
  const wrap = document.getElementById('gchat-messages');
  const div = document.createElement('div');
  div.className = 'gchat-msg bot';
  div.id = 'gchat-typing-indicator';
  div.innerHTML = `<div class="gchat-avatar">🤖</div><div class="gchat-typing"><span></span><span></span><span></span></div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function gchatHideTyping() {
  const el = document.getElementById('gchat-typing-indicator');
  if (el) el.remove();
}

// Render semua span.gchat-math-pending yang belum dirender
function _gchatRenderPendingMath(root) {
  if (!window.katex) return;
  const spans = (root || document).querySelectorAll('.gchat-math-pending');
  spans.forEach(span => {
    try {
      const expr = decodeURIComponent(span.dataset.expr || '');
      const display = span.dataset.display === '1';
      const wrapper = document.createElement(display ? 'div' : 'span');
      wrapper.innerHTML = katex.renderToString(expr, { displayMode: display, throwOnError: false });
      span.replaceWith(wrapper);
    } catch(e) {
      span.textContent = span.dataset.display === '1'
        ? `[${decodeURIComponent(span.dataset.expr||'')}]`
        : decodeURIComponent(span.dataset.expr||'');
      span.classList.remove('gchat-math-pending');
    }
  });
}
// Dipanggil oleh onload KaTeX — render semua yang pending di seluruh chat
window._gchatRenderPending = () => _gchatRenderPendingMath(document);

function gchatFormatReply(reply) {
  // 1) Ekstrak blok math SEBELUM formatting agar \n→<br> tidak memecah multiline math
  const mathBlocks = [];
  let processed = reply
    // Display math $$...$$ (multiline)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      const idx = mathBlocks.length;
      mathBlocks.push({ expr: expr.trim(), display: true });
      return `%%MATH_${idx}%%`;
    })
    // Inline math $...$ (satu baris)
    .replace(/\$([^$\n]+?)\$/g, (_, expr) => {
      const idx = mathBlocks.length;
      mathBlocks.push({ expr: expr.trim(), display: false });
      return `%%MATH_${idx}%%`;
    });

  // 2) Pisahkan markdown link ke placeholder
  const links = [];
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const idx = links.length;
    links.push({ label, url });
    return `%%LINK_${idx}%%`;
  });

  // 3) Escape HTML
  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 4) Kembalikan link
  processed = processed.replace(/%%LINK_(\d+)%%/g, (_, i) => {
    const { label, url } = links[parseInt(i)];
    const safeUrl = url.replace(/"/g, '%22');
    const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#7b2ff7;font-weight:700;text-decoration:underline">${safeLabel}</a>`;
  });

  // 5) URL mentah → link
  processed = processed.replace(/(^|[\s\n(])((https?:\/\/)[^\s<>"&]+)/g, (_, pre, url) => {
    const safeUrl = url.replace(/"/g, '%22');
    return `${pre}<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#7b2ff7;font-weight:700;word-break:break-all;text-decoration:underline">${url}</a>`;
  });

  // 6) Format markdown dasar + newline
  processed = processed
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\n)\* /g, '$1• ')
    .replace(/(^|\n)- /g, '$1• ')
    .replace(/\*(\S[^*]*?\S|\S)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  // 7) Kembalikan blok math
  processed = processed.replace(/(<br>)*%%MATH_(\d+)%%(<br>)*/g, (_, pre, i, post) => {
    const { expr, display } = mathBlocks[parseInt(i)];
    // Jika KaTeX sudah siap, render langsung
    if (window.katex) {
      try {
        const rendered = katex.renderToString(expr, { displayMode: display, throwOnError: false });
        return display ? `${pre || '<br>'}${rendered}${post || '<br>'}` : rendered;
      } catch(e) {}
    }
    // KaTeX belum siap → span pending, akan dirender oleh _gchatRenderPending
    const safeExpr = encodeURIComponent(expr);
    if (display) {
      return `${pre || '<br>'}<span class="gchat-math-pending" data-expr="${safeExpr}" data-display="1"></span>${post || '<br>'}`;
    }
    return `<span class="gchat-math-pending" data-expr="${safeExpr}" data-display="0"></span>`;
  });

  return processed;
}

// Deteksi URL di teks (https://...)
function gchatExtractUrl(text) {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

// Deteksi intent pencarian artikel/web + pertanyaan butuh data realtime
function gchatIsSearchIntent(text) {
  // Permintaan eksplisit mencari sumber/artikel/video
  const cariEksplisit = /carikan|cari(?:kan)?\s+artikel|cari(?:kan)?\s+referensi|cari(?:kan)?\s+sumber|cari(?:kan)?\s+video|tolong cari|cariin|search(kan)?|temukan artikel|cari materi/i.test(text);
  // Pertanyaan yang butuh data terbaru/realtime → ambil dari web (SearXNG)
  const butuhRealtime = /\b(terbaru|terkini|hari ini|saat ini|sekarang|update|berita|kabar|harga|kurs|jadwal|terupdate|terakhir|viral|tren(?:ding)?|202[4-9]|203\d)\b/i.test(text);
  return cariEksplisit || butuhRealtime;
}

// Fetch konten artikel via proxy
async function gchatFetchArtikel(url) {
  const res = await fetch(`${API}/proxy/fetch?url=${encodeURIComponent(url)}`, {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('kb_token') }
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.pesan || 'Gagal mengambil artikel');
  return data.teks || '';
}

// Cari artikel via backend (DuckDuckGo)
async function gchatSearchWeb(query) {
  const res = await fetch(`${API}/ai/search?q=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('kb_token') }
  });
  const data = await res.json();
  return data.results || [];
}

async function kirimGuruChat() {
  const input = document.getElementById('gchat-input');
  const text = input.value.trim();
  const fileSnap = guruChatFile;
  if (!text && !fileSnap) return;
  input.value = '';

  // Tampilkan pesan user
  const userLabel = fileSnap
    ? `${fileSnap.type === 'pdf' ? '📄' : '🖼️'} <em style="font-size:12px;opacity:.8">${fileSnap.name}</em>${text ? '<br>' + text.replace(/</g,'&lt;') : ''}`
    : text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  gchatAddMsg('user', userLabel);

  if (fileSnap) guruChatHapusFile();
  gchatShowTyping();

  try {
    let reply;

    if (fileSnap && fileSnap.type === 'image') {
      // ── Gambar: pakai vision model ──
      const userMsg = text || 'Tolong analisis dan deskripsikan gambar ini. Jika berupa desain atau infografis, berikan rekomendasi perbaikan.';
      const visionRes = await fetch('/api/ai/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || localStorage.getItem('kb_token') || '') },
        body: JSON.stringify({
          max_tokens: 2048,
          messages: [
            { role: 'system', content: GURU_SYSTEM_PROMPT },
            { role: 'user', content: [
              { type: 'text', text: userMsg },
              { type: 'image_url', image_url: { url: fileSnap.content } }
            ]}
          ]
        })
      });
      const vData = await visionRes.json();
      reply = vData?.data?.choices?.[0]?.message?.content || 'Maaf, tidak bisa menganalisis gambar.';
      guruChatHistory.push({ role: 'user', content: userMsg });
      guruChatHistory.push({ role: 'assistant', content: reply });

    } else {
      // ── Teks / PDF / URL / Search ──
      let userContent = text || 'Tolong rangkum isi dokumen ini.';
      let extraContext = '';

      // 1) Jika ada file PDF
      if (fileSnap && fileSnap.type === 'pdf') {
        const maxChar = 6000;
        const potongan = fileSnap.content.length > maxChar ? fileSnap.content.slice(0, maxChar) + '\n...(terpotong)' : fileSnap.content;
        extraContext = `[File PDF: ${fileSnap.name}]\n\n${potongan}\n\n---\n`;
      }

      // 2) Jika pesan mengandung URL → fetch kontennya dulu
      const urlDalamPesan = gchatExtractUrl(text);
      if (urlDalamPesan && !fileSnap) {
        gchatUpdateTypingLabel('Mengambil konten dari URL...');
        try {
          const kontenArtikel = await gchatFetchArtikel(urlDalamPesan);
          if (kontenArtikel) {
            const potongan = kontenArtikel.length > 6000 ? kontenArtikel.slice(0, 6000) + '\n...(terpotong)' : kontenArtikel;
            extraContext = `[Konten dari URL: ${urlDalamPesan}]\n\n${potongan}\n\n---\n`;
            userContent = text.replace(urlDalamPesan, '').trim() || 'Tolong rangkum artikel ini dan berikan poin-poin pentingnya.';
          }
        } catch(e) {
          extraContext = `[Catatan: Gagal mengambil konten dari ${urlDalamPesan}. Jawab berdasarkan pengetahuanmu saja.]\n\n`;
        }
      }

      // 3) Jika intent pencarian artikel → search web dulu
      else if (gchatIsSearchIntent(text) && !fileSnap) {
        gchatUpdateTypingLabel('Mencari di web...');
        try {
          const hasilCari = await gchatSearchWeb(text);
          if (hasilCari.length > 0) {
            const ringkasanHasil = hasilCari.map((r, i) =>
              `${i+1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`
            ).join('\n\n');
            extraContext = `[Hasil pencarian web untuk: "${text}"]\n\n${ringkasanHasil}\n\n---\nBerdasarkan hasil pencarian di atas, jawab pertanyaan guru. Sertakan link asli dari hasil pencarian dalam jawabanmu.\n\n`;
            userContent = text;
          }
        } catch(e) {
          // Lanjut tanpa search result, AI jawab dari pengetahuan sendiri
        }
      }

      const finalContent = extraContext + userContent;
      guruChatHistory.push({ role: 'user', content: finalContent });

      const messages = [
        { role: 'system', content: GURU_SYSTEM_PROMPT },
        ...guruChatHistory.slice(-10)
      ];
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('kb_token') },
        body: JSON.stringify({ messages, max_tokens: 4096, model: 'openai/gpt-oss-120b' })
      });
      const data = await res.json();
      reply = data?.data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.content || data?.message || 'Maaf, saya tidak bisa merespons saat ini.';
      guruChatHistory.push({ role: 'assistant', content: reply });
    }

    gchatHideTyping();
    gchatAddMsg('bot', gchatFormatReply(reply));
  } catch(e) {
    gchatHideTyping();
    gchatAddMsg('bot', '❌ Gagal terhubung ke AI. Coba lagi sebentar.');
  }
}

// Update label di typing indicator sementara proses berlangsung
function gchatUpdateTypingLabel(label) {
  const el = document.querySelector('.gchat-typing');
  if (el) el.title = label;
}
