/**
 * DyList Equalizer Module - v1.0
 * Equalizador 8 bandas com espectro animado em tempo real
 */

// ─── CONFIGURAÇÃO ───────────────────────────────────────────────────────────

const EQ_BANDS = [
  { freq: 60,    label: '60Hz'  },
  { freq: 170,   label: '170Hz' },
  { freq: 310,   label: '310Hz' },
  { freq: 600,   label: '600Hz' },
  { freq: 1000,  label: '1kHz'  },
  { freq: 3000,  label: '3kHz'  },
  { freq: 6000,  label: '6kHz'  },
  { freq: 14000, label: '14kHz' },
];

const EQ_PRESETS = {
  'Normal':         [ 0,  0,  0,  0,  0,  0,  0,  0],
  'Clareza':        [-2, -1,  0,  2,  4,  5,  4,  3],
  'Ambiente':       [ 4,  3,  2,  1, -1, -1,  2,  3],
  'Surround':       [ 3,  2,  0, -1, -1,  0,  2,  3],
  'Reforço Graves': [ 6,  5,  4,  2,  0, -1, -1, -2],
};

const PRESET_ICONS = {
  'Normal':         '🎵',
  'Clareza':        '✨',
  'Ambiente':       '🌊',
  'Surround':       '🔊',
  'Reforço Graves': '🥁',
};

// ─── ESTADO ─────────────────────────────────────────────────────────────────

let eqValues       = [0, 0, 0, 0, 0, 0, 0, 0];
let eqActivePreset = 'Normal';
let eqAnimFrame    = null;
let eqAnimPhase    = 0;
let eqIsOpen       = false;

// Web Audio API
let audioCtx  = null;
let filters   = [];
let gainNode  = null;
let eqChained = false;

// ─── WEB AUDIO API ──────────────────────────────────────────────────────────

function initAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Criar cadeia de filtros BiquadFilter
    filters = EQ_BANDS.map((band, i) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type      = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = band.freq;
      filter.gain.value      = eqValues[i];
      filter.Q.value         = 1.0;
      return filter;
    });

    // Nó de ganho mestre
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1.0;

    // Encadear: filtros → gain → destino
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Tentar capturar o áudio da página
    tryHookPageAudio();

    console.log('[EQ] AudioContext criado com sucesso');
  } catch (e) {
    console.warn('[EQ] Web Audio API não disponível:', e.message);
  }
}

function tryHookPageAudio() {
  // Tenta conectar ao áudio do iframe do YouTube
  // (funciona em contextos onde CORS permite)
  try {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iDoc) continue;
        const video = iDoc.querySelector('video');
        if (video && !video._eqHooked) {
          const src = audioCtx.createMediaElementSource(video);
          src.connect(filters[0]);
          video._eqHooked = true;
          eqChained = true;
          console.log('[EQ] ✅ Áudio do YouTube capturado!');
          updateEqStatusUI(true);
          return;
        }
      } catch (_) {}
    }
  } catch (_) {}

  // Fallback: procurar qualquer elemento de audio/video na página
  try {
    const mediaEls = document.querySelectorAll('audio, video');
    for (const el of mediaEls) {
      if (!el._eqHooked) {
        const src = audioCtx.createMediaElementSource(el);
        src.connect(filters[0]);
        el._eqHooked = true;
        eqChained = true;
        console.log('[EQ] ✅ Elemento de mídia capturado');
        updateEqStatusUI(true);
        return;
      }
    }
  } catch (_) {}

  // Visual-only mode
  console.info('[EQ] Modo visual: processamento de áudio em standby');
  updateEqStatusUI(false);
}

function retryAudioHook() {
  if (eqChained || !audioCtx) return;
  tryHookPageAudio();
}

function applyEqToFilters() {
  if (!filters.length) return;
  filters.forEach((f, i) => {
    if (f && f.gain) {
      f.gain.setTargetAtTime(eqValues[i], audioCtx.currentTime, 0.015);
    }
  });
}

function applyVolumeHint() {
  // Aplica dica de volume ao YouTube player baseado na soma dos graves
  // como fallback quando Web Audio não consegue capturar o iframe
  if (eqChained) return;
  if (typeof player === 'undefined' || !player || typeof player.getVolume !== 'function') return;
  try {
    const bassBoost = (eqValues[0] + eqValues[1]) / 2;
    const curVol    = player.getVolume();
    const base      = 80;
    const adjusted  = Math.min(100, Math.max(10, base + bassBoost * 1.5));
    if (Math.abs(adjusted - curVol) > 2) player.setVolume(adjusted);
  } catch (_) {}
}

// ─── SPECTRUM CANVAS ────────────────────────────────────────────────────────

function drawSpectrum() {
  const canvas = document.getElementById('eqSpectrumCanvas');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const BARS   = 40;
  const barW   = W / BARS - 1;

  ctx.clearRect(0, 0, W, H);

  // Fundo levemente iluminado
  ctx.fillStyle = 'rgba(15,23,42,0.6)';
  ctx.fillRect(0, 0, W, H);

  // Linhas de grade horizontais
  ctx.strokeStyle = 'rgba(100,116,139,0.2)';
  ctx.lineWidth   = 1;
  for (let y = H * 0.25; y < H; y += H * 0.25) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  eqAnimPhase += 0.025;

  for (let i = 0; i < BARS; i++) {
    const t   = i / (BARS - 1);           // 0..1 ao longo da freq
    const eqI = Math.min(7, Math.floor(t * 8));

    // Altura base pulsante com componente sinusoidal
    const pulse   = Math.sin(eqAnimPhase + i * 0.4) * 0.15 + 0.85;
    const eqGain  = (eqValues[eqI] + 12) / 24;          // normaliza -12..+12 → 0..1
    const barH    = Math.max(4, H * (0.25 + eqGain * 0.55) * pulse);

    const x = i * (barW + 1);
    const y = H - barH;

    // Gradiente por barra
    const grad = ctx.createLinearGradient(x, y, x, H);
    const hue1 = 180 + t * 40;   // ciano → azul
    const hue2 = 30  + t * 20;   // laranja → amarelo
    grad.addColorStop(0,   `hsla(${hue1},90%,65%,0.95)`);
    grad.addColorStop(0.5, `hsla(${(hue1+hue2)/2},85%,55%,0.85)`);
    grad.addColorStop(1,   `hsla(${hue2},95%,55%,0.7)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
    ctx.fill();

    // Brilho no topo
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x, y, barW, 2);
  }

  if (eqIsOpen) eqAnimFrame = requestAnimationFrame(drawSpectrum);
}

function startSpectrum() {
  if (eqAnimFrame) cancelAnimationFrame(eqAnimFrame);
  eqIsOpen = true;
  drawSpectrum();
}

function stopSpectrum() {
  eqIsOpen = false;
  if (eqAnimFrame) { cancelAnimationFrame(eqAnimFrame); eqAnimFrame = null; }
}

// ─── UI ─────────────────────────────────────────────────────────────────────

function updateEqStatusUI(hooked) {
  const dot = document.getElementById('eqStatusDot');
  const txt = document.getElementById('eqStatusText');
  if (!dot || !txt) return;
  if (hooked) {
    dot.style.background = '#22c55e';
    txt.textContent = 'ao vivo';
  } else {
    dot.style.background = '#f59e0b';
    txt.textContent = 'visual';
  }
}

function renderEqBands() {
  const container = document.getElementById('eqBandsContainer');
  if (!container) return;
  container.innerHTML = '';

  EQ_BANDS.forEach((band, i) => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;';

    // Valor numérico
    const valLabel = document.createElement('span');
    valLabel.id    = `eqVal_${i}`;
    valLabel.style.cssText = 'font-size:11px;color:#06b6d4;font-weight:700;min-height:16px;';
    valLabel.textContent   = formatGain(eqValues[i]);

    // Slider vertical
    const slider = document.createElement('input');
    slider.type    = 'range';
    slider.min     = '-12';
    slider.max     = '12';
    slider.step    = '1';
    slider.value   = eqValues[i];
    slider.id      = `eqSlider_${i}`;
    slider.style.cssText = `
      -webkit-appearance: slider-vertical;
      writing-mode: vertical-lr;
      direction: rtl;
      width: 28px;
      height: 110px;
      cursor: pointer;
      accent-color: #06b6d4;
    `;

    slider.oninput = () => {
      eqValues[i]       = parseFloat(slider.value);
      valLabel.textContent = formatGain(eqValues[i]);
      eqActivePreset    = '';
      deselectAllPresets();
      applyEqToFilters();
      applyVolumeHint();
      saveEqSettings();
    };

    // Label de frequência
    const freqLabel = document.createElement('span');
    freqLabel.style.cssText = 'font-size:10px;color:#64748b;text-align:center;font-weight:600;';
    freqLabel.textContent   = band.label;

    col.appendChild(valLabel);
    col.appendChild(slider);
    col.appendChild(freqLabel);
    container.appendChild(col);
  });
}

function renderPresets() {
  const container = document.getElementById('eqPresetsContainer');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(EQ_PRESETS).forEach(([name, values]) => {
    const btn = document.createElement('button');
    btn.id    = `eqPreset_${name}`;
    btn.type  = 'button';
    btn.innerHTML = `${PRESET_ICONS[name] || ''} ${name}`;
    btn.style.cssText = `
      flex:1; min-width:80px; padding:9px 6px;
      border:2px solid #334155; border-radius:8px;
      background:#1e293b; color:#94a3b8;
      font-size:12px; font-weight:700; cursor:pointer;
      transition:all 0.2s; font-family:inherit;
    `;
    btn.onmouseenter = () => { if (eqActivePreset !== name) btn.style.background = '#334155'; };
    btn.onmouseleave = () => { if (eqActivePreset !== name) btn.style.background = '#1e293b'; };
    btn.onclick      = () => applyPreset(name);
    container.appendChild(btn);
  });

  // Botão Redefinir separado
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.innerHTML = '↺ Redefinir';
  resetBtn.style.cssText = `
    flex:1; min-width:80px; padding:9px 6px;
    border:2px solid #ef4444; border-radius:8px;
    background:rgba(239,68,68,0.1); color:#ef4444;
    font-size:12px; font-weight:700; cursor:pointer;
    transition:all 0.2s; font-family:inherit;
  `;
  resetBtn.onmouseenter = () => resetBtn.style.background = 'rgba(239,68,68,0.25)';
  resetBtn.onmouseleave = () => resetBtn.style.background = 'rgba(239,68,68,0.1)';
  resetBtn.onclick = () => applyPreset('Normal');
  container.appendChild(resetBtn);
}

function applyPreset(name) {
  const values = EQ_PRESETS[name];
  if (!values) return;

  eqValues       = [...values];
  eqActivePreset = name;

  // Atualizar sliders e valores
  EQ_BANDS.forEach((_, i) => {
    const sl  = document.getElementById(`eqSlider_${i}`);
    const lbl = document.getElementById(`eqVal_${i}`);
    if (sl)  sl.value         = eqValues[i];
    if (lbl) lbl.textContent  = formatGain(eqValues[i]);
  });

  // Highlight preset ativo
  deselectAllPresets();
  const btn = document.getElementById(`eqPreset_${name}`);
  if (btn) {
    btn.style.background   = 'linear-gradient(135deg,#06b6d4,#3b82f6)';
    btn.style.color        = '#fff';
    btn.style.borderColor  = '#06b6d4';
    btn.style.boxShadow    = '0 0 12px rgba(6,182,212,0.4)';
  }

  applyEqToFilters();
  applyVolumeHint();
  saveEqSettings();
}

function deselectAllPresets() {
  Object.keys(EQ_PRESETS).forEach(name => {
    const btn = document.getElementById(`eqPreset_${name}`);
    if (btn) {
      btn.style.background  = '#1e293b';
      btn.style.color       = '#94a3b8';
      btn.style.borderColor = '#334155';
      btn.style.boxShadow   = 'none';
    }
  });
}

function formatGain(v) {
  if (v === 0)  return '0';
  return (v > 0 ? '+' : '') + v;
}

// ─── PERSISTÊNCIA ───────────────────────────────────────────────────────────

function saveEqSettings() {
  try {
    localStorage.setItem('dylist_eq', JSON.stringify({ values: eqValues, preset: eqActivePreset }));
  } catch (_) {}
}

function loadEqSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('dylist_eq'));
    if (saved && saved.values && saved.values.length === 8) {
      eqValues       = saved.values;
      eqActivePreset = saved.preset || 'Normal';
    }
  } catch (_) {}
}

// ─── MODAL ──────────────────────────────────────────────────────────────────

function openEqualizer() {
  const modal = document.getElementById('equalizerModal');
  if (!modal) return;
  modal.style.display = 'flex';

  loadEqSettings();
  initAudioContext();
  renderEqBands();
  renderPresets();

  if (eqActivePreset) {
    const btn = document.getElementById(`eqPreset_${eqActivePreset}`);
    if (btn) {
      btn.style.background  = 'linear-gradient(135deg,#06b6d4,#3b82f6)';
      btn.style.color       = '#fff';
      btn.style.borderColor = '#06b6d4';
      btn.style.boxShadow   = '0 0 12px rgba(6,182,212,0.4)';
    }
  }

  startSpectrum();

  // Tentar conectar ao áudio após player estar pronto
  setTimeout(retryAudioHook, 800);
}

function closeEqualizer() {
  const modal = document.getElementById('equalizerModal');
  if (modal) modal.style.display = 'none';
  stopSpectrum();
}

// ─── INJEÇÃO DO MODAL NO DOM ────────────────────────────────────────────────

function injectEqualizerModal() {
  if (document.getElementById('equalizerModal')) return;

  const modal = document.createElement('div');
  modal.id    = 'equalizerModal';
  modal.className = 'modal';
  modal.style.cssText = 'background:rgba(0,0,0,0.88);z-index:2000;';
  modal.onclick = (e) => { if (e.target === modal) closeEqualizer(); };

  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="
      background:linear-gradient(160deg,#0f1f35 0%,#0d1b2e 100%);
      border:1.5px solid rgba(6,182,212,0.25);
      border-radius:16px; padding:22px 20px 18px;
      width:92%; max-width:480px;
      box-shadow:0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(6,182,212,0.08);
      animation:scaleIn 0.3s ease forwards;
    ">

      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;filter:drop-shadow(0 0 6px #06b6d4);">♪</span>
          <div>
            <div style="font-size:15px;font-weight:700;color:#f1f5f9;letter-spacing:0.5px;">Equalizador</div>
            <div style="font-size:11px;color:#64748b;margin-top:1px;">8 bandas · tempo real</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:7px;">
          <span id="eqStatusDot" style="
            display:inline-block;width:8px;height:8px;border-radius:50%;
            background:#f59e0b;box-shadow:0 0 6px currentColor;
          "></span>
          <span id="eqStatusText" style="font-size:11px;color:#64748b;font-weight:600;">visual</span>
        </div>
      </div>

      <!-- Spectrum Canvas -->
      <div style="border-radius:10px;overflow:hidden;margin-bottom:18px;border:1px solid rgba(255,255,255,0.06);">
        <canvas id="eqSpectrumCanvas" style="display:block;width:100%;height:80px;" height="80"></canvas>
      </div>

      <!-- Bandas EQ -->
      <div id="eqBandsContainer" style="
        display:flex; gap:4px; justify-content:space-between;
        padding:14px 8px; background:rgba(0,0,0,0.3);
        border-radius:10px; margin-bottom:16px;
        border:1px solid rgba(255,255,255,0.05);
      "></div>

      <!-- Presets -->
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;color:#475569;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;">Presets</div>
        <div id="eqPresetsContainer" style="
          display:flex;flex-wrap:wrap;gap:6px;
        "></div>
      </div>

      <!-- Fechar -->
      <button onclick="closeEqualizer()" style="
        width:100%;margin-top:14px;padding:11px;
        background:rgba(239,68,68,0.15);
        border:1.5px solid rgba(239,68,68,0.4);
        color:#ef4444;border-radius:8px;font-size:14px;
        font-weight:700;cursor:pointer;transition:all 0.2s;
        font-family:inherit;
      "
      onmouseenter="this.style.background='rgba(239,68,68,0.28)'"
      onmouseleave="this.style.background='rgba(239,68,68,0.15)'"
      >Fechar</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Ajustar canvas width após render
  requestAnimationFrame(() => {
    const canvas = document.getElementById('eqSpectrumCanvas');
    if (canvas) canvas.width = canvas.offsetWidth || 440;
  });
}

// ─── BOTÃO ♪ ────────────────────────────────────────────────────────────────

function injectEqualizerButton() {
  if (document.getElementById('openEqualizerBtn')) return;

  const searchBtn = document.getElementById('smartSearchBtn');
  if (!searchBtn) return;

  const eqBtn = document.createElement('button');
  eqBtn.id        = 'openEqualizerBtn';
  eqBtn.className = 'btn-equalizador';
  eqBtn.title     = 'Equalizador';
  eqBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;">
      <line x1="4"  y1="21" x2="4"  y2="14"/>
      <line x1="4"  y1="10" x2="4"  y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8"  x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1"  y1="14" x2="7"  y2="14"/>
      <line x1="9"  y1="8"  x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
    ♪
  `;
  eqBtn.onclick = openEqualizer;

  searchBtn.parentNode.insertBefore(eqBtn, searchBtn.nextSibling);
}

// ─── INJEÇÃO DE ESTILOS ──────────────────────────────────────────────────────

function injectEqualizerStyles() {
  if (document.getElementById('eqStyles')) return;
  const style = document.createElement('style');
  style.id = 'eqStyles';
  style.textContent = `
    .btn-equalizador {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
      font-family: 'Source Sans Pro', sans-serif;
      background: linear-gradient(135deg, #0e7490, #0284c7);
      color: #fff;
      letter-spacing: 0.3px;
      margin-left: 0;
    }
    .btn-equalizador:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(6,182,212,0.4);
      background: linear-gradient(135deg, #0e7490, #0284c7);
    }

    /* Slider vertical cross-browser */
    #eqBandsContainer input[type=range] {
      -webkit-appearance: slider-vertical;
      writing-mode: vertical-lr;
      direction: rtl;
      width: 24px;
      height: 110px;
      cursor: pointer;
      accent-color: #06b6d4;
      background: transparent;
    }

    /* Firefox vertical slider */
    @-moz-document url-prefix() {
      #eqBandsContainer input[type=range] {
        writing-mode: vertical-lr;
        direction: rtl;
        appearance: slider-vertical;
      }
    }

    #equalizerModal .modal-content {
      max-width: 480px;
    }
  `;
  document.head.appendChild(style);
}

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────

function initEqualizer() {
  loadEqSettings();
  injectEqualizerStyles();
  injectEqualizerModal();
  injectEqualizerButton();
  console.log('[EQ] ✅ Equalizador v1.0 inicializado');
}

// Expor globalmente
window.openEqualizer  = openEqualizer;
window.closeEqualizer = closeEqualizer;

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initEqualizer();
} else {
  window.addEventListener('load', initEqualizer);
}
