/**
 * iList — Onboarding v1.0
 * 4 balloons sequenciais no primeiro acesso.
 * Salva conclusão em localStorage — nunca aparece de novo.
 * window.startOnboarding() reinicia para testes.
 */

(function iListOnboarding() {
  'use strict';

  const DONE_KEY = 'dylist_onboarding_v1';

  /* ─── PASSOS ───────────────────────────────────────────────────────────── */
  // Onboarding desativado — sem pré-tutoriais
  const STEPS = [];

  /* ─── ESTADO ────────────────────────────────────────────────────────────── */
  let step = 0;
  let $overlay, $hole, $balloon;

  /* ─── ESTILOS ───────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ob-css')) return;
    const s = document.createElement('style');
    s.id = 'ob-css';
    s.textContent = `
      #ob-overlay {
        position: fixed; inset: 0; z-index: 49998;
        pointer-events: none;
      }
      #ob-overlay svg {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
      }
      #ob-balloon {
        position: fixed; z-index: 49999;
        background: #0d1b2a;
        border: 1.5px solid rgba(255,153,0,.35);
        border-radius: 14px;
        padding: 18px 18px 14px;
        width: 260px;
        box-shadow: 0 20px 56px rgba(0,0,0,.75),
                    0 0 0 1px rgba(255,255,255,.04);
        pointer-events: auto;
        overflow: hidden;
      }
      #ob-balloon::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, #06b6d4, #FF9900, #ef4444);
        border-radius: 14px 14px 0 0;
      }
      @keyframes ob-pop {
        from { opacity: 0; transform: scale(.84) translateY(6px); }
        to   { opacity: 1; transform: scale(1)   translateY(0);   }
      }
      #ob-balloon.ob-visible {
        animation: ob-pop .28s cubic-bezier(.34,1.56,.64,1) forwards;
      }
      #ob-balloon .ob-arrow {
        position: absolute;
        width: 12px; height: 12px;
        background: #0d1b2a;
        border: 1.5px solid rgba(255,153,0,.35);
        transform: rotate(45deg);
      }
      #ob-balloon .ob-arrow.top    { top: -7px;    left: 24px;  border-right: none; border-bottom: none; }
      #ob-balloon .ob-arrow.bottom { bottom: -7px; left: 24px;  border-left:  none; border-top:    none; }
      #ob-balloon .ob-arrow.right  { right: -7px;  top: 22px;   border-left:  none; border-bottom: none; }
      #ob-balloon .ob-arrow.left   { left: -7px;   top: 22px;   border-right: none; border-top:    none; }
      .ob-icon { font-size: 24px; display: block; margin-bottom: 8px; }
      .ob-text {
        font-size: 13px; line-height: 1.58; color: #e2e8f0;
        font-family: 'Syne', sans-serif; font-weight: 600;
        margin: 0 0 14px;
      }
      .ob-dots { display: flex; gap: 5px; margin-bottom: 12px; }
      .ob-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: rgba(255,255,255,.18);
        transition: background .2s;
      }
      .ob-dot.active { background: #FF9900; }
      .ob-footer {
        display: flex; align-items: center;
        justify-content: space-between; gap: 8px;
      }
      .ob-skip {
        font-size: 11px; color: #64748b; cursor: pointer;
        font-family: 'JetBrains Mono', monospace;
        background: none; border: none; padding: 0; margin: 0;
        transition: color .15s;
      }
      .ob-skip:hover { color: #ef4444; }
      .ob-next {
        background: linear-gradient(135deg, #FF9900, #f59e0b);
        color: #000; border: none; border-radius: 7px;
        padding: 7px 16px; font-size: 12px; font-weight: 800;
        font-family: 'Syne', sans-serif; cursor: pointer; margin: 0;
        transition: transform .15s, box-shadow .15s;
        white-space: nowrap;
      }
      .ob-next:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(255,153,0,.4);
      }
      .ob-target-highlight {
        outline: 2.5px solid rgba(255,153,0,.85) !important;
        outline-offset: 5px !important;
        border-radius: 8px !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* ─── DOM ───────────────────────────────────────────────────────────────── */
  function buildDOM() {
    $overlay = document.createElement('div');
    $overlay.id = 'ob-overlay';
    $overlay.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="ob-mask">
            <rect width="100%" height="100%" fill="white"/>
            <rect id="ob-hole" rx="9" ry="9" fill="black"/>
          </mask>
        </defs>
        <rect width="100%" height="100%"
              fill="rgba(0,0,0,.74)" mask="url(#ob-mask)"/>
      </svg>`;
    document.body.appendChild($overlay);
    $hole = document.getElementById('ob-hole');

    $balloon = document.createElement('div');
    $balloon.id = 'ob-balloon';
    document.body.appendChild($balloon);
  }

  /* ─── RENDER ────────────────────────────────────────────────────────────── */
  function render(idx) {
    document.querySelectorAll('.ob-target-highlight')
      .forEach(el => el.classList.remove('ob-target-highlight'));

    const cfg    = STEPS[idx];
    const target = document.querySelector(cfg.targetSel);

    if (!target) { advance(); return; }

    const rect = target.getBoundingClientRect();
    const pad  = 10;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    /* recorte */
    $hole.setAttribute('x',      rect.left   - pad);
    $hole.setAttribute('y',      rect.top    - pad);
    $hole.setAttribute('width',  rect.width  + pad * 2);
    $hole.setAttribute('height', rect.height + pad * 2);

    target.classList.add('ob-target-highlight');

    const dotsHtml = STEPS.map((_, i) =>
      `<span class="ob-dot${i === idx ? ' active' : ''}"></span>`
    ).join('');

    const isLast = idx === STEPS.length - 1;

    $balloon.innerHTML = `
      <div class="ob-arrow ${cfg.arrowSide}"></div>
      <span class="ob-icon">${cfg.icon}</span>
      <p class="ob-text">${cfg.text}</p>
      <div class="ob-dots">${dotsHtml}</div>
      <div class="ob-footer">
        <button class="ob-skip">Pular tutorial</button>
        <button class="ob-next">${isLast ? '🎉 Começar!' : 'Próximo →'}</button>
      </div>`;

    /* posição */
    const bw = 276;
    const bh = 190;
    const gap = 16;
    let top, left;

    switch (cfg.side) {
      case 'bottom': top = rect.bottom + gap;      left = rect.left; break;
      case 'top':    top = rect.top - bh - gap;    left = rect.left; break;
      case 'left':   top = rect.top;               left = rect.left - bw - gap; break;
      case 'right':  top = rect.top;               left = rect.right + gap; break;
      default:       top = rect.bottom + gap;      left = rect.left;
    }

    left = Math.max(12, Math.min(left, vw - bw - 12));
    top  = Math.max(12, Math.min(top,  vh - bh - 12));

    $balloon.style.top  = top  + 'px';
    $balloon.style.left = left + 'px';

    $balloon.classList.remove('ob-visible');
    void $balloon.offsetWidth;
    $balloon.classList.add('ob-visible');

    $balloon.querySelector('.ob-next').addEventListener('click', advance);
    $balloon.querySelector('.ob-skip').addEventListener('click', finish);
  }

  /* ─── NAVEGAÇÃO ─────────────────────────────────────────────────────────── */
  function advance() {
    step++;
    if (step >= STEPS.length) { finish(); return; }

    const nextTarget = document.querySelector(STEPS[step].targetSel);
    if (nextTarget) {
      nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => render(step), 380);
    } else {
      render(step);
    }
  }

  function finish() {
    localStorage.setItem(DONE_KEY, '1');
    document.querySelectorAll('.ob-target-highlight')
      .forEach(el => el.classList.remove('ob-target-highlight'));

    [$overlay, $balloon].forEach(el => {
      if (!el) return;
      el.style.transition = 'opacity .25s';
      el.style.opacity    = '0';
    });
    setTimeout(() => {
      document.getElementById('ob-overlay')?.remove();
      document.getElementById('ob-balloon')?.remove();
    }, 280);
  }

  /* ─── START ─────────────────────────────────────────────────────────────── */
  function start() {
    if (STEPS.length === 0) return; // sem tutoriais ativos
    if (localStorage.getItem(DONE_KEY)) return;
    injectCSS();
    buildDOM();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => render(0), 650);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(start, 1300));
  } else {
    setTimeout(start, 1300);
  }

  /* ─── API PÚBLICA ───────────────────────────────────────────────────────── */
  window.startOnboarding = function () {
    localStorage.removeItem(DONE_KEY);
    step = 0;
    document.getElementById('ob-overlay')?.remove();
    document.getElementById('ob-balloon')?.remove();
    injectCSS();
    buildDOM();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => render(0), 400);
  };

}());
