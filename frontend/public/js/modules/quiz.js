// ============================================================
//  QUIZ GAME
// ============================================================
let questions = [];
let qIdx = 0, score = 0, correctCount = 0, timer, timeLeft = 15, answered = false;
let quizStartTime = null;
let currentQuizId = null;

// ============================================================
//  QUIZ KILAT — DUOLINGO STYLE
// ============================================================
let qkKategori      = [];   // list kategori (per kelas/mapel)
let qkActiveKategori = null; // kategori yang sedang dimainkan
let qkStages        = [];   // stages per kategori
let qkActiveStage   = 0;    // stage index yang sedang dimainkan
let qkLives         = 3;    // nyawa tersisa
let qkStageProgress = {};   // { kategoriId_stageIdx: 'done'|'locked' }

const QK_STAGES_PER_KATEGORI = 5;
const QK_SOAL_PER_STAGE = 6;
const QK_STAGE_ICONS = ['🌱','⭐','🔥','💎','👑'];
const QK_STAGE_NAMES = ['Pemula','Dasar','Menengah','Mahir','Master'];
const QK_STAGE_XP    = [30, 50, 80, 120, 200];
const QK_STAGE_COLORS= ['#6BCB77','#4D96FF','#FF6B35','#C77DFF','#FFB99B'];

// ── Load halaman kategori ──────────────────────────────────
async function startQuiz() {
  showPage('page-quiz-map');
  await loadQuizKilatMap();
}

async function loadQuizKilatMap() {
  // Update streak & XP
  document.getElementById('qk-streak').textContent   = currentUser?.level || 1;
  document.getElementById('qk-xp-total').textContent = currentUser?.xp || 0;

  const wrap = document.getElementById('qk-kategori-wrap');
  wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)"><div style="font-size:40px">⏳</div><p style="font-weight:700;margin-top:8px">Memuat kategori...</p></div>';

  try {
    // Ambil semua kelas murid
    const kelasData = await api('GET', '/kelas');
    const kelasList = kelasData.kelas || kelasData.data || [];

    if (kelasList.length === 0) {
      wrap.innerHTML = `<div style="text-align:center;padding:40px">
        <div style="font-size:56px;margin-bottom:12px">🏫</div>
        <p style="font-weight:800;font-size:16px;margin-bottom:8px">Belum ada kelas!</p>
        <p style="color:var(--muted);font-size:14px">Gabung ke kelas dulu untuk mulai Quiz Kilat.</p>
        <button onclick="openModal('modal-join-kelas');showPage('page-murid')" style="margin-top:16px;background:var(--orange);color:white;border:none;padding:12px 24px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer">+ Gabung Kelas</button>
      </div>`;
      return;
    }

    // Ambil materi per kelas → buat kategori
    qkKategori = [];
    for (const kelas of kelasList) {
      const mapel = kelas.mapel || kelas.nama;
      const id    = `${kelas.id}_${mapel}`;
      // Cek apakah sudah ada kategori untuk mapel ini
      const exists = qkKategori.find(k => k.mapel === mapel);
      if (!exists) {
        qkKategori.push({
          id, mapel, kelasNama: kelas.nama, kelasId: kelas.id,
          emoji: getMapelEmoji(mapel),
          color: getMapelColor(mapel),
        });
      }
    }

    // Render kategori cards
    wrap.innerHTML = `
      <div style="margin-bottom:20px">
        <div style="font-family:'Fredoka One',cursive;font-size:15px;color:#888;letter-spacing:.5px;margin-bottom:16px;display:flex;align-items:center;gap:6px">
          📖 KELASMU <span style="background:linear-gradient(135deg,#FF6B35,#FF0080);color:white;border-radius:50px;padding:2px 10px;font-size:12px">${qkKategori.length} Kategori</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${qkKategori.map((k, i) => {
            const stagesDone = getStagesDone(k.id);
            const pct = Math.round(stagesDone / QK_STAGES_PER_KATEGORI * 100);
            const xpEarned = QK_STAGE_XP.slice(0,stagesDone).reduce((a,b)=>a+b,0);
            const stageLabel = stagesDone === QK_STAGES_PER_KATEGORI ? '🏆 Selesai!' : stagesDone === 0 ? '🚀 Mulai sekarang!' : `Stage ${stagesDone+1}: ${QK_STAGE_NAMES[stagesDone]}`;
            return `
            <div onclick="bukaStageMap('${k.id}')"
              style="background:linear-gradient(135deg,${k.color}18,${k.color}08);border-radius:24px;box-shadow:0 6px 24px rgba(0,0,0,0.09);padding:20px;cursor:pointer;transition:all 0.25s;border:2px solid ${k.color}30;position:relative;overflow:hidden"
              onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 36px rgba(0,0,0,0.14)';this.style.borderColor='${k.color}80'"
              onmouseout="this.style.transform='';this.style.boxShadow='0 6px 24px rgba(0,0,0,0.09)';this.style.borderColor='${k.color}30'">
              <!-- Decorative circle -->
              <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:${k.color}15;pointer-events:none"></div>
              <div style="display:flex;align-items:center;gap:16px">
                <div style="width:64px;height:64px;border-radius:20px;background:linear-gradient(145deg,${k.color},${k.color}aa);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;box-shadow:0 6px 18px ${k.color}50">
                  ${k.emoji}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-family:'Fredoka One',cursive;font-size:18px;color:#1a1a2e;margin-bottom:2px">${k.mapel}</div>
                  <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:700">📍 ${k.kelasNama}</div>
                  <div style="background:rgba(0,0,0,0.08);border-radius:50px;height:8px;overflow:hidden;margin-bottom:5px">
                    <div style="background:linear-gradient(90deg,${k.color},${k.color}cc);height:100%;border-radius:50px;width:${pct}%;transition:width 0.6s;box-shadow:0 0 6px ${k.color}60"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:11px;color:${k.color};font-weight:800">${stageLabel}</span>
                    <span style="font-size:11px;background:${k.color}20;color:${k.color};border-radius:50px;padding:2px 8px;font-weight:800">⭐ ${xpEarned} XP</span>
                  </div>
                </div>
                <div style="font-size:24px;color:${k.color};font-weight:900">›</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } catch(e) {
    wrap.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted)"><p>Gagal memuat kategori 😢</p></div>`;
  }
}

function getMapelEmoji(mapel) {
  const m = (mapel || '').toLowerCase();
  if (m.includes('math') || m.includes('matematika')) return '🔢';
  if (m.includes('bahasa') && m.includes('indo')) return '📖';
  if (m.includes('bahasa') && m.includes('ing')) return '🌏';
  if (m.includes('ipa') || m.includes('sains')) return '🔬';
  if (m.includes('ips')) return '🗺️';
  if (m.includes('musik') || m.includes('sbd') || m.includes('seni')) return '🎵';
  if (m.includes('olahraga') || m.includes('pjok')) return '⚽';
  if (m.includes('pkn') || m.includes('ppkn')) return '🏛️';
  if (m.includes('agama')) return '🕌';
  if (m.includes('tik') || m.includes('komputer')) return '💻';
  if (m.includes('sejarah')) return '📜';
  if (m.includes('geografi')) return '🌍';
  if (m.includes('biologi')) return '🌿';
  if (m.includes('fisika')) return '⚡';
  if (m.includes('kimia')) return '🧪';
  return '📚';
}

function getMapelColor(mapel) {
  const m = (mapel || '').toLowerCase();
  if (m.includes('math') || m.includes('matematika')) return '#4D96FF';
  if (m.includes('bahasa') && m.includes('indo')) return '#FF6B35';
  if (m.includes('ipa') || m.includes('sains')) return '#6BCB77';
  if (m.includes('musik') || m.includes('sbd') || m.includes('seni')) return '#FF6B9D';
  if (m.includes('olahraga')) return '#FF6B35';
  if (m.includes('ips')) return '#FFB99B';
  if (m.includes('tik')) return '#4D96FF';
  return '#C77DFF';
}

function getStagesDone(kategoriId) {
  let done = 0;
  for (let i = 0; i < QK_STAGES_PER_KATEGORI; i++) {
    if (qkStageProgress[`${kategoriId}_${i}`] === 'done') done++;
  }
  return done;
}

// ── Buka stage map per kategori ────────────────────────────
function bukaStageMap(kategoriId) {
  qkActiveKategori = qkKategori.find(k => k.id === kategoriId);
  if (!qkActiveKategori) return;

  document.getElementById('qk-stage-title').textContent = `${qkActiveKategori.emoji} ${qkActiveKategori.mapel}`;
  const stagesDone = getStagesDone(kategoriId);
  const totalXP = QK_STAGE_XP.slice(0, stagesDone).reduce((a,b)=>a+b, 0);
  document.getElementById('qk-stage-progress-label').textContent = `${stagesDone} / ${QK_STAGES_PER_KATEGORI} stage selesai`;
  document.getElementById('qk-stage-xp-label').textContent = `${totalXP} XP`;
  document.getElementById('qk-stage-progress-bar').style.width = (stagesDone / QK_STAGES_PER_KATEGORI * 100) + '%';

  showPage('page-quiz-stages');
  requestAnimationFrame(() => renderStagePath());
}

function renderStagePath() {
  const path = document.getElementById('qk-stage-path');
  const kat  = qkActiveKategori;
  const stagesDone = getStagesDone(kat.id);

  const W  = (path.clientWidth - 40) || 340; // subtract left+right padding (20+20)
  const cx = W / 2;
  const OX = Math.min(118, cx - 68); // max offset so button+label stay on screen
  const offsets = [OX, -OX, OX, -OX, OX];

  const STEP   = 190; // vertical px between stage centers
  const BTN    = 48;  // button is 96×96 (BTN = half = 48)
  const TOTAL_H = STEP * (QK_STAGES_PER_KATEGORI - 1) + BTN * 2 + 80;

  // Build SVG defs + path segments
  let svgDefs = '', svgPaths = '';
  for (let i = 0; i < QK_STAGES_PER_KATEGORI - 1; i++) {
    const done   = i < stagesDone;
    const active = i === stagesDone;
    const locked = i > stagesDone;
    const color  = QK_STAGE_COLORS[i];
    const nColor = QK_STAGE_COLORS[i + 1];
    const sx = cx + offsets[i],       sy = i * STEP + BTN;
    const ex = cx + offsets[i + 1],   ey = (i + 1) * STEP + BTN;
    const cp1y = sy + STEP * 0.38, cp2y = ey - STEP * 0.38;
    const d = `M ${sx} ${sy} C ${sx} ${cp1y} ${ex} ${cp2y} ${ex} ${ey}`;

    svgDefs += `<linearGradient id="pcg${i}" gradientUnits="userSpaceOnUse" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}">
      <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${nColor}"/>
    </linearGradient>`;
    const stroke = done ? `url(#pcg${i})` : active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
    const dash   = locked ? 'stroke-dasharray="14 9"' : '';
    const glow   = done ? `filter="drop-shadow(0 0 7px ${color}cc)"` : '';
    svgPaths += `<path d="${d}" stroke="${stroke}" stroke-width="11" stroke-linecap="round" fill="none" ${dash} ${glow}/>`;
  }

  // Mid-path decoration emojis
  const midDecos = [
    ['🌟','⚡'], ['💫','🎯'], ['⭐','✨'], ['💎','🌟']
  ];
  let decoHtml = '';
  for (let i = 0; i < QK_STAGES_PER_KATEGORI - 1; i++) {
    const done = i < stagesDone;
    const opa  = done ? 0.85 : 0.22;
    const sx   = cx + offsets[i], ex = cx + offsets[i + 1];
    const sy   = i * STEP + BTN,  ey = (i + 1) * STEP + BTN;
    // Two emoji decorations at t≈0.35 and t≈0.68 along the segment
    [[0.35, midDecos[i][0]], [0.68, midDecos[i][1]]].forEach(([t, em]) => {
      const bx = sx + (ex - sx) * t, by = sy + (ey - sy) * t;
      decoHtml += `<div style="position:absolute;top:${by - 12}px;left:${bx - 12}px;font-size:16px;opacity:${opa};pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">${em}</div>`;
    });
  }

  // Stage node buttons + labels
  let nodesHtml = '';
  for (let i = 0; i < QK_STAGES_PER_KATEGORI; i++) {
    const done   = i < stagesDone;
    const active = i === stagesDone;
    const locked = i > stagesDone;
    const color  = QK_STAGE_COLORS[i];
    const xp     = QK_STAGE_XP[i];
    const ox     = offsets[i];
    const bx     = cx + ox; // button center x
    const by     = i * STEP; // button top y

    const btnBg = done
      ? `linear-gradient(145deg,${color},${color}bb)`
      : active ? `linear-gradient(145deg,${color},${color}88)` : 'linear-gradient(145deg,#3a3a5c,#2a2a4a)';
    const btnShadow = active
      ? `0 0 0 8px ${color}44,0 10px 36px ${color}88`
      : done ? `0 6px 22px ${color}77` : '0 4px 14px rgba(0,0,0,0.35)';
    const nameCol = done ? color : active ? '#ffffff' : 'rgba(255,255,255,0.42)';
    const subCol  = done ? 'rgba(255,255,255,0.9)' : active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';

    const scaleStyle = active ? 'transform:scale(1.12);transform-origin:center top;' : '';

    nodesHtml += `
    <div style="position:absolute;top:${by}px;left:${bx - BTN}px;width:${BTN * 2}px;${scaleStyle}">
      ${active ? `<div style="text-align:center;margin-bottom:5px">
        <span style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF0080);color:#fff;font-size:11px;font-weight:900;padding:4px 14px;border-radius:50px;font-family:Nunito;white-space:nowrap;box-shadow:0 3px 12px rgba(255,107,53,0.75);animation:qkBounce 1s ease-in-out infinite">▶ MULAI</span>
      </div>` : `<div style="height:24px"></div>`}
      <button onclick="${locked ? "toast('Selesaikan stage sebelumnya dulu! 🔒','error')" : `mulaiStage(${i})`}"
        style="width:${BTN * 2}px;height:${BTN * 2}px;border-radius:28px;border:none;cursor:${locked ? 'not-allowed' : 'pointer'};background:${btnBg};box-shadow:${btnShadow};transition:all 0.25s;opacity:${locked ? '0.5' : '1'}${active ? ';animation:qkPulseRing 1.6s ease-in-out infinite' : ''}">
        <div style="font-size:38px;display:flex;align-items:center;justify-content:center;height:100%">${locked ? '🔒' : QK_STAGE_ICONS[i]}</div>
      </button>
      <div style="text-align:center;margin-top:8px">
        <div style="font-family:'Fredoka One',cursive;font-size:15px;color:${nameCol};text-shadow:0 2px 8px rgba(0,0,0,0.55);line-height:1.2">${QK_STAGE_NAMES[i]}</div>
        <div style="font-size:11px;font-weight:800;color:${subCol};margin-top:3px">${done ? `✅ +${xp} XP` : active ? `⚡ ${QK_SOAL_PER_STAGE} soal` : '🔒 Terkunci'}</div>
      </div>
    </div>`;
  }

  path.innerHTML = `
  <div style="position:relative;height:${TOTAL_H}px;overflow:visible">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${TOTAL_H}"
         style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" preserveAspectRatio="none">
      <defs>${svgDefs}</defs>
      ${svgPaths}
    </svg>
    ${decoHtml}
    ${nodesHtml}
  </div>`;

  if (!document.getElementById('qk-keyframes')) {
    const s = document.createElement('style');
    s.id = 'qk-keyframes';
    s.textContent = `
      @keyframes qkPulseRing {
        0%,100%{box-shadow:0 0 0 8px rgba(255,255,255,0.2),0 10px 36px rgba(255,255,255,0.25)}
        50%    {box-shadow:0 0 0 18px rgba(255,255,255,0.05),0 10px 44px rgba(255,255,255,0.45)}
      }
      @keyframes qkBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`;
    document.head.appendChild(s);
  }

  spawnQkStars();
}

function spawnQkStars() {
  const bg = document.getElementById('qk-stars-bg');
  if (!bg || bg.children.length > 0) return;
  const chars = ['⭐','✨','💫','🌟','⚡','💎','🌈','🎯','🏅','💥','🎪','🌺','🦋','🎵','🔥','🌙','🪐','🎀','🍀','🎆'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 22 + 8;
    const dur  = Math.random() * 10 + 6;
    const anim = Math.random() > 0.5 ? 'qkFloat' : 'qkFloat2';
    el.style.cssText = `position:absolute;font-size:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:${Math.random()*0.38+0.06};animation:${anim} ${dur}s ease-in-out infinite;animation-delay:${Math.random()*8}s;pointer-events:none`;
    el.textContent = chars[Math.floor(Math.random() * chars.length)];
    bg.appendChild(el);
  }
  if (!document.getElementById('qk-float-kf')) {
    const s = document.createElement('style');
    s.id = 'qk-float-kf';
    s.textContent = `
      @keyframes qkFloat{0%,100%{transform:translateY(0) scale(1) rotate(0deg)}50%{transform:translateY(-22px) scale(1.12) rotate(6deg)}}
      @keyframes qkFloat2{0%,100%{transform:translateY(0) scale(1) rotate(0deg)}50%{transform:translateY(-12px) scale(0.88) rotate(-8deg)}}`;
    document.head.appendChild(s);
  }
}

// ── Mulai stage tertentu ────────────────────────────────────
async function mulaiStage(stageIdx) {
  qkActiveStage = stageIdx;
  qkLives = 3;
  questions = [];

  showLoading(true);
  try {
    // Ambil materi dari kelas untuk generate soal
    const materiData = await api('GET', `/materi?kelas_id=${qkActiveKategori.kelasId}`);
    const materiList = materiData.materi || materiData.data || [];

    if (materiList.length === 0) {
      // Coba ambil dari bank soal guru
      const soalData = await api('GET', `/soal?mapel=${encodeURIComponent(qkActiveKategori.mapel)}`);
      const bankSoal = soalData.soal || soalData.data || [];

      if (bankSoal.length > 0) {
        // Pakai soal dari bank
        const shuffled = bankSoal.sort(() => Math.random()-0.5);
        questions = shuffled.slice(0, QK_SOAL_PER_STAGE).map(s => ({
          q: s.pertanyaan, emoji: s.emoji || getMapelEmoji(s.mapel),
          opts: Array.isArray(s.opsi) ? s.opsi : JSON.parse(s.opsi || '[]'),
          jawaban: s.jawaban, ans: -1, label: s.mapel, poin: s.poin || 100,
          fromAI: false
        }));
        questions.forEach(q => {
          q.ans = q.opts.findIndex(o => o === q.jawaban);
          if (q.ans < 0) q.ans = 0;
        });
      } else {
        toast('Guru belum menambahkan materi atau soal untuk kelas ini. Minta gurumu tambahkan dulu! 📚', 'error');
        showLoading(false); return;
      }
    } else {
      // Generate soal dari materi pakai AI (Groq)
      // Ambil konten materi — teks atau deskripsi (PDF tidak punya konten teks)
      const materiDenganKonten = materiList.filter(m =>
        (m.konten && m.konten.length > 50) || (m.deskripsi && m.deskripsi.length > 30)
      );

      // Kalau semua materi adalah PDF (konten kosong), coba bank soal dulu
      if (materiDenganKonten.length === 0) {
        const soalData2 = await api('GET', `/soal?mapel=${encodeURIComponent(qkActiveKategori.mapel)}`);
        const bankSoal2 = soalData2.soal || soalData2.data || [];
        if (bankSoal2.length > 0) {
          const shuffled2 = bankSoal2.sort(() => Math.random()-0.5);
          questions = shuffled2.slice(0, QK_SOAL_PER_STAGE).map(s => ({
            q: s.pertanyaan, emoji: s.emoji || getMapelEmoji(s.mapel),
            opts: Array.isArray(s.opsi) ? s.opsi : JSON.parse(s.opsi || '[]'),
            jawaban: s.jawaban, ans: -1, label: s.mapel, poin: s.poin || 100
          }));
          questions.forEach(q => { q.ans = q.opts.findIndex(o => o === q.jawaban); if (q.ans < 0) q.ans = 0; });
        } else {
          toast('Materi di kelas ini berupa PDF — AI tidak bisa membaca isinya. Minta guru tambahkan soal ke bank soal! 📝', 'error');
          showLoading(false); return;
        }
      } else {
      toast('🤖 AI sedang buat soal dari materi...', '');
      const kontenMateri = materiDenganKonten.slice(0, 4).map(m => {
        const isi = m.konten && m.konten.length > 50 ? m.konten.substring(0, 600) : (m.deskripsi || '');
        return `Judul: ${m.judul}\nMapel: ${m.mapel || qkActiveKategori.mapel}\nIsi: ${isi}`;
      }).join('\n---\n').substring(0, 2500); // batasi total

      const tingkatNames = ['sangat mudah','mudah','sedang','susah','sangat susah'];
      const tingkat = tingkatNames[stageIdx] || 'sedang';

      const aiResp = await api('POST', '/ai/chat', {
        model: 'openai/gpt-oss-120b',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{
          role: 'system',
          content: 'Kamu pembuat soal. Balas HANYA JSON object: {"soal":[...]} tanpa teks lain.'
        },{
          role: 'user',
          content: `Buat ${QK_SOAL_PER_STAGE} soal pilihan ganda tingkat ${tingkat} dari materi ini:\n\n${kontenMateri}\n\nFormat: {"soal":[{"pertanyaan":"...","emoji":"📚","opsi":["A","B","C","D"],"jawaban":"teks jawaban persis sama dengan opsi","poin":${50*(stageIdx+1)}}]}`
        }]
      });
      if (!aiResp.success) throw new Error(aiResp.pesan || 'AI error');
      const aiData = aiResp.data;
      let soalAI = [];
      try {
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
        soalAI = parsed.soal || parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);
      } catch(parseErr) {
        // Fallback: coba ekstrak array
        let teks = (aiData.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
        const fi = teks.indexOf('['), la = teks.lastIndexOf(']');
        if (fi>=0&&la>=0) {
          teks = teks.slice(fi, la+1).replace(/,(\s*[}\]])/g,'$1');
          try { soalAI = JSON.parse(teks); } catch(e) {
            const objs = teks.match(/\{[\s\S]*?\}/g) || [];
            soalAI = objs.map(o => { try { return JSON.parse(o); } catch(e2) { return null; }}).filter(Boolean);
          }
        }
        if (soalAI.length === 0) throw new Error('Format soal dari AI tidak valid. Silakan coba lagi!');
      }

      questions = soalAI.map(s => {
        const cocok = (s.opsi||[]).find(o => o.trim().toLowerCase()===s.jawaban?.trim().toLowerCase());
        const jawaban = cocok || s.opsi?.[0] || '';
        return {
          q: s.pertanyaan, emoji: s.emoji || getMapelEmoji(qkActiveKategori.mapel),
          opts: s.opsi || [], jawaban, ans: (s.opsi||[]).indexOf(jawaban),
          label: qkActiveKategori.mapel, poin: s.poin || 100, fromAI: true
        };
      }).filter(s => s.opts.length >= 2);
      } // end else materiDenganKonten > 0
    } // end else (ada materi)

    if (questions.length === 0) {
      toast('Tidak bisa membuat soal. Coba lagi!', 'error');
      showLoading(false); return;
    }

    resetQuiz();
    showPage('page-quiz');
  } catch(e) {
    toast('Gagal memuat soal: ' + e.message, 'error');
    console.error(e);
  }
  showLoading(false);
}

function batalQuizKilat() {
  if (!confirm('Keluar dari quiz? Progress stage ini tidak tersimpan.')) return;
  clearInterval(timer);
  if (qkActiveKategori) bukaStageMap(qkActiveKategori.id);
  else showPage('page-quiz-map');
}

function lanjutSetelahQuiz() {
  if (qkActiveKategori) bukaStageMap(qkActiveKategori.id);
  else showPage('page-quiz-map');
}

async function startQuiz() {
  showPage('page-quiz-map');
  await loadQuizKilatMap();
}

function resetQuiz() {
  qIdx = 0; score = 0; correctCount = 0; answered = false;
  clearInterval(timer);
  quizStartTime = Date.now();

  document.getElementById('quiz-score').textContent  = '0';
  document.getElementById('qk-lives').textContent    = qkLives;
  document.getElementById('quiz-playing').style.display = 'block';
  document.getElementById('quiz-result').style.display  = 'none';
  document.getElementById('qk-feedback').style.display  = 'none';
  document.getElementById('quiz-progress').style.width  = '0%';

  if (questions.length > 0) renderQuestion();
}

function renderQuestion() {
  answered = false;
  const q   = questions[qIdx];
  const pct = (qIdx / questions.length * 100);

  document.getElementById('quiz-progress').style.width = pct + '%';
  document.getElementById('q-emoji').textContent = q.emoji;
  document.getElementById('q-text').textContent  = q.q;
  document.getElementById('qk-mapel-badge').textContent = `${getMapelEmoji(q.label)} ${q.label || 'Soal'}`;
  document.getElementById('qk-feedback').style.display = 'none';

  const opts = document.getElementById('quiz-opts');
  const optColors = ['#4D96FF','#FF6B35','#6BCB77','#C77DFF'];
  const optLetters = ['A','B','C','D'];
  opts.innerHTML = (q.opts || []).map((o, i) => `
    <button onclick="selectAnswer(${i}, this)"
      style="width:100%;padding:14px 18px;border-radius:16px;border:2.5px solid ${optColors[i%4]}30;
             background:transparent;font-family:Nunito,sans-serif;font-weight:700;font-size:15px;
             cursor:pointer;transition:all 0.2s;text-align:left;display:flex;align-items:center;gap:12px"
      onmouseover="if(!this.dataset.answered)this.style.background='${optColors[i%4]}15'"
      onmouseout="if(!this.dataset.answered)this.style.background='transparent'">
      <span style="width:32px;height:32px;border-radius:50%;background:${optColors[i%4]}20;color:${optColors[i%4]};
                   font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${optLetters[i]}
      </span>
      <span>${o}</span>
    </button>`).join('');

  startTimer();
}

function startTimer() {
  clearInterval(timer);
  timeLeft = 15;
  const timerEl = document.getElementById('quiz-timer');
  timerEl.textContent = timeLeft;
  timerEl.className = timerEl.className.replace(/ warning| danger/g, '');
  timer = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    timerEl.className = timerEl.className.replace(/ warning| danger/g, '');
    if (timeLeft <= 5) timerEl.classList.add('danger');
    else if (timeLeft <= 8) timerEl.classList.add('warning');
    if (timeLeft <= 0) { clearInterval(timer); timeExpired(); }
  }, 1000);
}

function timeExpired() {
  if (answered) return;
  answered = true;
  qkLives = Math.max(0, qkLives - 1);
  document.getElementById('qk-lives').textContent = qkLives;

  // Show correct answer
  const btns = document.querySelectorAll('#quiz-opts button');
  if (btns[questions[qIdx].ans]) {
    btns[questions[qIdx].ans].style.background = '#E8F8EE';
    btns[questions[qIdx].ans].style.borderColor = '#6BCB77';
  }
  showFeedback(false, questions[qIdx].jawaban, 0);
  if (qkLives <= 0) { setTimeout(() => stageFailed(), 1600); return; }
}

function selectAnswer(i, btn) {
  if (answered) return;
  answered = true;
  clearInterval(timer);
  btn.dataset.answered = '1';

  const correct = questions[qIdx].ans;
  const btns    = document.querySelectorAll('#quiz-opts button');
  btns.forEach(b => b.style.pointerEvents = 'none');

  if (i === correct) {
    btn.style.background = '#E8F8EE';
    btn.style.borderColor = '#6BCB77';
    const bonus = Math.max(50, timeLeft * 10) + questions[qIdx].poin;
    score += bonus;
    correctCount++;
    document.getElementById('quiz-score').textContent = score;
    showFeedback(true, questions[qIdx].jawaban, bonus);
  } else {
    btn.style.background = '#FFEFE8';
    btn.style.borderColor = '#D12B00';
    if (btns[correct]) { btns[correct].style.background = '#E8F8EE'; btns[correct].style.borderColor = '#6BCB77'; }
    qkLives = Math.max(0, qkLives - 1);
    document.getElementById('qk-lives').textContent = qkLives;
    showFeedback(false, questions[qIdx].jawaban, 0);
    if (qkLives <= 0) { setTimeout(() => stageFailed(), 1600); return; }
  }
}

function showFeedback(benar, jawabanBenar, poin) {
  const fb = document.getElementById('qk-feedback');
  fb.style.display = 'block';
  fb.style.background = benar ? '#E8F8EE' : '#FFEFE8';
  document.getElementById('qk-feedback-title').textContent = benar ? `Benar! 🎉 +${poin} poin` : 'Kurang tepat 😅';
  document.getElementById('qk-feedback-title').style.color = benar ? '#27AE60' : '#E74C3C';
  document.getElementById('qk-feedback-sub').textContent = benar ? 'Pertahankan semangatmu!' : `Jawaban: ${jawabanBenar}`;
  document.getElementById('qk-feedback-sub').style.color = benar ? '#27AE60' : '#E74C3C';
  const nextBtn = document.getElementById('qk-next-btn');
  nextBtn.style.background = benar ? '#27AE60' : '#E74C3C';
  nextBtn.style.color = 'white';
}

function nextQuestion() {
  qIdx++;
  if (qIdx >= questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

function stageFailed() {
  clearInterval(timer);
  document.getElementById('quiz-playing').style.display = 'none';
  document.getElementById('quiz-result').style.display = 'block';
  document.getElementById('qk-feedback').style.display = 'none';

  const pct = Math.round(correctCount / questions.length * 100);
  document.getElementById('result-emoji').textContent = '💔';
  document.getElementById('result-stars').textContent = '';
  document.getElementById('result-title').textContent = 'Nyawa Habis!';
  document.getElementById('qk-result-stats').innerHTML = `
    <div style="background:#FFEFE8;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#E74C3C">${correctCount}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Benar</div>
    </div>
    <div style="background:#F0F8FF;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#4D96FF">${pct}%</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Akurasi</div>
    </div>
    <div style="background:#FFEFE8;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--orange)">${score}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Poin</div>
    </div>`;
}

function showResult() {
  clearInterval(timer);
  document.getElementById('quiz-playing').style.display = 'none';
  document.getElementById('quiz-result').style.display  = 'block';
  document.getElementById('qk-feedback').style.display  = 'none';

  const pct   = Math.round(correctCount / questions.length * 100);
  const stars = pct >= 90 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : '⭐';
  const xpBonus = QK_STAGE_XP[qkActiveStage] || 50;

  document.getElementById('result-emoji').textContent = pct >= 60 ? '🎉' : '😊';
  document.getElementById('result-stars').textContent = stars;
  document.getElementById('result-title').textContent = pct >= 90 ? 'Sempurna!' : pct >= 60 ? 'Bagus!' : 'Ayo coba lagi!';
  document.getElementById('qk-result-stats').innerHTML = `
    <div style="background:#E8F8EE;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#27AE60">${correctCount}/${questions.length}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Benar</div>
    </div>
    <div style="background:#FFEFE8;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--orange)">${score}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Total Poin</div>
    </div>
    <div style="background:#EEF5FF;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#4D96FF">+${pct>=60?xpBonus:Math.round(xpBonus*0.3)}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">XP</div>
    </div>`;

  // Tandai stage selesai jika lulus (>= 60%)
  if (pct >= 60 && qkActiveKategori) {
    qkStageProgress[`${qkActiveKategori.id}_${qkActiveStage}`] = 'done';
    // Update XP user
    if (currentUser) {
      currentUser.xp = (currentUser.xp || 0) + xpBonus;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      api('PUT', '/auth/profile', { nama: currentUser.nama }).catch(() => {});
    }
  }
}

