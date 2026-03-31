# 🎬 DyList — você lista, o show é por nossa conta

> Player de YouTube sem distrações. Categorias, timer, 4 modos de loop, equalizador, busca inteligente e modo OLED. Grátis, open-source, sem anúncios.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-green.svg)](manifest.json)
[![Version](https://img.shields.io/badge/version-4.0-orange.svg)](CHANGELOG.md)

---

## ✨ Funcionalidades

| Recurso | Descrição |
|---|---|
| 🔗 **Entrada inteligente** | Cole um link ou busque por texto — o campo detecta automaticamente vídeo, canal, playlist ou busca |
| 📁 **Categorias** | Crie categorias com nome, emoji e cor; reordene por drag & drop |
| ▶️ **4 modos de loop** | Normal → Repetir 1 → Repetir Todos → Aleatório |
| ⏱ **Timer de desligamento** | Para o player automaticamente após 15 min / 30 min / 1h / 2h etc. |
| 🎚 **Equalizador 8 bandas** | Web Audio API com espectro animado e presets (Normal, Clareza, Surround, Graves…) |
| 🌙 **Modo OLED** | Tela 100% preta — economia máxima de bateria |
| 🛡️ **Ad Blocker** | CSS + DOM Observer; nunca toca no player do YouTube |
| 🔍 **Busca avançada** | Busca por texto, canal ou playlist via YouTube Data API v3 |
| 💾 **Backup / Restore** | Exporta e importa todos os dados em JSON (playlist, categorias, histórico) |
| 📲 **PWA** | Instale como app no Android, iOS ou desktop |
| 🎓 **Tutoriais** | Sidebar de tutoriais em vídeo acessível pelo botão `🎓 Tutoriais` ou `Ctrl+H` |
| ⌨️ **Atalhos de teclado** | `Espaço` Play/Pause · `←→` ±10s · `Ctrl+N/P` próximo/anterior · `Ctrl+L` loop |

---

## 🚀 Demo

**🌐 [ilist.online](https://ilist.online)**

---

## 📦 Instalação local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/dylist.git
cd dylist

# Sirva com qualquer servidor estático, ex:
npx serve .
# ou
python3 -m http.server 8080
```

Abra `http://localhost:8080` no navegador. **Não requer build, transpile ou dependências npm.**

---

## 🗂 Estrutura do projeto

```
dylist/
├── index.html              # Estrutura principal (HTML semântico)
├── manifest.json           # Configuração PWA
├── sw.js                   # Service Worker (cache Network-First)
│
├── assets/
│   ├── css/
│   │   └── styles.css      # Design System v4.0 — tokens, layout, modais
│   ├── js/
│   │   ├── app.js          # Lógica principal — playlist, drag & drop, UI
│   │   ├── player.js       # YouTube IFrame API — controles, loop, timer
│   │   ├── categories.js   # Sistema de categorias + emoji picker
│   │   ├── search-advanced.js  # Entrada inteligente — SmartSearch class
│   │   ├── equalizer.js    # Equalizador Web Audio API 8 bandas
│   │   ├── ad-blocker.js   # Bloqueador de anúncios (CSS + DOM Observer)
│   │   ├── backup.js       # Export / Import JSON completo
│   │   ├── sidebar.js      # Sidebar de tutoriais
│   │   ├── pwa.js          # Registro do Service Worker + botão instalar
│   │   ├── statistics.js   # Modal de estatísticas
│   │   ├── onboarding.js   # Tour guiado no primeiro acesso
│   │   └── input-patch.js  # Patch de compatibilidade do input
│   └── img/
│       ├── favicon.png
│       ├── icon-192.png
│       └── icon-512.png
```

---

## 🔑 API Key do YouTube (opcional)

A API Key **só é necessária** para buscar vídeos por texto, canal ou playlist.  
Adicionar vídeos por link direto funciona **sem qualquer chave**.

**Como obter:**

1. Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Crie um projeto → **Criar credenciais** → **Chave de API**
3. Ative a **YouTube Data API v3** na biblioteca de APIs
4. No DyList, clique em **API Key** na barra de controles e cole a chave

> 💡 O Google oferece **10.000 requisições gratuitas por dia**, o que é mais que suficiente para uso pessoal.

---

## ⌨️ Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Espaço` | Play / Pause |
| `←` / `→` | Voltar / Avançar 10 segundos |
| `↑` / `↓` | Volume +10 / -10 |
| `Ctrl+N` | Próximo vídeo |
| `Ctrl+P` | Vídeo anterior |
| `Ctrl+L` | Alternar modo de loop |
| `Ctrl+H` | Abrir / fechar sidebar de tutoriais |
| `Ctrl+Shift+M` | Marcar início de segmento patrocinado |
| `Ctrl+Shift+E` | Marcar fim de segmento patrocinado |

---

## 🏗 Design System

O projeto usa um sistema de tokens CSS centralizado em `styles.css`:

```css
:root {
  --bg:       #060B14;   /* Fundo principal */
  --accent:   #FF9900;   /* Laranja — cor primária de ação */
  --cyan:     #06b6d4;   /* Azul ciano — ações secundárias */
  --green:    #10b981;   /* Verde — sucesso / instalação */
  --red:      #ef4444;   /* Vermelho — perigo / delete */
  --sans:     'Syne', sans-serif;
  --mono:     'JetBrains Mono', monospace;
}
```

**Hierarquia de z-index:**

| Camada | Valor | Uso |
|---|---|---|
| Base | `auto` | `.box`, `.playlist` |
| Modal | `10000` | Todos os modais |
| Overlay | `19999` | Modo OLED |
| Toast | `20000` | Notificações |

---

## 💾 Armazenamento de dados

Todos os dados ficam no `localStorage` do navegador — **nenhum dado é enviado a servidores**.

| Chave | Conteúdo |
|---|---|
| `playlist` | Array de vídeos `{ id, title, categoryId }` |
| `youlist_categories` | Array de categorias `{ id, name, color }` |
| `youtube_api_key` | Chave da API (criptografada pelo browser) |
| `loop_mode` | `none` \| `one` \| `all` \| `shuffle` |
| `playback_speed` | `0.25` … `2` |
| `auto_shutdown_time` | Timestamp Unix do desligamento agendado |
| `play_history` | Histórico de reproduções |
| `youlist_sponsor_segments` | Segmentos patrocinados marcados |
| `dylist_eq` | Configurações do equalizador |
| `dylist_auto_backup` | Último backup automático (30 min) |

---

## 🔧 Módulos principais

### `SmartSearch` (`search-advanced.js`)
Classe que intercepta o campo de entrada e detecta automaticamente o tipo de input:
- **Link de vídeo** → adiciona direto via oEmbed (sem API)
- **Link de canal** → busca uploads via `playlistItems` API
- **Link de playlist** → expande via `playlistItems` API
- **Texto livre** → busca via `search` API com paginação

### `BackupManager` (`backup.js`)
Exporta e importa todos os dados do `localStorage` em um único arquivo `.json` versionado.

### `DyListPremium` / `YouListAdBlocker` (`premium.js` / `ad-blocker.js`)
Dupla camada de proteção: CSS blocking + DOM MutationObserver.  
**Proteção explícita**: nunca remove `#player` ou seus descendentes.

### Equalizador (`equalizer.js`)
Cadeia de 8 `BiquadFilter` via Web Audio API. Tenta capturar o áudio do iframe do YouTube; opera em modo visual caso CORS impeça a captura.

---

## 📲 PWA — Instalar como app

O DyList é um Progressive Web App completo:

- **Service Worker** com estratégia Network-First + fallback para cache
- **Web App Manifest** com ícones 192×512, `display: standalone`
- **Share Target** — compartilhe links do YouTube direto para o DyList
- **Wake Lock API** — mantém a tela acesa no modo OLED

Para instalar, clique em **📲 Instalar DyList como App** (aparece automaticamente em navegadores compatíveis) ou use o menu do Chrome/Edge → "Instalar app".

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m 'feat: descrição clara da mudança'`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

**Padrão de commits:** [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📄 Licença

MIT © 2026 [Alexandre Nunes Torres](https://www.instagram.com/alementoria/) — [@alementoria](https://www.instagram.com/alementoria/)

---

<p align="center">
  Feito com ☕ e muito YouTube no Brasil 🇧🇷
</p>
