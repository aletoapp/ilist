/**
 * DyList PWA Module
 * Progressive Web App functionality
 */

let deferredPrompt;

// Registrar Service Worker — aponta para sw.js real (blob URLs são bloqueadas pelos browsers)
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service Workers não suportados');
    return;
  }

  // Determina o caminho correto do sw.js relativo à página atual
  const swPath = new URL('sw.js', window.location.href).href;

  navigator.serviceWorker.register(swPath)
    .then(reg => {
      logger.success('Service Worker registrado', { scope: reg.scope });
    })
    .catch(err => {
      logger.error('Falha ao registrar SW', { error: err.message });
    });
}

// Capturar evento de instalação
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    // CORREÇÃO: Usar flex para manter o layout correto
    installBtn.style.display = 'flex';
    logger.info('Prompt de instalação PWA capturado');
  }
});

// Instalar PWA
async function installPWA() {
  const installBtn = document.getElementById('installAppBtn');
  
  if (!deferredPrompt) {
    logger.warn('Prompt de instalação não disponível');
    alert("A instalação PWA só funciona em navegadores compatíveis (Chrome/Edge/Brave Android) ou o app já está instalado.");
    return;
  }
  
  logger.info('Solicitando instalação PWA');
  deferredPrompt.prompt();
  
  const result = await deferredPrompt.userChoice;
  
  if (result.outcome === 'accepted') {
    logger.info('PWA instalado pelo usuário');
    logger.success('PWA instalado');
    if (installBtn) installBtn.style.display = 'none';
  } else {
    logger.info('Instalação PWA recusada');
  }
  
  deferredPrompt = null;
}

// Evento de instalação concluída
window.addEventListener('appinstalled', () => {
  logger.info('App instalado no dispositivo');
  logger.success('App instalado no dispositivo');
  
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'none';
});

// Detectar se está rodando como PWA
function isRunningAsPWA() {
  const isPWA = 
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  
  if (isPWA) {
    logger.info('Rodando como PWA');
  }
  
  return isPWA;
}

// Verificar atualizações do SW
function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        reg.update();
        logger.debug('Verificando atualizações do SW');
      }
    });
  }
}

// Inicialização PWA
document.addEventListener('DOMContentLoaded', () => {
  // Registrar Service Worker
  registerServiceWorker();
  
  // Verificar se está rodando como PWA
  isRunningAsPWA();
  
  // Botão de instalação
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.addEventListener('click', installPWA);
  }
  
  // Verificar atualizações a cada 30 minutos
  setInterval(checkForUpdates, 30 * 60 * 1000);
  
  logger.info('Módulo PWA inicializado');
});


let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    // 1. Previne o banner padrão para forçar o uso do seu botão
    e.preventDefault();
    
    // 2. Guarda o evento para ser disparado pelo seu botão depois
    deferredPrompt = e;
    
    // 3. AGORA o botão aparece na interface
    if (installBtn) {
        installBtn.style.display = 'block'; 
        console.log("✅ Lab: Botão de instalação liberado.");
    }
});

// Lógica de clique do seu botão customizado
if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        // Mostra o prompt de instalação
        deferredPrompt.prompt();
        
        // Aguarda a escolha do usuário
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`💻 Lab: Escolha do usuário: ${outcome}`);
        
        // Limpa o prompt e esconde o botão
        deferredPrompt = null;
        installBtn.style.display = 'none';
    });
}
