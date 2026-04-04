/**
 * iList PWA Install Card v1.0
 * Card flutuante elegante para prompt de instalação
 * Aparece automaticamente quando beforeinstallprompt está disponível
 */

class PWAInstallCard {
  constructor() {
    this.deferredPrompt = null;
    this.cardElement = null;
    this.isVisible = false;
    this.dismissedOnce = false;

    this.init();
  }

  init() {
    // Injetar estilos
    this.injectStyles();

    // Criar card no DOM
    this.createCard();

    // Interceptar beforeinstallprompt
    this.setupBeforeInstallPrompt();

    // Detectar se já está instalado
    this.checkIfInstalled();

    console.log('[PWA Card] Inicializado');
  }

  injectStyles() {
    if (document.getElementById('pwa-install-card-styles')) return;

    const style = document.createElement('style');
    style.id = 'pwa-install-card-styles';
    style.textContent = `
      /* Container do card */
      .pwa-install-card {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 320px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1.5px solid rgba(102, 126, 234, 0.3);
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6),
                    0 0 0 1px rgba(102, 126, 234, 0.1);
        z-index: 9998;
        display: none;
        flex-direction: column;
        gap: 12px;
        backdrop-filter: blur(8px);
        animation: slideUpIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        overflow: hidden;
      }

      /* Linha accent no topo */
      .pwa-install-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
        animation: shimmer 3s ease-in-out infinite;
      }

      .pwa-install-card.show {
        display: flex;
      }

      .pwa-install-card.hide {
        animation: slideDownOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }

      /* Header com ícone */
      .pwa-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
      }

      .pwa-card-icon {
        font-size: 28px;
        filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.2));
      }

      .pwa-card-title {
        font-size: 16px;
        font-weight: 800;
        color: #fff;
        margin: 0;
        font-family: 'Syne', sans-serif;
        letter-spacing: -0.3px;
      }

      /* Descrição */
      .pwa-card-description {
        font-size: 13px;
        color: #cbd5e1;
        margin: 0;
        line-height: 1.5;
        font-family: 'Syne', sans-serif;
        font-weight: 500;
      }

      /* Botões */
      .pwa-card-buttons {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .pwa-btn {
        flex: 1;
        padding: 10px 14px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        font-family: 'Syne', sans-serif;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        white-space: nowrap;
        text-align: center;
      }

      .pwa-btn:active {
        transform: scale(0.95);
      }

      /* Botão Instalar (primário) */
      .pwa-btn-install {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
      }

      .pwa-btn-install:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(102, 126, 234, 0.4);
        background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
      }

      /* Botão Agora não (secundário) */
      .pwa-btn-dismiss {
        background: rgba(255, 255, 255, 0.06);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .pwa-btn-dismiss:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #cbd5e1;
        border-color: rgba(255, 255, 255, 0.12);
      }

      /* Botão fechar (X) */
      .pwa-card-close {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        color: #64748b;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 6px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pwa-card-close:hover {
        color: #cbd5e1;
        transform: rotate(90deg);
      }

      /* Animações */
      @keyframes slideUpIn {
        from {
          opacity: 0;
          transform: translateY(20px) translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0) translateX(0);
        }
      }

      @keyframes slideDownOut {
        from {
          opacity: 1;
          transform: translateY(0) translateX(0);
        }
        to {
          opacity: 0;
          transform: translateY(20px) translateX(20px);
        }
      }

      @keyframes shimmer {
        0%, 100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }

      /* Responsive */
      @media (max-width: 480px) {
        .pwa-install-card {
          width: calc(100% - 20px);
          bottom: 10px;
          right: 10px;
          left: 10px;
        }

        .pwa-btn {
          font-size: 12px;
          padding: 9px 12px;
        }

        .pwa-card-title {
          font-size: 15px;
        }

        .pwa-card-description {
          font-size: 12px;
        }
      }

      /* Dark mode (já em dark) */
      @media (prefers-color-scheme: light) {
        .pwa-install-card {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          border-color: rgba(102, 126, 234, 0.2);
        }

        .pwa-card-title {
          color: #0f172a;
        }

        .pwa-card-description {
          color: #475569;
        }

        .pwa-btn-dismiss {
          background: rgba(0, 0, 0, 0.05);
          color: #64748b;
          border-color: rgba(0, 0, 0, 0.1);
        }

        .pwa-btn-dismiss:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #475569;
        }
      }
    `;

    document.head.appendChild(style);
  }

  createCard() {
    const card = document.createElement('div');
    card.className = 'pwa-install-card';
    card.id = 'pwaInstallCard';

    card.innerHTML = `
      <!-- Botão fechar -->
      <button class="pwa-card-close" aria-label="Fechar" title="Descartar">&times;</button>

      <!-- Header com ícone -->
      <div class="pwa-card-header">
        <span class="pwa-card-icon">📱</span>
        <h3 class="pwa-card-title">Instalar iList?</h3>
      </div>

      <!-- Descrição -->
      <p class="pwa-card-description">
        Use offline, sem internet. Como um app nativo.
      </p>

      <!-- Botões -->
      <div class="pwa-card-buttons">
        <button class="pwa-btn pwa-btn-install" id="pwaCardInstallBtn">
          Instalar
        </button>
        <button class="pwa-btn pwa-btn-dismiss" id="pwaCardDismissBtn">
          Agora não
        </button>
      </div>
    `;

    document.body.appendChild(card);
    this.cardElement = card;

    // Event listeners
    document.querySelector('.pwa-card-close').addEventListener('click', () => this.dismiss());
    document.getElementById('pwaCardInstallBtn').addEventListener('click', () => this.install());
    document.getElementById('pwaCardDismissBtn').addEventListener('click', () => this.dismiss());
  }

  setupBeforeInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('[PWA Card] beforeinstallprompt disparado');

      // Previne o banner automático do Chrome
      event.preventDefault();

      // Guarda o evento
      this.deferredPrompt = event;

      // Mostrar card se não foi descartado antes
      if (!this.dismissedOnce && !this.checkIfInstalled()) {
        this.show();
      }
    });
  }

  show() {
    if (!this.cardElement) return;

    this.isVisible = true;
    this.dismissedOnce = false;

    this.cardElement.classList.remove('hide');
    this.cardElement.classList.add('show');

    console.log('[PWA Card] Visível');
  }

  hide() {
    if (!this.cardElement) return;

    this.isVisible = false;
    this.cardElement.classList.add('hide');

    setTimeout(() => {
      this.cardElement.classList.remove('show');
      this.cardElement.classList.remove('hide');
    }, 300);
  }

  dismiss() {
    console.log('[PWA Card] Descartado pelo usuário');
    this.dismissedOnce = true;
    this.hide();

    // Salvar preferência (24h)
    localStorage.setItem('pwaCardDismissed', Date.now().toString());
  }

  async install() {
    if (!this.deferredPrompt) {
      console.warn('[PWA Card] Prompt não disponível');
      this.showMessage('Instalação não disponível neste navegador', 'error');
      return;
    }

    console.log('[PWA Card] Mostrando prompt de instalação');

    // Mostrar o prompt nativo
    this.deferredPrompt.prompt();

    // Aguardar resposta
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA Card] ✅ App instalado');
      this.showMessage('✅ iList instalado com sucesso!', 'success');
      this.hide();
    } else {
      console.log('[PWA Card] Usuário recusou');
      this.showMessage('Você pode instalar depois no menu', 'info');
      this.dismiss();
    }

    this.deferredPrompt = null;
  }

  checkIfInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSPWA = window.navigator.standalone === true;

    if (isStandalone || isIOSPWA) {
      console.log('[PWA Card] Já está instalado');
      this.hide();
      return true;
    }

    return false;
  }

  shouldShow() {
    // Verificar se não foi descartado recentemente (24h)
    const dismissedTime = localStorage.getItem('pwaCardDismissed');
    if (dismissedTime) {
      const hoursAgo = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursAgo < 24) {
        console.log(`[PWA Card] Descartado há ${hoursAgo.toFixed(1)}h — não mostrar`);
        return false;
      }
    }

    return true;
  }

  showMessage(message, type = 'info') {
    const colors = {
      success: 'rgba(16,185,129,0.95)',
      error: 'rgba(239,68,68,0.95)',
      info: 'rgba(6,182,212,0.95)'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Syne', sans-serif;
      z-index: 10000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      animation: slideInRight 0.3s ease-out;
      max-width: 360px;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  reset() {
    localStorage.removeItem('pwaCardDismissed');
    this.dismissedOnce = false;
    if (this.deferredPrompt) {
      this.show();
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// INICIALIZAR
// ───────────────────────────────────────────────────────────────────

// Inicializar imediatamente (não esperar DOMContentLoaded)
window.pwaInstallCard = new PWAInstallCard();

// API pública
window.showPWACard = () => {
  if (window.pwaInstallCard) {
    window.pwaInstallCard.show();
  }
};

window.hidePWACard = () => {
  if (window.pwaInstallCard) {
    window.pwaInstallCard.hide();
  }
};

window.resetPWACard = () => {
  if (window.pwaInstallCard) {
    window.pwaInstallCard.reset();
  }
};

console.log('[PWA Card] 📱 Comandos: showPWACard() | hidePWACard() | resetPWACard()');

// API pública
window.showPWACard = () => {
  if (window.pwaInstallCard) {
    window.pwaInstallCard.show();
  }
};

window.hidePWACard = () => {
  if (window.pwaInstallCard) {
    window.pwaInstallCard.hide();
  }
};

window.resetPWACard = () => {
  if (window.pwaInstallCard) {
    window.pwaInstallCard.reset();
  }
};

console.log('[PWA Card] 📱 Comandos: showPWACard() | hidePWACard() | resetPWACard()');
