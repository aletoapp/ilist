/**
 * DyList Onboarding Input Patch
 * Remove referências ao urlInputHint que foi substituído pelo botão de busca externo
 * Garante que o indicador de tipo continue funcionando
 */
(function patchInputFeedback() {
  const originalInit = window.SmartSearch;
  // O patch é aplicado sobrescrevendo _updateInputFeedback após instância criada
  const checkInterval = setInterval(() => {
    if (!window.smartSearchInstance) return;
    clearInterval(checkInterval);

    const instance = window.smartSearchInstance;

    // Sobrescrever para não usar urlInputHint (removido do DOM)
    instance._updateInputFeedback = function(input, icon, hint, indicator) {
      const val = input.value.trim();
      if (!val) {
        if (icon) icon.textContent = '🔗';
        if (indicator) indicator.className = 'url-type-indicator';
        return;
      }

      const type = this._detectType(val);

      const map = {
        video:    { icon: '🎬', cls: 'type-video',  label: '🎬 Link de vídeo — será adicionado direto' },
        canal:    { icon: '📺', cls: 'type-canal',  label: '📺 Canal detectado — mostrará lista de vídeos' },
        playlist: { icon: '📋', cls: 'type-lista',  label: '📋 Playlist detectada — mostrará os vídeos' },
        busca:    { icon: '🔍', cls: 'type-busca',  label: '🔍 Busca por texto' },
      };

      const m = map[type] || map.busca;
      if (icon) icon.textContent = m.icon;
      if (indicator) {
        indicator.className = `url-type-indicator show ${m.cls}`;
        indicator.textContent = m.label;
      }
    };
  }, 200);
})();
