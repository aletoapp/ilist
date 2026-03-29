/**
 * iList — Entrada Inteligente Unificada v5.0
 * Um campo só que detecta e age:
 *   link de vídeo   → adiciona direto + toast
 *   link de canal   → abre resultados paginados
 *   link de playlist → expande e mostra paginado
 *   texto livre     → busca YouTube com paginação
 */

class SmartSearch {
  constructor() {
    this.API_KEY         = localStorage.getItem('youtube_api_key');
    this.allResults      = { videos: [] };
    this.currentTab      = 'videos';
    this.selectedCategory = null;
    this.pageTokens      = { videos: null };
    this.pageNumbers     = { videos: 1 };
    this.currentQuery    = '';
    this.cleanQueryVideos = '';
    this.channelUploadsPlaylistId = null;
    this.perPage         = 50;
    this.localPage       = 1;
    this._lastNextPageToken = null;

    this.init();
  }

  // ═══════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════

  init() {
    this._hijackUrlInput();
    this._createResultsModal();
    this._createApiKeyModal();
  }

  // ═══════════════════════════════════════════════════════
  // CAMPO UNIFICADO — intercepta o urlInput
  // ═══════════════════════════════════════════════════════

  _hijackUrlInput() {
    // Aguarda DOM estar pronto
    const setup = () => {
      const input = document.getElementById('urlInput');
      if (!input) return;

      // Ícone e hint dinâmicos
      const icon  = document.getElementById('urlInputIcon');
      const hint  = document.getElementById('urlInputHint');

      // Injeta indicador de tipo abaixo do wrapper
      let indicator = document.getElementById('urlTypeIndicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'urlTypeIndicator';
        indicator.className = 'url-type-indicator';
        const wrapper = input.closest('.url-input-area') || input.parentElement;
        wrapper.appendChild(indicator);
      }

      // Ao digitar/colar: detecta o tipo e atualiza o feedback visual
      input.addEventListener('input', () => this._updateInputFeedback(input, icon, hint, indicator));
      input.addEventListener('paste', () => setTimeout(() => this._updateInputFeedback(input, icon, hint, indicator), 50));

      // Enter = acionar
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._handleInput(input.value.trim());
        }
      });

      // Botão addBtn oculto — compatibilidade com app.js original
      const addBtn = document.getElementById('addBtn');
      if (addBtn) {
        addBtn.addEventListener('click', () => this._handleInput(input.value.trim()));
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  _updateInputFeedback(input, icon, hint, indicator) {
    const val = input.value.trim();
    if (!val) {
      if (icon)  icon.textContent = '🔗';
      if (hint)  hint.textContent = 'Enter para buscar';
      indicator.className = 'url-type-indicator';
      return;
    }

    const type = this._detectType(val);

    const map = {
      video:    { icon: '🎬', hint: '↵ adicionar vídeo', cls: 'type-video',  label: '🎬 Link de vídeo — será adicionado direto' },
      canal:    { icon: '📺', hint: '↵ ver vídeos do canal', cls: 'type-canal', label: '📺 Canal detectado — mostrará lista de vídeos' },
      playlist: { icon: '📋', hint: '↵ expandir playlist', cls: 'type-lista', label: '📋 Playlist detectada — mostrará os vídeos' },
      busca:    { icon: '🔍', hint: '↵ buscar', cls: 'type-busca',  label: '🔍 Busca por texto' },
    };

    const m = map[type] || map.busca;
    if (icon) icon.textContent = m.icon;
    if (hint) hint.textContent = m.hint;
    indicator.className = `url-type-indicator show ${m.cls}`;
    indicator.textContent = m.label;
  }

  // ═══════════════════════════════════════════════════════
  // DETECTOR DE TIPO
  // ═══════════════════════════════════════════════════════

  _detectType(input) {
    try {
      const url      = new URL(input);
      const host     = url.hostname.replace('www.', '');
      const path     = url.pathname;
      const params   = url.searchParams;

      const isYT = host === 'youtube.com' || host === 'music.youtube.com';
      const isShort = host === 'youtu.be';

      // vídeo único
      if (isShort) return 'video';
      if (isYT && params.get('v') && !params.get('list')) return 'video';

      // playlist
      if (isYT && params.get('list')) return 'playlist';

      // canal (todos os padrões)
      if (isYT && (
        /@[\w.-]+/.test(path) ||
        /\/channel\/UC[\w-]+/.test(path) ||
        /\/c\/[\w-]+/.test(path) ||
        /\/user\/[\w-]+/.test(path)
      )) return 'canal';

    } catch (_) { /* não é URL */ }

    return 'busca';
  }

  // ═══════════════════════════════════════════════════════
  // DESPACHANTE PRINCIPAL
  // ═══════════════════════════════════════════════════════

  async _handleInput(value) {
    if (!value) return;

    const input = document.getElementById('urlInput');

    // Categoria destino = filtro atual ou 'uncategorized'
    this.selectedCategory = (typeof currentFilter !== 'undefined' && currentFilter !== 'all')
      ? currentFilter
      : 'uncategorized';

    const type = this._detectType(value);

    if (type === 'video') {
      // ── Vídeo único — sem API, sem modal ──────────────────
      await this._addSingleVideo(value);
      if (input) input.value = '';
      this._clearInputFeedback();
      return;
    }

    // Para canal, playlist e busca textual precisamos da API
    if (!this._checkApiKey()) return;

    if (input) input.value = '';
    this._clearInputFeedback();

    this._resetState();
    this._showModal();
    this._setModalLoading(true);

    try {
      if (type === 'canal') {
        await this._loadCanal(value);
      } else if (type === 'playlist') {
        await this._loadPlaylist(value);
      } else {
        await this._loadBusca(value);
      }
      this._renderResults();
    } catch (err) {
      console.error(err);
      this._setModalError(err.message);
    } finally {
      this._setModalLoading(false);
    }
  }

  _clearInputFeedback() {
    const icon = document.getElementById('urlInputIcon');
    const hint = document.getElementById('urlInputHint');
    const ind  = document.getElementById('urlTypeIndicator');
    if (icon) icon.textContent = '🔗';
    if (hint) hint.textContent = 'Enter para buscar';
    if (ind)  ind.className = 'url-type-indicator';
  }

  // ═══════════════════════════════════════════════════════
  // ADICIONAR VÍDEO ÚNICO (sem API — usa oEmbed)
  // ═══════════════════════════════════════════════════════

  async _addSingleVideo(urlOrId) {
    let videoId = null;

    try {
      const url = new URL(urlOrId);
      if (url.hostname === 'youtu.be') {
        videoId = url.pathname.slice(1).split('?')[0];
      } else {
        videoId = url.searchParams.get('v');
      }
    } catch (_) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) videoId = urlOrId;
    }

    if (!videoId) {
      showQuickToast('❌ Link de vídeo inválido', 'error');
      return;
    }

    // Duplicata?
    if (typeof playlist !== 'undefined' && playlist.find(p => p.id === videoId)) {
      showQuickToast('⚠️ Vídeo já está na lista', 'warn');
      return;
    }

    showQuickToast('⏳ Buscando título...', 'info');

    let title = 'Vídeo sem título';
    try {
      const res  = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (res.ok) {
        const data = await res.json();
        title = data.title || title;
        // titleCase simples
        title = title.slice(0, 60);
      }
    } catch (_) { /* usa título padrão */ }

    if (typeof playlist !== 'undefined') {
      playlist.push({ id: videoId, title, categoryId: this.selectedCategory });
      if (window.savePlaylist)          savePlaylist();
      if (window.renderPlaylist)        renderPlaylist();
      if (window.renderCategoryFilters) renderCategoryFilters();
    }

    const catName = (typeof getCategoryById === 'function')
      ? getCategoryById(this.selectedCategory)?.name || this.selectedCategory
      : this.selectedCategory;

    showQuickToast(`✅ "${title.slice(0, 35)}..." → ${catName}`);
  }

  // ═══════════════════════════════════════════════════════
  // LOADERS
  // ═══════════════════════════════════════════════════════

  async _loadCanal(url) {
    this.currentQuery = url;
    const urlObj  = new URL(url);
    const path    = urlObj.pathname;

    let uploadsId = null;

    // @handle
    const handleM = path.match(/@([\w.-]+)/);
    if (handleM) {
      const r = await this._apiFetch(`channels?part=contentDetails&forHandle=%40${handleM[1]}`);
      if (!r.items?.[0]) throw new Error('Canal não encontrado. Verifique o link.');
      uploadsId = r.items[0].contentDetails.relatedPlaylists.uploads;
    }

    // /channel/UCxxx
    if (!uploadsId) {
      const chM = path.match(/\/channel\/(UC[\w-]+)/);
      if (chM) {
        const r = await this._apiFetch(`channels?part=contentDetails&id=${chM[1]}`);
        if (!r.items?.[0]) throw new Error('Canal não encontrado.');
        uploadsId = r.items[0].contentDetails.relatedPlaylists.uploads;
      }
    }

    if (!uploadsId) throw new Error('Não foi possível identificar o canal. Use o link completo com @handle.');

    this.channelUploadsPlaylistId = uploadsId;
    const items = await this._fetchPlaylistPage(uploadsId, null);
    this.allResults.videos  = this._dedup(items);
    this.pageTokens.videos  = this._lastNextPageToken || null;
    this.pageNumbers.videos = 1;
    this.localPage          = 1;
  }

  async _loadPlaylist(url) {
    this.currentQuery = url;
    const playlistId  = new URL(url).searchParams.get('list');
    if (!playlistId) throw new Error('Playlist inválida.');
    this.channelUploadsPlaylistId = playlistId;
    const items = await this._fetchPlaylistPage(playlistId, null);
    this.allResults.videos  = this._dedup(items);
    this.pageTokens.videos  = this._lastNextPageToken || null;
    this.pageNumbers.videos = 1;
    this.localPage          = 1;
  }

  async _loadBusca(query) {
    this.currentQuery    = query;
    this.cleanQueryVideos = query;
    this.channelUploadsPlaylistId = null;
    const result = await this._searchPage(query, null);
    this.allResults.videos  = this._dedup(result.items);
    this.pageTokens.videos  = result.nextPageToken || null;
    this.pageNumbers.videos = 1;
    this.localPage          = 1;
  }

  async loadNextPage() {
    if (!this.pageTokens.videos) return;
    this._setModalLoading(true);
    try {
      let newItems = [];
      let nextToken = null;

      if (this.channelUploadsPlaylistId) {
        newItems  = await this._fetchPlaylistPage(this.channelUploadsPlaylistId, this.pageTokens.videos);
        nextToken = this._lastNextPageToken || null;
      } else {
        const r   = await this._searchPage(this.cleanQueryVideos || this.currentQuery, this.pageTokens.videos);
        newItems  = r.items;
        nextToken = r.nextPageToken || null;
      }

      this.pageTokens.videos = nextToken;
      this.pageNumbers.videos++;

      const existingIds = new Set(this.allResults.videos.map(v => v.id));
      const unique = this._dedup(newItems).filter(v => !existingIds.has(v.id));
      this.allResults.videos = [...this.allResults.videos, ...unique];

      // Vai para a nova última página
      this.localPage = Math.ceil(this.allResults.videos.length / (this.perPage || 50));
      this._renderResults(false);
    } catch (e) {
      console.error(e);
      showQuickToast('❌ Erro ao carregar mais: ' + e.message, 'error');
    } finally {
      this._setModalLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════
  // API HELPERS
  // ═══════════════════════════════════════════════════════

  async _apiFetch(endpoint) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const r   = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}${sep}key=${this.API_KEY}`);
    const d   = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d;
  }

  async _fetchPlaylistPage(playlistId, pageToken) {
    let url = `playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${this.API_KEY}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${url}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    this._lastNextPageToken = d.nextPageToken || null;
    return (d.items || [])
      .filter(i => i.snippet.resourceId?.videoId &&
                   i.snippet.title !== 'Deleted video' &&
                   i.snippet.title !== 'Private video')
      .map(i => ({
        id:        i.snippet.resourceId.videoId,
        title:     i.snippet.title,
        thumbnail: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url || ''
      }));
  }

  async _searchPage(q, pageToken) {
    let url = `search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=50&key=${this.API_KEY}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${url}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return {
      items: (d.items || []).map(i => ({
        id:        i.id.videoId,
        title:     i.snippet.title,
        thumbnail: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url || ''
      })),
      nextPageToken: d.nextPageToken || null
    };
  }

  _dedup(items) {
    const seen = new Set();
    return items.filter(i => {
      if (!i.id || seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }

  _resetState() {
    this.allResults      = { videos: [] };
    this.pageTokens      = { videos: null };
    this.pageNumbers     = { videos: 1 };
    this.localPage       = 1;
    this.channelUploadsPlaylistId = null;
    this._lastNextPageToken = null;
  }

  // ═══════════════════════════════════════════════════════
  // MODAL DE RESULTADOS
  // ═══════════════════════════════════════════════════════

  _createResultsModal() {
    if (document.getElementById('smartSearchModal')) return;

    const modal = document.createElement('div');
    modal.id        = 'smartSearchModal';
    modal.className = 'modal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(6px);';
    modal.onclick = e => { if (e.target === modal) this._closeModal(); };

    modal.innerHTML = `
      <div style="
        background:var(--surface2,#0d1b2a);
        border:1px solid rgba(255,153,0,0.12);
        border-radius:18px;
        padding:22px;
        width:95%;
        max-width:720px;
        max-height:90vh;
        overflow-y:auto;
        position:relative;
        box-shadow:0 24px 64px rgba(0,0,0,0.7);
      " onclick="event.stopPropagation()">

        <!-- Linha accent topo -->
        <div style="position:absolute;top:0;left:0;right:0;height:2px;
          background:linear-gradient(90deg,#06b6d4,#FF9900,#ef4444);
          border-radius:18px 18px 0 0;"></div>

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:800;" id="modalTitle">Resultados</h3>
            <span style="font-size:11px;color:var(--muted2,#64748b);font-family:var(--mono);" id="modalSubtitle"></span>
          </div>
          <button id="smartSearchCloseBtn" style="
            background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.07);
            color:var(--muted,#94a3b8);
            padding:6px 14px;
            border-radius:6px;
            font-size:12px;
            font-family:var(--sans);
            cursor:pointer;
            font-weight:700;
            margin-left:0;
            transition:all 0.2s;
          ">✕ Fechar</button>
        </div>

        <!-- Loading -->
        <div id="smartSearchLoading" style="display:none;
          padding:24px;text-align:center;
          color:var(--muted,#94a3b8);
          font-family:var(--mono);
          font-size:13px;">
          ⏳ Buscando...
        </div>

        <!-- Erro -->
        <div id="smartSearchError" style="display:none;
          padding:16px;
          background:rgba(239,68,68,0.08);
          border:1px solid rgba(239,68,68,0.2);
          border-radius:8px;
          color:#ef4444;
          font-size:13px;
          font-family:var(--mono);
          margin-bottom:12px;"></div>

        <!-- Ações de seleção da página atual -->
        <div id="searchPageActions" style="display:none;" class="search-page-actions">
          <div class="search-page-actions-left">
            <button class="btn-check-action" id="checkPageAll">✓ Marcar página</button>
            <button class="btn-check-action" id="checkPageNone">✗ Desmarcar página</button>
            <button class="btn-check-action" id="checkAllBtn">✓ Todos</button>
          </div>
          <span class="search-selected-count" id="searchSelectedCount">
            <strong>0</strong> selecionado(s)
          </span>
        </div>

        <!-- Lista de resultados -->
        <div id="smartSearchTabContent"></div>

        <!-- Paginação -->
        <div id="searchPaginationBar" style="display:none;"></div>

        <!-- Botão adicionar -->
        <button id="smartSearchAddBtn" style="display:none;
          width:100%;
          background:linear-gradient(135deg,#10b981,#059669);
          color:#fff;
          border:none;
          padding:13px;
          border-radius:8px;
          font-size:14px;
          font-weight:800;
          font-family:var(--sans);
          cursor:pointer;
          margin-top:12px;
          margin-left:0;
          box-shadow:0 0 16px rgba(16,185,129,0.2);
          transition:all 0.2s;
        ">✅ Adicionar à Minha Lista</button>

      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('smartSearchCloseBtn').onclick  = () => this._closeModal();
    document.getElementById('smartSearchAddBtn').onclick    = () => this._addSelected();
    document.getElementById('checkPageAll').onclick         = () => this._checkPage(true);
    document.getElementById('checkPageNone').onclick        = () => this._checkPage(false);
    document.getElementById('checkAllBtn').onclick          = () => this._checkAllResults();
  }

  _showModal() {
    const modal = document.getElementById('smartSearchModal');
    if (modal) modal.style.display = 'flex';
  }

  _closeModal() {
    const modal = document.getElementById('smartSearchModal');
    if (modal) modal.style.display = 'none';
  }

  _setModalLoading(on) {
    const el = document.getElementById('smartSearchLoading');
    if (el) el.style.display = on ? 'block' : 'none';
  }

  _setModalError(msg) {
    const el = document.getElementById('smartSearchError');
    if (el) { el.textContent = '❌ ' + msg; el.style.display = 'block'; }
  }

  // ═══════════════════════════════════════════════════════
  // RENDERIZAR RESULTADOS COM PAGINAÇÃO
  // ═══════════════════════════════════════════════════════

  _renderResults(resetPage = true) {
    if (resetPage) this.localPage = 1;

    const all       = this.allResults.videos;
    const perPage   = this.perPage || 50;
    const page      = this.localPage;
    const total     = all.length;
    const totalPages = Math.ceil(total / perPage);
    const start     = (page - 1) * perPage;
    const pageItems = all.slice(start, start + perPage);
    const end       = start + pageItems.length;
    const hasMore   = !!this.pageTokens.videos;

    // Título e subtítulo do modal
    const titleEl    = document.getElementById('modalTitle');
    const subtitleEl = document.getElementById('modalSubtitle');
    if (titleEl)    titleEl.textContent    = `${total} resultado${total !== 1 ? 's' : ''}`;
    if (subtitleEl) subtitleEl.textContent = `página ${page} de ${totalPages} · mostrando ${start+1}–${end}`;

    // Ações de seleção
    const actions = document.getElementById('searchPageActions');
    if (actions) actions.style.display = total > 0 ? 'flex' : 'none';

    // Botão "Todos" com contagem
    const checkAllBtn = document.getElementById('checkAllBtn');
    if (checkAllBtn) checkAllBtn.textContent = `✓ Todos (${total})`;

    // Conteúdo
    const contentDiv = document.getElementById('smartSearchTabContent');
    if (!contentDiv) return;

    if (total === 0) {
      contentDiv.innerHTML = `<p style="color:var(--muted2);font-size:13px;padding:16px;font-family:var(--mono);text-align:center;">Nenhum resultado encontrado.</p>`;
      document.getElementById('smartSearchAddBtn').style.display = 'none';
      document.getElementById('searchPaginationBar').style.display = 'none';
      return;
    }

    contentDiv.innerHTML = pageItems.map((item, i) => `
      <div class="search-result-item" style="cursor:pointer;">
        <input type="checkbox" class="video-checkbox"
               data-video-id="${item.id}" checked
               style="accent-color:#FF9900;width:16px;height:16px;flex-shrink:0;cursor:pointer;">
        <img class="search-result-thumb"
             src="${item.thumbnail || ''}"
             loading="lazy"
             onerror="this.style.opacity='0.2'"
             style="width:64px;height:46px;object-fit:cover;border-radius:5px;background:#1e293b;flex-shrink:0;">
        <span style="flex:1;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              title="${item.title.replace(/"/g,'&quot;')}">${item.title}</span>
      </div>
    `).join('');

    // Clique na linha alterna checkbox
    contentDiv.querySelectorAll('.search-result-item').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb) { cb.checked = !cb.checked; this._updateCounter(); }
      });
    });

    contentDiv.querySelectorAll('.video-checkbox').forEach(cb => {
      cb.addEventListener('change', () => this._updateCounter());
    });

    this._updateCounter();
    document.getElementById('smartSearchAddBtn').style.display = 'block';

    // Paginação
    this._renderPagination(total, perPage, page, totalPages, hasMore);
  }

  _renderPagination(total, perPage, page, totalPages, hasMore) {
    const bar = document.getElementById('searchPaginationBar');
    if (!bar) return;

    if (total === 0) { bar.style.display = 'none'; return; }

    bar.style.display = 'block';
    bar.innerHTML = `
      <div class="search-pagination">
        <div class="search-pagination-info">
          <strong>${total}</strong> carregados
          ${hasMore ? ' <span style="color:var(--muted2)">· mais disponíveis</span>' : ''}
        </div>
        <div class="search-pagination-controls">
          <div class="pagination-per-page">
            <label>por pág.</label>
            <select id="perPageSelect" style="margin-left:0;">
              <option value="25"  ${perPage===25  ?'selected':''}>25</option>
              <option value="50"  ${perPage===50  ?'selected':''}>50</option>
              <option value="100" ${perPage===100 ?'selected':''}>100</option>
            </select>
          </div>
          <button class="btn-pagination" id="pgPrev" ${page<=1?'disabled':''}>← Anterior</button>
          <span class="pagination-page-badge">${page} / ${totalPages}</span>
          <button class="btn-pagination" id="pgNext" ${page>=totalPages?'disabled':''}>Próxima →</button>
          ${hasMore ? `<button class="btn-pagination load-more" id="pgLoadMore">⬇ Carregar mais (pág. ${this.pageNumbers.videos+1})</button>` : ''}
        </div>
      </div>
    `;

    document.getElementById('pgPrev')?.addEventListener('click', () => {
      this.localPage = Math.max(1, page - 1);
      this._renderResults(false);
    });

    document.getElementById('pgNext')?.addEventListener('click', () => {
      this.localPage = Math.min(totalPages, page + 1);
      this._renderResults(false);
    });

    document.getElementById('pgLoadMore')?.addEventListener('click', () => this.loadNextPage());

    document.getElementById('perPageSelect')?.addEventListener('change', e => {
      this.perPage   = parseInt(e.target.value);
      this.localPage = 1;
      this._renderResults(false);
    });
  }

  // ═══════════════════════════════════════════════════════
  // SELEÇÃO
  // ═══════════════════════════════════════════════════════

  _updateCounter() {
    const checked = document.querySelectorAll('#smartSearchTabContent .video-checkbox:checked').length;
    const el = document.getElementById('searchSelectedCount');
    if (el) el.innerHTML = `<strong>${checked}</strong> selecionado(s) nesta página`;
  }

  _checkPage(checked) {
    document.querySelectorAll('#smartSearchTabContent .video-checkbox')
      .forEach(cb => { cb.checked = checked; });
    this._updateCounter();
  }

  _checkAllResults() {
    // Marca todos na página e sinaliza "select all"
    this._checkPage(true);
    const content = document.getElementById('smartSearchTabContent');
    if (content) content.dataset.selectAll = 'true';
    const el = document.getElementById('searchSelectedCount');
    if (el) el.innerHTML = `<strong>${this.allResults.videos.length}</strong> — TODOS selecionados`;
  }

  // ═══════════════════════════════════════════════════════
  // ADICIONAR À LISTA
  // ═══════════════════════════════════════════════════════

  _addSelected() {
    const content     = document.getElementById('smartSearchTabContent');
    const isSelectAll = content?.dataset.selectAll === 'true';

    let selected;

    if (isSelectAll) {
      // Usuário clicou "✓ Todos" — usa todos os resultados carregados
      selected = [...this.allResults.videos];
      delete content.dataset.selectAll;
    } else {
      const allBoxes     = Array.from(document.querySelectorAll('#smartSearchTabContent .video-checkbox'));
      const checkedBoxes = allBoxes.filter(cb => cb.checked);

      // Se TODOS os checkboxes visíveis estão marcados (estado padrão),
      // usa a lista completa de allResults — não apenas a página atual.
      // Corrige problema de paginação e leitura incorreta de checkboxes.
      if (allBoxes.length > 0 && checkedBoxes.length === allBoxes.length) {
        selected = [...this.allResults.videos];
      } else {
        const ids = checkedBoxes.map(cb => cb.dataset.videoId).filter(Boolean);
        selected  = this.allResults.videos.filter(v => ids.includes(v.id));
      }
    }

    if (selected.length === 0) {
      showQuickToast('\u26a0\ufe0f Nenhum vídeo selecionado', 'warn');
      return;
    }

    if (selected.length > 20) {
      this._showBatchModal(selected);
      return;
    }

    this._commit(selected);
  }

  _commit(videos) {
    if (typeof playlist === 'undefined') return;

    const batch = this._dedup(videos);
    let added   = 0;

    batch.forEach(v => {
      if (!playlist.find(p => p.id === v.id)) {
        playlist.push({
          id:         v.id,
          title:      v.title,
          thumbnail:  v.thumbnail || '',
          categoryId: this.selectedCategory
        });
        added++;
      }
    });

    if (window.savePlaylist)          savePlaylist();
    if (window.renderPlaylist)        renderPlaylist();
    if (window.renderCategoryFilters) renderCategoryFilters();

    this._closeModal();
    showQuickToast(`✅ ${added} vídeo${added !== 1 ? 's' : ''} adicionado${added !== 1 ? 's' : ''}!`);
  }

  // ═══════════════════════════════════════════════════════
  // MODAL DE LOTE GRANDE
  // ═══════════════════════════════════════════════════════

  _showBatchModal(selected) {
    document.getElementById('batchConfirmModal')?.remove();

    const modal = document.createElement('div');
    modal.id    = 'batchConfirmModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10001;display:flex;align-items:center;justify-content:center;';

    const total = selected.length;
    modal.innerHTML = `
      <div style="background:#0d1b2a;border:1px solid rgba(255,153,0,0.15);border-radius:16px;padding:24px;max-width:400px;width:95%;color:#f1f5f9;position:relative;overflow:hidden;" onclick="event.stopPropagation()">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#06b6d4,#FF9900,#ef4444);"></div>
        <div style="text-align:center;font-size:26px;margin-bottom:8px;">⚠️</div>
        <h3 style="margin:0 0 10px;text-align:center;color:#f97316;font-family:var(--sans);">Lote grande</h3>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:18px;line-height:1.6;text-align:center;">
          Você selecionou <strong style="color:#fff">${total} vídeos</strong>. Quantos deseja adicionar?
        </p>
        <div style="background:#060B14;border-radius:8px;padding:14px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="range" id="batchSlider" min="1" max="${total}" value="${total}"
              style="flex:1;accent-color:#FF9900;"
              oninput="document.getElementById('batchVal').textContent=this.value">
            <span id="batchVal" style="font-size:20px;font-weight:800;color:#FF9900;min-width:36px;text-align:right;">${total}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;margin-top:4px;font-family:var(--mono);">
            <span>1</span><span>${total}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="batchOk" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:12px;border-radius:8px;font-size:14px;font-weight:800;font-family:var(--sans);cursor:pointer;margin-left:0;">
            ✅ Adicionar quantidade selecionada
          </button>
          <button id="batchAll" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.07);padding:10px;border-radius:8px;font-size:12px;font-family:var(--sans);cursor:pointer;margin-left:0;">
            Adicionar todos os ${total}
          </button>
          <button id="batchCancel" style="background:transparent;color:#64748b;border:none;padding:8px;border-radius:8px;font-size:12px;font-family:var(--sans);cursor:pointer;margin-left:0;">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#batchOk').onclick = () => {
      // Captura o valor ANTES de remover o modal do DOM
      const sliderEl = modal.querySelector('#batchSlider');
      const n = sliderEl ? parseInt(sliderEl.value) || total : total;
      modal.remove();
      this._commit(selected.slice(0, n));
    };
    modal.querySelector('#batchAll').onclick    = () => { modal.remove(); this._commit(selected); };
    modal.querySelector('#batchCancel').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
  }

  // ═══════════════════════════════════════════════════════
  // API KEY
  // ═══════════════════════════════════════════════════════

  _checkApiKey() {
    this.API_KEY = localStorage.getItem('youtube_api_key');
    if (!this.API_KEY) {
      this._showApiKeyModal();
      return false;
    }
    return true;
  }

  _createApiKeyModal() {
    if (document.getElementById('apiKeyModal')) return;

    const modal = document.createElement('div');
    modal.id        = 'apiKeyModal';
    modal.className = 'modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10001;align-items:center;justify-content:center;backdrop-filter:blur(6px);';
    modal.onclick = e => { if (e.target === modal) modal.style.display='none'; };

    modal.innerHTML = `
      <div style="background:#0d1b2a;border:1px solid rgba(255,153,0,0.15);border-radius:18px;padding:28px;width:90%;max-width:460px;position:relative;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.7);" onclick="event.stopPropagation()">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#06b6d4,#FF9900,#ef4444);border-radius:18px 18px 0 0;"></div>
        <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;font-family:var(--sans);">🔑 Configurar API Key do YouTube</h3>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px;line-height:1.6;">
          Para buscar vídeos por canal ou texto, você precisa de uma chave gratuita da YouTube Data API v3.
        </p>
        <div style="background:rgba(16,185,129,0.08);border-left:3px solid #10b981;padding:10px 12px;border-radius:6px;margin-bottom:16px;font-size:12px;color:#10b981;font-family:var(--mono);">
          ✓ Gratuito — Google oferece 10.000 requisições/dia
        </div>
        <ol style="font-size:13px;color:#cbd5e1;line-height:1.9;padding-left:20px;margin:0 0 18px;">
          <li>Acesse <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:#06b6d4;">console.cloud.google.com/apis/credentials</a></li>
          <li>Crie um projeto → "Criar credenciais" → "Chave de API"</li>
          <li>Ative a "YouTube Data API v3"</li>
          <li>Cole a chave abaixo</li>
        </ol>
        <input type="password" id="apiKeyInput" placeholder="AIzaSy..."
          style="width:100%;box-sizing:border-box;background:#060B14;border:1.5px solid #1e293b;border-radius:8px;color:#f1f5f9;font-size:14px;font-family:var(--sans);padding:12px 14px;outline:none;margin-bottom:12px;transition:border-color 0.2s;">
        <button id="saveApiKeyBtn" style="width:100%;background:linear-gradient(135deg,#FF9900,#f59e0b);color:#000;border:none;padding:12px;border-radius:8px;font-size:14px;font-weight:800;font-family:var(--sans);cursor:pointer;margin-left:0;margin-bottom:8px;">
          💾 Salvar e Continuar
        </button>
        <button id="cancelApiKeyBtn" style="width:100%;background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.07);padding:10px;border-radius:8px;font-size:13px;font-family:var(--sans);cursor:pointer;margin-left:0;">
          Cancelar
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#saveApiKeyBtn').onclick = () => {
      const input = modal.querySelector('#apiKeyInput');
      const key   = input.value.trim();
      if (!key) { input.style.borderColor='#ef4444'; return; }
      if (!key.startsWith('AIza')) {
        showQuickToast('⚠️ Chave inválida — deve começar com "AIza"', 'warn');
        return;
      }
      localStorage.setItem('youtube_api_key', key);
      this.API_KEY = key;
      modal.style.display = 'none';
      showQuickToast('✅ API Key salva! Pode buscar agora.');
    };

    modal.querySelector('#cancelApiKeyBtn').onclick = () => { modal.style.display='none'; };

    modal.querySelector('#apiKeyInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') modal.querySelector('#saveApiKeyBtn').click();
    });
  }

  _showApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => modal.querySelector('#apiKeyInput')?.focus(), 100);
    }
  }

  // Compatibilidade com chamadas externas
  openSmartSearchModal() {
    const input = document.getElementById('urlInput');
    if (input) input.focus();
  }

  checkAndRequestApiKey() { return this._checkApiKey(); }
  showApiKeyModal()        { this._showApiKeyModal(); }
  closeSmartSearchModal()  { this._closeModal(); }
}

// ═══════════════════════════════════════════════════════
// TOAST GLOBAL
// ═══════════════════════════════════════════════════════

function showQuickToast(message, type = 'success') {
  // Remove toast anterior
  document.getElementById('dylist-toast')?.remove();

  const colors = {
    success: 'rgba(16,185,129,0.95)',
    error:   'rgba(239,68,68,0.95)',
    warn:    'rgba(245,158,11,0.95)',
    info:    'rgba(6,182,212,0.95)',
  };

  const toast = document.createElement('div');
  toast.id = 'dylist-toast';
  toast.style.cssText = `
    position:fixed;
    top:20px;
    right:20px;
    background:${colors[type] || colors.success};
    color:#fff;
    padding:12px 20px;
    border-radius:10px;
    font-size:14px;
    font-weight:700;
    font-family:'Syne',sans-serif;
    z-index:20000;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    max-width:360px;
    line-height:1.4;
    animation:fadeIn 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 350);
  }, 2800);
}

// ═══════════════════════════════════════════════════════
// FUNÇÕES GLOBAIS — compatibilidade com app.js / categories.js
// ═══════════════════════════════════════════════════════

function isChannelUrl(url) {
  if (!url) return false;
  return /youtube\.com\/@[\w.-]+|youtube\.com\/channel\/UC[\w-]+|youtube\.com\/c\/[\w-]+|youtube\.com\/user\/[\w-]+/.test(url);
}

function extractChannelIdentifier(url) {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/@([\w.-]+)/) || path.match(/\/channel\/(UC[\w-]+)/) || path.match(/\/c\/([\w-]+)/) || path.match(/\/user\/([\w-]+)/);
    if (!m) return null;
    return { type: 'handle', value: m[0].startsWith('@') ? m[0] : m[1] };
  } catch (_) { return null; }
}

async function fetchChannelVideos(channelInfo) {
  if (window.smartSearchInstance) {
    return window.smartSearchInstance._fetchPlaylistPage('stub', null);
  }
  return [];
}

function showChannelVideosModal(videos, channelName) {
  if (window.smartSearchInstance) {
    window.smartSearchInstance.allResults.videos = videos;
    window.smartSearchInstance._showModal();
    window.smartSearchInstance._renderResults();
  }
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '255,255,255';
  return `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`;
}

// ── Inicialização ──────────────────────────────────────
setTimeout(() => {
  window.smartSearchInstance = new SmartSearch();
  console.log('%c🔍 iList Smart Input ativo', 'color:#FF9900;font-weight:800;font-size:13px;');
}, 500);