/**
 * DyList - Sistema de Backup e Restore
 * Salva TODOS os dados: playlist, categorias, configuracoes, historico
 */

class BackupManager {
  constructor() {
    this.init();
  }

  init() {
    console.log('📦 Backup Manager inicializado');
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Configurar event listeners quando DOM estiver pronto
    const setup = () => {
      const exportBtn = document.getElementById('exportBackupBtn');
      const importBtn = document.getElementById('importBackupBtn');
      
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportBackup());
        console.log('✅ Botão Export configurado');
      } else {
        console.warn('⚠️ Botão exportBackupBtn não encontrado');
      }
      
      if (importBtn) {
        importBtn.addEventListener('click', () => this.importBackup());
        console.log('✅ Botão Import configurado');
      } else {
        console.warn('⚠️ Botão importBackupBtn não encontrado');
      }
    };

    // Executar imediatamente se DOM já estiver pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  collectAllData() {
    const backup = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: {
        playlist: JSON.parse(localStorage.getItem('playlist') || '[]'),
        categories: JSON.parse(localStorage.getItem('youlist_categories') || '[]'),
        playback_speed: localStorage.getItem('playback_speed'),
        loop_mode: localStorage.getItem('loop_mode'),
        auto_shutdown_time: localStorage.getItem('auto_shutdown_time'),
        play_history: JSON.parse(localStorage.getItem('play_history') || '[]'),
        sponsor_segments: JSON.parse(localStorage.getItem('youlist_sponsor_segments') || '{}'),
        youtube_api_key: localStorage.getItem('youtube_api_key'),
        followed_insta: localStorage.getItem('youlist_followed_insta')
      },
      stats: {
        totalVideos: 0,
        totalCategories: 0,
        totalPlayHistory: 0,
        totalSponsorSegments: 0
      }
    };

    backup.stats.totalVideos = backup.data.playlist.length;
    backup.stats.totalCategories = backup.data.categories.length;
    backup.stats.totalPlayHistory = backup.data.play_history.length;
    backup.stats.totalSponsorSegments = Object.keys(backup.data.sponsor_segments).length;

    return backup;
  }

  exportBackup() {
    try {
      console.log('📤 Iniciando exportação de backup...');
      const backup = this.collectAllData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `dylist-backup-${new Date().toISOString().split('T')[0]}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showToast(`✅ Backup exportado!\n\nDados salvos:\n• ${backup.stats.totalVideos} vídeos\n• ${backup.stats.totalCategories} categorias\n• ${backup.stats.totalPlayHistory} reproduções\n• ${backup.stats.totalSponsorSegments} segmentos`, 'success');
      
      if (typeof logger !== 'undefined') logger.info('Backup exportado', backup.stats);
      console.log('✅ Backup exportado com sucesso:', backup.stats);
      return true;
    } catch (error) {
      console.error('❌ Erro ao exportar backup:', error);
      this.showToast('❌ Erro ao exportar: ' + error.message, 'error');
      return false;
    }
  }

  importBackup() {
    console.log('📥 Iniciando importação de backup...');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      console.log('📄 Arquivo selecionado:', file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const backup = JSON.parse(event.target.result);
          console.log('📋 Backup lido:', backup);
          
          if (!backup.version || !backup.data) {
            throw new Error('Arquivo de backup inválido');
          }
          
          const confirmMsg = `Importar backup?\n\nData: ${new Date(backup.timestamp).toLocaleString('pt-BR')}\nConteúdo:\n• ${backup.stats.totalVideos} vídeos\n• ${backup.stats.totalCategories} categorias\n• ${backup.stats.totalPlayHistory} reproduções\n• ${backup.stats.totalSponsorSegments} segmentos\n\n⚠️ ATENÇÃO: Dados atuais serão substituídos!\n\nContinuar?`;
          
          if (!confirm(confirmMsg)) {
            this.showToast('❌ Importação cancelada', 'info');
            console.log('❌ Importação cancelada pelo usuário');
            return;
          }
          
          this.restoreData(backup.data);
          this.showToast(`✅ Backup restaurado!\n\nImportado:\n• ${backup.stats.totalVideos} vídeos\n• ${backup.stats.totalCategories} categorias\n\n🔄 Recarregando...`, 'success');
          console.log('✅ Backup restaurado, recarregando página...');
          setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
          console.error('❌ Erro ao importar:', error);
          this.showToast('❌ Erro: ' + error.message, 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  restoreData(data) {
    try {
      console.log('💾 Restaurando dados...');
      
      if (data.playlist) {
        localStorage.setItem('playlist', JSON.stringify(data.playlist));
        console.log('✅ Playlist restaurada:', data.playlist.length, 'vídeos');
      }
      
      if (data.categories) {
        localStorage.setItem('youlist_categories', JSON.stringify(data.categories));
        console.log('✅ Categorias restauradas:', data.categories.length);
      }
      
      if (data.playback_speed) localStorage.setItem('playback_speed', data.playback_speed);
      if (data.loop_mode) localStorage.setItem('loop_mode', data.loop_mode);
      if (data.auto_shutdown_time) localStorage.setItem('auto_shutdown_time', data.auto_shutdown_time);
      
      if (data.play_history) {
        localStorage.setItem('play_history', JSON.stringify(data.play_history));
        console.log('✅ Histórico restaurado:', data.play_history.length, 'itens');
      }
      
      if (data.sponsor_segments) {
        localStorage.setItem('youlist_sponsor_segments', JSON.stringify(data.sponsor_segments));
        console.log('✅ Segmentos restaurados');
      }
      
      if (data.youtube_api_key) localStorage.setItem('youtube_api_key', data.youtube_api_key);
      if (data.followed_insta) localStorage.setItem('youlist_followed_insta', data.followed_insta);
      
      if (typeof logger !== 'undefined') logger.success('Dados restaurados');
      console.log('✅ Todos os dados restaurados com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao restaurar:', error);
      throw error;
    }
  }

  createAutoBackup() {
    try {
      const backup = this.collectAllData();
      localStorage.setItem('dylist_auto_backup', JSON.stringify(backup));
      localStorage.setItem('dylist_auto_backup_date', new Date().toISOString());
      console.log('📦 Backup automático criado');
      return true;
    } catch (error) {
      console.error('❌ Erro backup auto:', error);
      return false;
    }
  }

  restoreAutoBackup() {
    try {
      const backup = localStorage.getItem('dylist_auto_backup');
      if (!backup) {
        this.showToast('❌ Nenhum backup automático encontrado', 'error');
        return false;
      }
      const backupData = JSON.parse(backup);
      const backupDate = localStorage.getItem('dylist_auto_backup_date');
      if (!confirm(`Restaurar backup automático?\n\nData: ${new Date(backupDate).toLocaleString('pt-BR')}\n\n⚠️ Dados atuais serão substituídos!`)) {
        this.showToast('❌ Cancelado', 'info');
        return false;
      }
      this.restoreData(backupData.data);
      this.showToast('✅ Restaurado!\n\n🔄 Recarregando...', 'success');
      setTimeout(() => window.location.reload(), 2000);
      return true;
    } catch (error) {
      console.error('❌ Erro:', error);
      this.showToast('❌ Erro: ' + error.message, 'error');
      return false;
    }
  }

  showToast(message, type = 'info') {
    const colors = { 
      info: 'rgba(59,130,246,0.95)', 
      success: 'rgba(16,185,129,0.95)', 
      error: 'rgba(239,68,68,0.95)', 
      warning: 'rgba(245,158,11,0.95)' 
    };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:${colors[type]};color:white;padding:16px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:10001;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.3);white-space:pre-line;line-height:1.6;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { 
      toast.style.opacity='0'; 
      toast.style.transition='opacity 0.3s'; 
      setTimeout(() => toast.remove(), 300); 
    }, 5000);
  }
}

// Inicialização
window.backupManager = new BackupManager();

// Backup automático a cada 30 minutos
setInterval(() => { 
  if (window.backupManager) window.backupManager.createAutoBackup(); 
}, 30 * 60 * 1000);

// Backup automático antes de fechar
window.addEventListener('beforeunload', () => { 
  if (window.backupManager) window.backupManager.createAutoBackup(); 
});

// API pública para console
window.exportBackup = () => window.backupManager.exportBackup();
window.importBackup = () => window.backupManager.importBackup();
window.restoreAutoBackup = () => window.backupManager.restoreAutoBackup();

console.log('%c📦 Backup Manager carregado!', 'color: #10b981; font-size: 14px; font-weight: bold;');
console.log('%cComandos: exportBackup() | importBackup() | restoreAutoBackup()', 'color: #64748b; font-size: 11px;');
