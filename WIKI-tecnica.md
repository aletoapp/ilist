# DyList — Documentação Técnica

> Versão 4.0 · Última atualização: 2026

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Módulo: app.js](#2-módulo-appjs)
3. [Módulo: player.js](#3-módulo-playerjs)
4. [Módulo: categories.js](#4-módulo-categoriesjs)
5. [Módulo: search-advanced.js](#5-módulo-search-advancedjs)
6. [Módulo: equalizer.js](#6-módulo-equalizerjs)
7. [Módulo: ad-blocker.js / premium.js](#7-módulo-ad-blockerjs--premiumjs)
8. [Módulo: backup.js](#8-módulo-backupjs)
9. [Módulo: sidebar.js](#9-módulo-sidebarjs)
10. [Módulo: onboarding.js](#10-módulo-onboardingjs)
11. [Módulo: pwa.js + sw.js](#11-módulo-pwajs--swjs)
12. [Módulo: statistics.js](#12-módulo-statisticsjs)
13. [Design System (styles.css)](#13-design-system-stylescss)
14. [Fluxo de dados e localStorage](#14-fluxo-de-dados-e-localstorage)
15. [Hierarquia de z-index](#15-hierarquia-de-z-index)
16. [Atalhos de teclado](#16-atalhos-de-teclado)
17. [API YouTube Data v3 — endpoints usados](#17-api-youtube-data-v3--endpoints-usados)
18. [Guia de contribuição](#18-guia-de-contribuição)

---

## 1. Visão Geral da Arquitetura

O DyList é uma **Single Page Application** sem framework, sem bundler e sem dependências npm. Todo o código roda diretamente no navegador a partir de arquivos estáticos.

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                       │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │      .box (main)    │  │   .playlist (sidebar)    │  │
│  │  título + inputs    │  │  category-filters        │  │
│  │  modais de categoria│  │  playlist-items          │  │
│  │  player YouTube     │  │  controles sidebar       │  │
│  │  player-controls    │  └──────────────────────────┘  │
│  │  playlist-zone      │                                 │
│  │  utility + footer   │                                 │
│  └─────────────────────┘                                 │
└─────────────────────────────────────────────────────────┘

Scripts carregados em ordem:
  categories.js → app.js → player.js → ad-blocker.js
  → pwa.js → search-advanced.js → backup.js
  → equalizer.js → sidebar.js
```

**Comunicação entre módulos:** via variáveis globais (`playlist`, `currentFilter`, `player`) e funções globais expostas explicitamente (`window.renderPlaylist`, `window.savePlaylist`, `window.getCategoryById`, etc.).

---

## 2. Módulo: app.js

**Responsabilidade:** núcleo da aplicação — gerencia a playlist em memória, renderização dos itens, drag & drop e ações destrutivas.

### Variáveis globais expostas

| Variável | Tipo | Descrição |
|---|---|---|
| `playlist` | `Array<{id, title, categoryId}>` | Lista em memória — fonte de verdade |
| `currentIndex` | `number` | Índice atual na `playQueue` |
| `playQueue` | `number[]` | Fila de índices a reproduzir |
| `wakeLock` | `WakeLockSentinel \| null` | Referência ao Wake Lock ativo |

### Funções principais

#### `renderPlaylist()`
Re-renderiza todos os itens do `#playlistContainer` com base em `currentFilter`.
- Se `currentFilter === 'all'`, exibe mensagem informativa com total de vídeos.
- Caso contrário, filtra `playlist` por `categoryId` e cria elementos `.playlist-item`.
- Chama `initDragAndDrop()` e `initCheckboxes()` após renderizar.

#### `savePlaylist()`
Serializa `playlist` para `localStorage` como JSON. Garante que todos os itens tenham `categoryId`.

#### `loadPlaylist()`
Lê `localStorage`, faz parse e chama `renderPlaylist()` + `renderCategoryFilters()`.

#### `addToPlaylist()`
Ponto de entrada do botão "Adicionar" (legado). Detecta se é URL de canal (delega para `SmartSearch`) ou vídeo direto. Usa `fetchVideoTitle()` via oEmbed para obter o título sem API key.

#### `showCategorySelectModal(videos)`
Adiciona um array de vídeos à categoria ativa (`currentFilter`) sem abrir modal de seleção. É o ponto de commit usado pelo fluxo legado.

#### `deleteSelected()`
Remove da `playlist` todos os vídeos cujos checkboxes estão marcados.

#### `clearAll()`
Esvazia `playlist` completamente após confirmação no `#confirmModal`.

#### `ativarModoEscuro()` / `desativarModoEscuro()`
Exibe / oculta o `#darkOverlay` preto e solicita / libera o Wake Lock da tela.

### Drag & Drop

Implementado via eventos nativos HTML5 (`dragstart`, `dragover`, `drop`, `dragend`).

```
dragstart → guarda referência em `draggedElement`
dragover  → chama getDragAfterElement() para encontrar posição e move o nó no DOM
dragend   → chama reorderPlaylist() para sincronizar o array `playlist`
```

`reorderPlaylist()` lê a ordem atual dos `.playlist-item` no DOM e reconstrói `playlist` nessa ordem, depois chama `savePlaylist()`.

---

## 3. Módulo: player.js

**Responsabilidade:** integração com a YouTube IFrame Player API, controles de reprodução, loop, velocidade, timer e Media Session.

### Ciclo de vida do player

```
1. Script YouTube API injetado dinamicamente
2. window.onYouTubeIframeAPIReady() disparado
3. initializePlayer() cria new YT.Player('#player', {...})
4. onPlayerReady() → apiReady = true, restaura velocidade e timer salvos
5. onPlayerStateChange() → gerencia PLAYING, PAUSED, ENDED
```

### Modos de loop

| Modo | `loopMode` | Comportamento ao terminar |
|---|---|---|
| Normal | `'none'` | Avança para o próximo; para no final |
| Repetir 1 | `'one'` | Recarrega o mesmo vídeo |
| Repetir Todos | `'all'` | Avança; volta ao início ao terminar a fila |
| Aleatório | `'shuffle'` | Escolhe índice aleatório na `playQueue` |

### Timer de desligamento

```
setAutoShutdown(minutes)
  → calcula shutdownTime = Date.now() + minutes * 60 * 1000
  → salva em localStorage('auto_shutdown_time')
  → cria setTimeout que pausa o player e fecha a janela
  → chama updateTimerCountdown() para exibir contagem regressiva
```

O timer é **persistido** no `localStorage` e restaurado em `checkAutoShutdownTimer()` quando a página recarrega — o tempo restante é recalculado e um novo `setTimeout` é criado.

### Barra de progresso

`startProgressUpdater()` cria um `setInterval` de 1 segundo que lê `getCurrentTime()` e `getDuration()` do player e atualiza `#progressBar`, `#currentTime` e `#duration`.

### Media Session API

`updateMediaSession(title)` registra metadados e handlers para os controles de mídia do sistema operacional (notificação, fone de ouvido, tela de bloqueio):
- `play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`

---

## 4. Módulo: categories.js

**Responsabilidade:** CRUD de categorias, filtro de playlist, emoji picker e drag & drop de reordenação.

### Estrutura de uma categoria

```js
{
  id:    'cat_1712345678901',  // 'uncategorized' para a categoria padrão
  name:  '🎵 Lo-fi',
  color: '#3b82f6'
}
```

### Variáveis globais

| Variável | Tipo | Descrição |
|---|---|---|
| `categories` | `Category[]` | Array em memória |
| `currentFilter` | `string` | ID da categoria selecionada ou `'all'` |
| `editingCategoryId` | `string \| null` | ID em edição no modal |

### `renderCategoryFilters()`

Gera um `<select>` no `#categoryFilters` com todas as categorias + opção "Todas".  
A categoria "Sem Categoria" (`uncategorized`) é sempre exibida por último.  
Ao mudar a seleção, atualiza `currentFilter` e chama `renderPlaylist()`.

### Emoji Picker

Construído em JS puro, sem dependências externas:
- `injectEmojiUI()` — envolve o input de nome em um wrapper e injeta o botão 😊
- `buildEmojiPicker()` — cria o painel com tabs por categoria (`EMOJI_CATEGORIES`)
- `switchEmojiTab(idx)` — renderiza os emojis da tab selecionada
- `insertEmoji(emoji)` — insere no cursor do input usando `selectionStart/End`

### Drag & Drop de categorias

Usa eventos nativos HTML5 no `#categoriesList`. A ordem é salva imediatamente em `localStorage` após cada `drop`.

---

## 5. Módulo: search-advanced.js

**Responsabilidade:** entrada inteligente unificada — detecta o tipo de input e aciona o fluxo correto.

### Classe `SmartSearch`

#### Detecção de tipo (`_detectType(input)`)

```
URL válida?
  ├── youtu.be → 'video'
  ├── youtube.com?v=xxx (sem list) → 'video'
  ├── youtube.com?list=xxx → 'playlist'
  ├── youtube.com/@handle | /channel/ | /c/ | /user/ → 'canal'
  └── outro domínio → 'busca'
Não é URL → 'busca'
```

#### Fluxo por tipo

**`video`** — sem API:
1. Extrai `videoId` da URL
2. Busca título via `youtube.com/oembed`
3. Chama `playlist.push()` + `savePlaylist()` + `renderPlaylist()`
4. Toast de confirmação

**`canal`** — requer API key:
1. Resolve `uploadsPlaylistId` via `channels?part=contentDetails&forHandle=@xxx`
2. Busca vídeos via `_fetchPlaylistPage(uploadsId)`
3. Abre modal de resultados com paginação

**`playlist`** — requer API key:
1. Extrai `list` da URL
2. Busca itens via `_fetchPlaylistPage(playlistId)`
3. Abre modal de resultados com paginação

**`busca`** — requer API key:
1. Chama `search?part=snippet&q=...&type=video&maxResults=50`
2. Abre modal de resultados com paginação

#### Paginação

Os resultados são armazenados em `this.allResults.videos[]`. A paginação é **local** (slices do array) com opção de carregar mais da API via `loadNextPage()` (usa o `nextPageToken` do YouTube).

```
allResults.videos  — todos carregados até agora
localPage          — página exibida atualmente
perPage            — itens por página (25 / 50 / 100)
pageTokens.videos  — nextPageToken da API (para carregar mais)
```

#### Gestão de API Key

Se a chave não estiver salva, `_checkApiKey()` guarda o valor pendente em `this._pendingSearch` e abre `#apiKeyModal`. Ao salvar a chave, `_pendingSearch` é retomado automaticamente.

#### Modal de lote grande (`_showBatchModal`)

Quando o usuário tenta adicionar mais de 20 vídeos de uma vez, um modal com slider aparece perguntando quantos adicionar (1 … N).

---

## 6. Módulo: equalizer.js

**Responsabilidade:** equalizador paramétrico de 8 bandas usando Web Audio API.

### Cadeia de processamento

```
MediaElementSource (vídeo/áudio capturado)
  → BiquadFilter[0]  60Hz   (lowshelf)
  → BiquadFilter[1]  170Hz  (peaking)
  → BiquadFilter[2]  310Hz  (peaking)
  → BiquadFilter[3]  600Hz  (peaking)
  → BiquadFilter[4]  1kHz   (peaking)
  → BiquadFilter[5]  3kHz   (peaking)
  → BiquadFilter[6]  6kHz   (peaking)
  → BiquadFilter[7]  14kHz  (highshelf)
  → GainNode (ganho mestre)
  → AudioContext.destination
```

### Captura de áudio

`tryHookPageAudio()` tenta capturar o elemento `<video>` dentro do iframe do YouTube via `audioCtx.createMediaElementSource()`. Se CORS impedir, o equalizador opera em **modo visual** (o espectro anima baseado nos valores dos sliders, mas não processa o áudio real).

### Fallback de volume

Quando em modo visual e o player está acessível, `applyVolumeHint()` ajusta o volume do YouTube proporcionalmente ao boost de graves como aproximação.

### Presets disponíveis

| Nome | Ganhos (60Hz → 14kHz) |
|---|---|
| Normal | `[0, 0, 0, 0, 0, 0, 0, 0]` |
| Clareza | `[-2, -1, 0, 2, 4, 5, 4, 3]` |
| Ambiente | `[4, 3, 2, 1, -1, -1, 2, 3]` |
| Surround | `[3, 2, 0, -1, -1, 0, 2, 3]` |
| Reforço Graves | `[6, 5, 4, 2, 0, -1, -1, -2]` |

### Espectro animado

`drawSpectrum()` usa `requestAnimationFrame` para renderizar 40 barras no `<canvas>` com gradiente ciano → azul → laranja. A altura de cada barra é proporcional ao ganho da banda EQ correspondente mais uma componente senoidal de pulsação (`eqAnimPhase`).

---

## 7. Módulo: ad-blocker.js / premium.js

**Responsabilidade:** bloqueio de anúncios externos e pulo de segmentos patrocinados.

### Duas implementações

O projeto tem dois módulos de bloqueio com a mesma responsabilidade (legado `ad-blocker.js` + refatorado `premium.js`). Ambos instanciam em `window.youlistAdBlocker` — o último a carregar vence.

### Estratégia 1 — CSS Blocking

```css
/* Bloqueia elementos com seletores de anúncio FORA do player */
[class*="ad-container"]:not(#player):not(#player *) { display: none !important; }

/* PROTEÇÃO explícita — nunca bloqueia o player */
#player, iframe[src*="youtube.com/embed"] { display: block !important; }
```

### Estratégia 2 — DOM MutationObserver

`MutationObserver` observa `document.body` com `{ childList: true, subtree: true }`. Para cada nó adicionado, verifica se corresponde a seletores de anúncio E se não é descendente de `#player`.

### Estratégia 3 — SponsorSkip

`setInterval` de 1 segundo verifica se o tempo atual do player está dentro de algum segmento salvo em `sponsorDatabase`. Se sim, faz `seekTo(segment.end + 0.5)`.

**Estrutura do banco de segmentos:**
```js
{
  "videoId_ABC": [
    { start: 45.2, end: 78.5, category: "sponsor" },
    { start: 210.0, end: 225.0, category: "sponsor" }
  ]
}
```

Persistido em `localStorage('youlist_sponsor_segments')`.

---

## 8. Módulo: backup.js

**Responsabilidade:** exportar e importar todos os dados do app em um único arquivo JSON.

### Estrutura do arquivo de backup

```json
{
  "version": "2.0",
  "timestamp": "2026-03-15T14:22:00.000Z",
  "data": {
    "playlist": [...],
    "categories": [...],
    "playback_speed": "1.25",
    "loop_mode": "all",
    "play_history": [...],
    "sponsor_segments": {...},
    "youtube_api_key": "AIza...",
    "followed_insta": "true"
  },
  "stats": {
    "totalVideos": 42,
    "totalCategories": 5,
    "totalPlayHistory": 128,
    "totalSponsorSegments": 3
  }
}
```

### Backup automático

- A cada **30 minutos** via `setInterval`
- No evento `beforeunload` (ao fechar/navegar)
- Salvo em `localStorage('dylist_auto_backup')` — não faz download automático

---

## 9. Módulo: sidebar.js

**Responsabilidade:** sidebar deslizante de tutoriais em vídeo.

### Classe `TutorialSidebar`

- Cria overlay + sidebar via JavaScript puro (nenhum elemento no HTML)
- A sidebar desliza da **direita** com animação CSS `transition: right 0.4s`
- Cada card de tutorial abre um modal com `<iframe>` do YouTube (autoplay)
- O iframe é limpo (`src = ''`) ao fechar para parar o vídeo

### Seção de API Key na sidebar

O rodapé da sidebar inclui um formulário oculto para trocar a API Key, que ao salvar sincroniza imediatamente com `window.smartSearchInstance.API_KEY`.

### API pública

```js
window.tutorialSidebar.openSidebar()
window.tutorialSidebar.closeSidebar()
window.openTutorials()   // alias global
window.closeTutorials()  // alias global
```

---

## 10. Módulo: onboarding.js

**Responsabilidade:** tour guiado de 4 passos no primeiro acesso.

### Funcionamento

1. Verifica `localStorage('dylist_onboarding_v1')` — se existir, não exibe
2. Cria overlay SVG com máscara que recorta o elemento-alvo (deixa ele "iluminado")
3. Cria balloon posicionado dinamicamente relativo ao elemento
4. Navega pelos passos via botão "Próximo" ou "Pular tutorial"
5. Ao concluir, salva a flag no localStorage

### Passos

| Passo | Alvo | Mensagem |
|---|---|---|
| 1 | `.btn-tutoriais` | Acesse os tutoriais em vídeo |
| 2 | `#openCategoriesBtn` | Crie sua primeira categoria |
| 3 | `.url-input-wrapper` | Cole um link ou busque por texto |
| 4 | `#playlistContainer` | Selecione e reproduza sem distrações |

### API pública

```js
window.startOnboarding()  // reinicia o tour (ignora flag salva)
```

---

## 11. Módulo: pwa.js + sw.js

### pwa.js

Captura o evento `beforeinstallprompt`, guarda em `deferredPrompt` e exibe o botão `#installAppBtn`. Ao clicar, chama `deferredPrompt.prompt()`.

### sw.js — estratégia de cache

**Network First com fallback para cache:**

```
fetch(request)
  ✓ sucesso → cacheia a resposta (apenas status 200, tipo 'basic') → retorna
  ✗ falha   → caches.match(request) → retorna do cache
              se não há cache e é navegação → retorna index.html
```

Requisições para `youtube.com`, `ytimg.com` e `googlevideo.com` são ignoradas (CORS).

Cache versionado: `dylist-cache-v2`. Na ativação, caches com nome diferente são deletados.

---

## 12. Módulo: statistics.js

**Responsabilidade:** modal de estatísticas detalhadas sobre uso do app.

### Dados coletados

Todos lidos do `localStorage` — sem telemetria externa.

| Seção | Dados |
|---|---|
| Biblioteca | Total de vídeos, categorias, categoria favorita |
| Reprodução | Tocados hoje, total histórico, modo loop, velocidade |
| Ad Blocker | Anúncios bloqueados, segmentos salvos, status |
| Armazenamento | Tamanho dos dados, API Key configurada, último backup |
| Uso do App | PWA instalado, Service Worker ativo |

### API pública

```js
window.showStats()        // abre o modal
window.openStatsModal()   // alias para compatibilidade com HTML
```

---

## 13. Design System (styles.css)

### Tokens CSS

```css
:root {
  /* Superfícies */
  --bg:        #060B14;   /* Fundo body */
  --surface:   #0B1623;   /* Cards principais */
  --surface2:  #0d1b2a;   /* Modal content, player controls */
  --surface3:  #1e293b;   /* Inputs, botões secundários */

  /* Bordas */
  --border:        rgba(255,255,255,0.07);
  --border-solid:  #1e293b;

  /* Cores de destaque */
  --accent:      #FF9900;
  --accent-glow: rgba(255,153,0,0.20);
  --accent-soft: rgba(255,153,0,0.10);
  --cyan:        #06b6d4;
  --green:       #10b981;
  --red:         #ef4444;
  --amber:       #f59e0b;
  --purple:      #8b5cf6;

  /* Texto */
  --text:   #f1f5f9;
  --muted:  #94a3b8;
  --muted2: #64748b;

  /* Tipografia */
  --mono: 'JetBrains Mono', monospace;
  --sans: 'Syne', sans-serif;

  /* Gradiente de acento (barra superior, dividers) */
  --grad-bar: linear-gradient(90deg, #06b6d4, #FF9900, #ef4444);
}
```

### Componentes principais

| Seletor | Descrição |
|---|---|
| `.box` | Container principal (max-width 700px) |
| `.playlist` | Sidebar de itens (width 300px, scroll) |
| `.player-controls-advanced` | Área de controles do player |
| `.secondary-controls` | Barra de botões secundários com `controls-divider` |
| `.playlist-zone` | 3 zonas: play, select, danger |
| `.zone-danger` | Borda vermelha, fundo sutil — ações destrutivas |
| `.modal` | Overlay fixo z-index 10000 |
| `.modal-content` | Card do modal com barra gradiente no topo |
| `.playlist-item` | Item arrastável com estado `now-playing` animado |

### Breakpoints responsive

| Breakpoint | Comportamento |
|---|---|
| `≥ 1024px` | `.box` ocupa 86% da largura |
| `≤ 768px` | Layout em coluna; iframe altura 220px |
| `≤ 420px` | Labels de texto ocultos nos botões de ação |

---

## 14. Fluxo de dados e localStorage

```
Usuário cola link
  → SmartSearch._detectType()
      → 'video': oEmbed fetch → playlist.push() → savePlaylist() → renderPlaylist()
      → outros: API key check → fetch YouTube API → modal → _commit() → savePlaylist()

Usuário cria categoria
  → categories.push() → saveCategories() → renderCategoryFilters() → renderPlaylist()

Usuário reproduz vídeo
  → playVideo(index) → player.loadVideoById() → onPlayerStateChange(PLAYING)
    → updateNowPlayingUI() → startProgressUpdater() → updateMediaSession()

Timer de desligamento
  → setAutoShutdown(minutes) → setTimeout → player.pauseVideo() → window.close()
    → clearAutoShutdownTimer() → localStorage.removeItem('auto_shutdown_time')
```

---

## 15. Hierarquia de z-index

| Camada | Variável CSS | Valor numérico | Elementos |
|---|---|---|---|
| Base | `--z-base` | `auto` | `.box`, `.playlist` |
| Modal | `--z-modal` | `10000` | Todos os `.modal`, modais JS |
| Equalizador | — | `2000` | `#equalizerModal` |
| Batch confirm | — | `10001` | `#batchConfirmModal` |
| Tutorial sidebar | — | `10000` | `.tutorial-sidebar` |
| Video modal | — | `10002` | `.video-modal` |
| Overlay OLED | `--z-overlay` | `19999` | `#darkOverlay` |
| Toast | `--z-toast` | `20000` | `#dylist-toast`, `#msgPix` |

---

## 16. Atalhos de teclado

Todos os atalhos ignoram eventos disparados de dentro de `<input>` ou `<textarea>`.

| Atalho | Módulo | Ação |
|---|---|---|
| `Espaço` | player.js | Play / Pause |
| `→` | player.js | Avançar 10s |
| `←` | player.js | Voltar 10s |
| `↑` | player.js | Volume +10 |
| `↓` | player.js | Volume -10 |
| `Ctrl+N` | player.js | Próximo vídeo |
| `Ctrl+P` | player.js | Vídeo anterior |
| `Ctrl+L` | player.js | Alternar loop |
| `Ctrl+H` | sidebar.js | Abrir/fechar tutoriais |
| `Escape` | sidebar.js | Fechar vídeo/sidebar |
| `Ctrl+Shift+M` | ad-blocker.js | Marcar início de segmento |
| `Ctrl+Shift+E` | ad-blocker.js | Marcar fim de segmento |

---

## 17. API YouTube Data v3 — endpoints usados

Todos os requests incluem `key=API_KEY` como query param.

| Endpoint | Uso | Módulo |
|---|---|---|
| `channels?part=contentDetails&forHandle=%40{handle}` | Resolver @handle → uploadsPlaylistId | search-advanced.js |
| `channels?part=contentDetails&id={channelId}` | Resolver channelId → uploadsPlaylistId | search-advanced.js |
| `playlistItems?part=snippet&playlistId={id}&maxResults=50` | Listar vídeos de canal/playlist | search-advanced.js |
| `search?part=snippet&q={query}&type=video&maxResults=50` | Busca por texto | search-advanced.js |
| `youtube.com/oembed?url=...&format=json` | Título de vídeo (sem API key) | app.js, search-advanced.js |

Todos os requests de `playlistItems` e `search` suportam `pageToken` para paginação.

---

## 18. Guia de contribuição

### Adicionar um novo módulo

1. Crie o arquivo em `assets/js/nome-modulo.js`
2. Adicione o `<script src="...">` ao final do `index.html`, após os módulos existentes
3. Exponha funções públicas via `window.nomeFuncao = ...`
4. Se o módulo precisar de dados globais (`playlist`, `categories`), acesse diretamente — eles são variáveis globais por design

### Convenções de código

- **Sem ES modules** — todo código é global por compatibilidade com Service Worker e ausência de bundler
- **Sem frameworks** — DOM vanilla, CSS puro
- **Classes opcionais** — use para módulos com estado próprio (`SmartSearch`, `BackupManager`), funções soltas para utilitários simples
- **Console logs** — use o objeto `logger` de `app.js` (debug, info, success, warn, error)
- **localStorage** — nomeie chaves com prefixo `dylist_` para novos dados; mantenha retrocompatibilidade com chaves existentes

### Checklist de PR

- [ ] Funciona sem API Key quando aplicável
- [ ] Não interfere com `#player` nem seus descendentes
- [ ] Responsivo em mobile (≤ 768px)
- [ ] z-index respeita a hierarquia definida
- [ ] Não introduz dependências externas (CDN ou npm)
- [ ] Dados novos no localStorage documentados neste wiki

---

*Documentação gerada para DyList v4.0 · © 2026 Alexandre Nunes Torres · @alementoria*
