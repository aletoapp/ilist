/**
 * PATCH — search-advanced.js
 * Substituir os métodos displayResults() e displayTabsWithResults()
 * por versão com paginação real (50/pág, anterior/próxima, selecionar página)
 *
 * Como aplicar:
 *   1. Abra search-advanced.js
 *   2. Substitua displayResults() e displayTabsWithResults() pelos de baixo
 *   3. Adicione a propriedade this.perPage = 50 no constructor, após this.pageNumbers
 */

// ─── Adicionar no constructor, após this.pageNumbers = { videos: 1 }:
//     this.perPage = 50;
//     this.localPage = 1;   // página local dentro dos resultados já carregados

// ─── SUBSTITUIR displayTabsWithResults() ───────────────────────────────────
displayTabsWithResults(resetTab = true) {
  document.getElementById('smartSearchResults').style.display = 'block';
  document.getElementById('smartSearchTabs').style.display = 'block';

  const tab = document.querySelector('.smart-tab[data-tab="videos"]');
  if (tab) tab.querySelector('.tab-count').textContent = `(${this.allResults.videos.length})`;

  const badge = document.getElementById('smartSearchSourceBadge');
  if (badge) { badge.textContent = '▶ YouTube'; badge.style.color = '#ef4444'; }

  if (resetTab) {
    this.localPage = 1;
    document.getElementById('smartSearchNextBtn')?.remove();
  }

  this.displayResults('videos');
}

// ─── SUBSTITUIR displayResults() ───────────────────────────────────────────
displayResults(tabName) {
  const allItems   = this.allResults[tabName] || [];
  const perPage    = this.perPage || 50;
  const localPage  = this.localPage || 1;
  const totalPages = Math.ceil(allItems.length / perPage);
  const start      = (localPage - 1) * perPage;
  const pageItems  = allItems.slice(start, start + perPage);

  const contentDiv    = document.getElementById('smartSearchTabContent');
  const quantityWrap  = document.getElementById('smartSearchQuantityWrapper');
  const addBtn        = document.getElementById('smartSearchAddBtn');

  if (allItems.length === 0) {
    contentDiv.innerHTML = `<p style="color:var(--muted2);font-size:13px;padding:10px;font-family:var(--mono);">Nenhum resultado encontrado.</p>`;
    if (quantityWrap) quantityWrap.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    document.getElementById('smartSearchNextBtn')?.remove();
    this._removePaginationUI();
    return;
  }

  // ── Cabeçalho da página: selecionar / desmarcar ──────────────────────────
  const pageActionsHtml = `
    <div class="search-page-actions">
      <div class="search-page-actions-left">
        <button class="btn-check-action" id="checkPageAll">✓ Marcar página</button>
        <button class="btn-check-action" id="checkPageNone">✗ Desmarcar página</button>
        <button class="btn-check-action" id="checkAll">✓ Todos (${allItems.length})</button>
      </div>
      <span class="search-selected-count" id="searchSelectedCount">
        <strong>0</strong> selecionado(s)
      </span>
    </div>
  `;

  // ── Lista de itens ────────────────────────────────────────────────────────
  const itemsHtml = pageItems.map((item, i) => `
    <div class="search-result-item" data-idx="${start + i}">
      <input type="checkbox" class="video-checkbox"
             data-video-id="${item.id}" checked>
      <img class="search-result-thumb"
           src="${item.thumbnail || ''}"
           loading="lazy"
           onerror="this.style.opacity='0'">
      <span class="search-result-title" title="${item.title}">${item.title}</span>
    </div>
  `).join('');

  contentDiv.innerHTML = pageActionsHtml + itemsHtml;

  // ── Atualiza contador de selecionados ─────────────────────────────────────
  const updateCounter = () => {
    // Contar checkboxes marcados nesta página
    const checked = contentDiv.querySelectorAll('.video-checkbox:checked').length;
    const countEl = document.getElementById('searchSelectedCount');
    if (countEl) countEl.innerHTML = `<strong>${checked}</strong> selecionado(s) nesta página`;
  };

  contentDiv.querySelectorAll('.video-checkbox').forEach(cb => {
    cb.addEventListener('change', updateCounter);
  });

  // Clique na linha também alterna o checkbox
  contentDiv.querySelectorAll('.search-result-item').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.tagName === 'INPUT') return; // já tratado
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) { cb.checked = !cb.checked; updateCounter(); }
    });
  });

  // ── Ações: marcar / desmarcar ────────────────────────────────────────────
  document.getElementById('checkPageAll')?.addEventListener('click', () => {
    contentDiv.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = true);
    updateCounter();
  });

  document.getElementById('checkPageNone')?.addEventListener('click', () => {
    contentDiv.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
    updateCounter();
  });

  document.getElementById('checkAll')?.addEventListener('click', () => {
    // Marca todos os resultados via dataset temporário
    contentDiv.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = true);
    // Sinaliza que é pra adicionar todos, não só a página
    contentDiv.dataset.selectAll = 'true';
    updateCounter();
    const countEl = document.getElementById('searchSelectedCount');
    if (countEl) countEl.innerHTML = `<strong>${allItems.length}</strong> selecionado(s) — TODOS os resultados`;
  });

  updateCounter();

  if (quantityWrap) quantityWrap.style.display = 'block';
  if (addBtn) addBtn.style.display = 'block';

  // ── UI de paginação ───────────────────────────────────────────────────────
  this._renderPaginationUI(allItems, perPage, localPage, totalPages, tabName);
}

// ─── NOVO: renderizar barra de paginação ────────────────────────────────────
_renderPaginationUI(allItems, perPage, localPage, totalPages, tabName) {
  // Remove UI anterior
  this._removePaginationUI();

  const contentDiv = document.getElementById('smartSearchTabContent');
  if (!contentDiv) return;

  const hasMore = !!this.pageTokens?.videos; // pode buscar mais na API
  const start   = (localPage - 1) * perPage;
  const end     = Math.min(start + perPage, allItems.length);

  const paginationHtml = `
    <div class="search-pagination" id="searchPaginationBar">

      <div class="search-pagination-info">
        Exibindo <strong>${start + 1}–${end}</strong> de
        <strong>${allItems.length}</strong> carregados
        ${hasMore ? `<span style="color:var(--muted2)"> (mais disponíveis)</span>` : ''}
      </div>

      <div class="search-pagination-controls">

        <div class="pagination-per-page">
          <label>por pág.</label>
          <select id="perPageSelect">
            <option value="25"  ${perPage===25  ?'selected':''}>25</option>
            <option value="50"  ${perPage===50  ?'selected':''}>50</option>
            <option value="100" ${perPage===100 ?'selected':''}>100</option>
          </select>
        </div>

        <button class="btn-pagination" id="pgPrev"
          ${localPage <= 1 ? 'disabled' : ''}>← Anterior</button>

        <span class="pagination-page-badge">
          ${localPage} / ${totalPages}
        </span>

        <button class="btn-pagination" id="pgNext"
          ${localPage >= totalPages ? 'disabled' : ''}>Próxima →</button>

        ${hasMore ? `
          <button class="btn-pagination load-more" id="pgLoadMore">
            ⬇ Carregar mais da API (pág. ${(this.pageNumbers?.videos || 1) + 1})
          </button>
        ` : ''}
      </div>

    </div>
  `;

  contentDiv.insertAdjacentHTML('afterend', paginationHtml);

  // Eventos
  document.getElementById('pgPrev')?.addEventListener('click', () => {
    this.localPage = Math.max(1, localPage - 1);
    this.displayResults(tabName);
  });

  document.getElementById('pgNext')?.addEventListener('click', () => {
    this.localPage = Math.min(totalPages, localPage + 1);
    this.displayResults(tabName);
  });

  document.getElementById('pgLoadMore')?.addEventListener('click', () => {
    this.loadNextPage();
  });

  document.getElementById('perPageSelect')?.addEventListener('change', (e) => {
    this.perPage = parseInt(e.target.value);
    this.localPage = 1;
    this.displayResults(tabName);
  });
}

// ─── NOVO: remover barra de paginação anterior ──────────────────────────────
_removePaginationUI() {
  document.getElementById('searchPaginationBar')?.remove();
  document.getElementById('smartSearchNextBtn')?.remove();
}

// ─── SUBSTITUIR addVideosToCategory() ──────────────────────────────────────
// (para respeitar o "Marcar Todos" cross-page)
addVideosToCategory() {
  const contentDiv = document.getElementById('smartSearchTabContent');
  const isSelectAll = contentDiv?.dataset.selectAll === 'true';

  let selected;

  if (isSelectAll) {
    // Adicionar todos os resultados carregados
    selected = [...this.allResults.videos];
    delete contentDiv.dataset.selectAll;
  } else {
    // Apenas os checkboxes visíveis e marcados na página atual
    const checkboxes = contentDiv.querySelectorAll('.video-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.videoId);
    selected = this.allResults.videos.filter(v => selectedIds.includes(v.id));
  }

  if (selected.length === 0) {
    alert('Nenhum vídeo selecionado!');
    return;
  }

  const WARN_THRESHOLD = 20;
  if (selected.length > WARN_THRESHOLD) {
    this._showBatchConfirmModal(selected, 500);
    return;
  }

  this._commitVideos(selected);
}
