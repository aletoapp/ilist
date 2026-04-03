/**
 * iList PWA Module v2.0
 * Progressive Web App com:
 * - Detecção de install prompt
 * - Fallback para navegadores sem suporte
 * - Feedback visual para offline
 * - Verificação de updates
 */

let deferredPrompt = null;
let installPromptFired = false;

// ═════════════════════════════════════════════════════════════════
// 1️⃣ REGISTRAR SERVICE WORKER
// ═════════════════════════════════════════════════════════════════
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers não suportados neste navegador');
    return false;
  }

  // Determina o caminho correto relativo ao documento
  const swPath = new URL('sw.js', window.location.href).href;

  navigator.serviceWorker
    .register(swPath, { scope: './' })
    .then(reg => {
      console.log('[PWA] ✅ Service Worker registrado com sucesso');
      console.log('[PWA] Escopo:', reg.scope);

      // Monitorar updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[PWA] Atualização disponível! Recarregando...');
            // Notificar usuário de forma não-invasiva
            showUpdateNotification();
          }
        });
      });

      // Verificar updates periodicamente (a cada hora)
      setInterval(() => {
        reg.update();
      }, 60 * 60 * 1000);

      return true;
    })
    .catch(err => {
      console.error('[PWA] ❌ Erro ao registrar SW:', err.message);
      return false;
    });
}

function showUpdateNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('iList Atualizado', {
      body: '📦 Uma nova versão está disponível. Recarregando...',
      icon: 'https://alexandretorres.com.br/assets/img/icon-192.png',
      badge: 'https://alexandretorres.com.br/assets/img/icon-192.png',
      tag: 'ilist-update'
    });
  }
}

// ═════════════════════════════════════════════════════════════════
// 2️⃣ INTERCEPTAR BEFOREINSTALLPROMPT
// ═════════════════════════════════════════════════════════════════
window.addEventListener('beforeinstallprompt', (event) => {
  console.log('[PWA] beforeinstallprompt disparado');

  // Previne o banner automático do Chrome
  event.preventDefault();

  // Guarda o evento para ser usado depois
  deferredPrompt = event;
  installPromptFired = true;

  // Mostrar botão de instalação se o HTML tiver um
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.style.display = 'flex';
    console.log('[PWA] Botão de instalação exibido');
  } else {
    // Criar um botão de fallback se não existir no HTML
    createFallbackInstallButton();
  }
});

function createFallbackInstallButton() {
  // Verificar se já existe
  if (document.getElementById('pwa-fallback-install-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'pwa-fallback-install-btn';
  btn.className = 'btn-install-pwa';
  btn.innerHTML = '📲 Instalar iList como App';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    border: none;
    padding: 12px 20px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(16,185,129,0.3);
    transition: all 0.2s;
    font-family: 'Syne', sans-serif;
  `;

  btn.addEventListener('mouseover', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 6px 24px rgba(16,185,129,0.4)';
  });

  btn.addEventListener('mouseout', () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 20px rgba(16,185,129,0.3)';
  });

  btn.addEventListener('click', installPWA);

  // Inserir antes do box
  const box = document.querySelector('.box');
  if (box) {
    box.parentNode.insertBefore(btn, box);
  } else {
    document.body.appendChild(btn);
  }

  console.log('[PWA] Botão de instalação criado (fallback)');
}

// ═════════════════════════════════════════════════════════════════
// 3️⃣ FUNÇÃO DE INSTALAÇÃO
// ═════════════════════════════════════════════════════════════════
async function installPWA() {
  console.log('[PWA] Tentando instalar...');

  if (!deferredPrompt) {
    console.warn('[PWA] Prompt não disponível — navegador não suporta ou já está instalado');
    showInstallUnavailableMessage();
    return;
  }

  try {
    // Mostrar o prompt nativo do navegador
    deferredPrompt.prompt();

    // Aguardar resposta do usuário
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] ✅ App instalado pelo usuário');
      showInstallSuccessMessage();
      hideInstallButtons();
    } else {
      console.log('[PWA] ℹ️ Usuário recusou instalação');
      showInstallDismissedMessage();
    }

    // Limpar o prompt para não usar novamente
    deferredPrompt = null;
  } catch (err) {
    console.error('[PWA] Erro durante instalação:', err);
    showInstallErrorMessage(err.message);
  }
}

// ═════════════════════════════════════════════════════════════════
// 4️⃣ MENSAGENS/FEEDBACK
// ═════════════════════════════════════════════════════════════════

function showInstallSuccessMessage() {
  showToast('✅ iList instalado com sucesso! Abra o app na sua tela inicial.', 'success');
}

function showInstallDismissedMessage() {
  // Silencioso — usuário rejeitou
}

function showInstallUnavailableMessage() {
  showToast(
    '📱 Instalação não disponível neste navegador. Use Chrome, Edge ou Brave no Android.',
    'info'
  );
}

function showInstallErrorMessage(err) {
  showToast('❌ Erro ao instalar: ' + err, 'error');
}

function showToast(message, type = 'info') {
  const colors = {
    success: 'rgba(16,185,129,0.95)',
    error: 'rgba(239,68,68,0.95)',
    info: 'rgba(6,182,212,0.95)',
    warning: 'rgba(245,158,11,0.95)'
  };

  // Remover toast anterior do mesmo tipo
  const existing = document.querySelector(`[data-toast-type="${type}"]`);
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.setAttribute('data-toast-type', type);
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 14px 20px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Syne', sans-serif;
    z-index: 20000;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    max-width: 360px;
    line-height: 1.5;
    animation: slideInRight 0.3s ease-out;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-in';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function hideInstallButtons() {
  const btn1 = document.getElementById('installAppBtn');
  const btn2 = document.getElementById('pwa-fallback-install-btn');
  if (btn1) btn1.style.display = 'none';
  if (btn2) btn2.style.display = 'none';
}

// ═════════════════════════════════════════════════════════════════
// 5️⃣ DETECTAR INSTALAÇÃO COMPLETA
// ═════════════════════════════════════════════════════════════════
window.addEventListener('appinstalled', () => {
  console.log('[PWA] 🎉 App instalado no dispositivo');
  hideInstallButtons();
  showToast('🎉 iList instalado com sucesso!', 'success');

  // Analytics
  if (typeof logger !== 'undefined') {
    logger.trackEvent('app_installed', { timestamp: new Date().toISOString() });
  }
});

// ═════════════════════════════════════════════════════════════════
// 6️⃣ DETECTAR SE JÁ ESTÁ INSTALADO/RODANDO COMO PWA
// ═════════════════════════════════════════════════════════════════
function isRunningAsPWA() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSPWA = window.navigator.standalone === true;
  return isStandalone || isIOSPWA;
}

function showRunningAsPWAIndicator() {
  if (isRunningAsPWA()) {
    console.log('[PWA] 🚀 Rodando como app instalado!');

    // Ocultar botão de instalação
    hideInstallButtons();

    // Analytics
    if (typeof logger !== 'undefined') {
      logger.trackEvent('running_as_pwa', { timestamp: new Date().toISOString() });
    }

    return true;
  }
  return false;
}

// ═════════════════════════════════════════════════════════════════
// 7️⃣ NOTIFICAÇÕES (iOS/Android)
// ═════════════════════════════════════════════════════════════════
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[PWA] Notificações não suportadas');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('[PWA] ✅ Permissão de notificações concedida');
        return true;
      }
    });
  }
  return false;
}

// ═════════════════════════════════════════════════════════════════
// 8️⃣ STATUS DE CONEXÃO
// ═════════════════════════════════════════════════════════════════
function monitorConnectionStatus() {
  window.addEventListener('online', () => {
    console.log('[PWA] 🟢 Volta online');
    showToast('🟢 Conexão restaurada!', 'success');
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] 🔴 Sem conexão');
    showToast('🔴 Você está offline. Seus dados estão salvos.', 'warning');
  });

  // Status inicial
  if (navigator.onLine) {
    console.log('[PWA] 🟢 Online');
  } else {
    console.log('[PWA] 🔴 Offline');
    showToast('🔴 Você está offline.', 'warning');
  }
}

// ═════════════════════════════════════════════════════════════════
// 9️⃣ INICIALIZAÇÃO AUTOMÁTICA
// ═════════════════════════════════════════════════════════════════
function initPWA() {
  console.log('[PWA] 🚀 Inicializando PWA v2.0...');

  // 1. Registrar Service Worker
  registerServiceWorker();

  // 2. Verificar se já está instalado
  showRunningAsPWAIndicator();

  // 3. Monitorar conexão
  monitorConnectionStatus();

  // 4. Pedir permissão de notificações (não invasivo)
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);

  console.log('[PWA] ✅ Inicialização completa');
}

// Executar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
} else {
  initPWA();
}

// ═════════════════════════════════════════════════════════════════
// 🔟 API PÚBLICA PARA CONSOLE
// ═════════════════════════════════════════════════════════════════
window.pwaStatus = () => {
  return {
    swRegistered: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
    isOnline: navigator.onLine,
    isInstalledApp: isRunningAsPWA(),
    installPromptAvailable: deferredPrompt !== null,
    installPromptFired: installPromptFired
  };
};

window.installApp = installPWA;
window.pwaInfo = () => {
  console.table(window.pwaStatus());
};

// Injetar estilos das animações de toast
(function injectStyles() {
  if (document.getElementById('pwa-toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'pwa-toast-styles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
})();

console.log('[PWA] 🎓 Comandos disponíveis:');
console.log('  • pwaStatus() — ver status PWA');
console.log('  • pwaInfo() — table com detalhes');
console.log('  • installApp() — forçar instalação');
