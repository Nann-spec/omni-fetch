# DESIGN.md — Identidade Visual & Diretrizes de Design do OmniFetch

## 1. Visão Geral & Filosofia de Marca

O **OmniFetch** é uma ferramenta utilitária e elegante para download e conversão de mídias multiplataforma (YouTube, Instagram e TikTok sem marca d'água).

A identidade visual é guiada pelo logotipo oficial (**`omni_logo.png`**), que combina a velocidade e a tecnologia da nuvem em degradês sofisticados de **roxo elétrico, ametista e índigo**.

A proposta visual une o melhor de dois mundos:
1. **Identidade Visual Marcante:** Cores violetas nobres, degradês harmônicos e um fundo estrelado sutil com flares que respiram organicamente.
2. **Engenharia e Usabilidade Profissional:** Sem poluição visual, com ergonomia de ponta (botão de colar em 1 clique, detecção automática de plataformas, métricas monoespacadas e histórico de downloads).

---

## 2. Elementos Centrais de Identidade

### 2.1 O Logotipo Oficial (`omni_logo.png`)
- Símbolo: Nuvem estilizada com vetor de velocidade e seta de download em degradê 3D ultravioleta.
- Tipografia da marca: **OmniFetch** com cantos arredondados modernos e alto contraste.
- Utilização:
  - Favicon oficial no navegador.
  - Navbar com dimensionamento calibrado (`height: 36px`).

### 2.2 Paleta de Cores & Degradês
Substituímos o azul padrão genérico pela rica paleta ultravioleta/púrpura original da marca:

```css
:root {
  /* Fundos & Superfícies (Dark Obsidian com nuance púrpura profunda) */
  --bg-body: #08060f;
  --bg-navbar: rgba(12, 9, 23, 0.85);
  --bg-card: #110d1f;
  --bg-surface-subtle: #17122a;
  --bg-surface-elevated: #201938;
  --bg-input: #0d0a17;
  --bg-input-focus: #130f24;

  /* Bordas e Divisores */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(168, 85, 247, 0.15);
  --border-hover: rgba(168, 85, 247, 0.30);
  --border-focus: #a855f7;

  /* Cores de Ação & Degradês Principais */
  --primary-gradient: linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6366f1 100%);
  --primary-gradient-hover: linear-gradient(135deg, #b55fe6 0%, #8b5cf6 50%, #7376f9 100%);
  --text-gradient: linear-gradient(135deg, #ffffff 40%, #d8b4fe 100%);
  --accent-purple: #a855f7;
  --accent-lilac: #c084fc;
  --accent-subtle: rgba(168, 85, 247, 0.12);
  --accent-glow: 0 8px 24px -4px rgba(124, 58, 237, 0.4);

  /* Tipografia */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Status Semânticos */
  --status-success: #10b981;
  --status-success-bg: rgba(16, 185, 129, 0.12);
  --status-error: #ef4444;
  --status-error-bg: rgba(239, 68, 68, 0.12);
}
```

### 2.3 Flares Estelares com Respiração (Breathing Star Flares)
- Padrão estelar geométrico e flares de luz profunda espalhados no fundo.
- **Animação de Respiração Suave (`starPulse`):** O brilho dos flares e estrelas varia sutilmente entre `0.20` e `0.42` de opacidade ao longo de ciclos lentos de `6s` a `9s`, criando um ambiente vivo e hipnótico sem distrair o usuário da tarefa principal.

### 2.4 Degradês Estratégicos
- **Hero Title:** O título principal recebe `-webkit-background-clip: text` com degradê de branco para lilás claro.
- **Botões de Ação (CTA):** Degradê vibrante `#a855f7` → `#7c3aed` → `#6366f1` com sombra de dispersão suave.
- **Barra de Progresso:** Preenchimento contínuo em degradê que reflete a taxa de transferência em tempo real.
- **Borda de Destaque Superior:** Filete sutil de 2px no topo do cartão da aplicação.

---

## 3. Estrutura dos Componentes

1. **Header (Navbar):**
   - Logotipo oficial `omni_logo.png` renderizado com máxima nitidez.
   - Status do motor local ativo com ponto pulsante verde esmeralda.
2. **Card Principal:**
   - Campo de link com botão nativo de colar (`Clipboard API`) e botão de limpar.
   - Chips com as cores oficiais das plataformas:
     - YouTube: Vermelho
     - Instagram: Rosa/Gradiente
     - TikTok: Ciano (*Sem Marca*)
     - Web Geral: Púrpura
   - Controles segmentados para formato (MP3 e MP4) e qualidade adaptativa.
3. **Card de Progresso e Métricas Técnicas:**
   - Thumbnail da mídia com selo de duração.
   - Grade em fonte monospace (`JetBrains Mono`) exibindo velocidade, ETA e porcentagem exata.
4. **Histórico Local de Downloads Recentes:**
   - Armazenado no `localStorage` do navegador para acesso imediato a arquivos já baixados na sessão.
5. **Modais de Escolha e Confirmação (`showConfirmModal`):**
   - Utilizadas exclusivamente quando há tomada de decisão ou ação irreversível (ex: confirmação para limpar o histórico).
   - Backdrop com desfoque suave (`backdrop-filter: blur(8px)`), foco automático no botão de ação e suporte nativo ao teclado (`Escape` fecha, `Enter` confirma).
6. **Sistema de Toasts Informativos (`showToast`):**
   - Notificações não obstrusivas para avisos, erros de validação e confirmações de ações (como cópia de links ou URLs vazias).
   - **Timer de desaparecimento automático** calibrado entre `2.5s` e `4.5s`.
   - **Barra de contagem regressiva animada** no rodapé do toast para feedback visual do tempo restante antes do encerramento.
   - Botão manual de descarte imediato (`x`).
