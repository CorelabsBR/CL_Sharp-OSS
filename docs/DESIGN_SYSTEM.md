# Sharp-OSS Interface System

## Direção

O Sharp-OSS usa uma linguagem visual **industrial e utilitária**, adequada a um
editor desktop: alta densidade, hierarquia silenciosa, superfícies claramente
separadas e uma única cor de ação herdada do tema. O gesto visual característico
é o **trilho de foco** — uma linha de destaque curta usada para indicar contexto
ativo sem preencher grandes áreas com a cor de destaque.

O sistema não substitui os temas existentes. Ele deriva superfícies, estados e
elevação das variáveis já fornecidas por cada tema, preservando compatibilidade
com temas claros, escuros e de extensões.

## Auditoria da interface anterior

### Hierarquia e superfícies

- `--bg`, `--bg-2` e `--bg-3` existiam, mas eram usados diretamente e de forma
  intercambiável. Painéis, menus e diálogos nem sempre comunicavam profundidade.
- Bordas, raios e sombras eram definidos com dezenas de valores locais. Isso
  produzia componentes visualmente próximos, porém sem a mesma construção.
- A barra lateral e a área de edição tinham separação funcional, mas cabeçalhos
  e títulos não formavam uma hierarquia consistente.

### Interação e acessibilidade

- O foco visível era implementado apenas em áreas específicas, principalmente
  no chat de IA. Controles de navegação podiam depender somente do hover.
- Estados hover, active, focus e disabled não compartilhavam tokens ou duração.
- Não havia uma política global para `prefers-reduced-motion`.
- Campos indicavam foco somente pela borda, com contraste variável entre temas.

### Densidade e ritmo

- Espaçamentos usavam muitos números próximos sem uma escala explícita.
- A navegação das configurações tinha largura fixa estreita para rótulos em
  inglês e português.
- A Command Center funcionava, mas competia pouco com o restante da IDE em
  estrutura e assinatura visual.

### Dívida técnica visual

- O arquivo de estilos concentra todos os componentes e possui cores, sombras,
  raios e transições hardcoded.
- Temas externos fornecem cores fundamentais, mas não tokens semânticos de
  interação, elevação e tipografia.
- Componentes equivalentes não reutilizam uma primitiva visual comum.

## Tokens

### Compatibilidade com temas

Os temas continuam responsáveis por `--bg`, `--bg-2`, `--bg-3`, `--fg`,
`--muted`, `--border`, `--accent`, `--danger`, `--input-bg`, `--button-bg`,
`--selection-bg` e `--hover-bg`. O sistema deriva deles:

- Superfícies: `--surface-workbench`, `--surface-panel`, `--surface-raised`.
- Interação: `--interactive-hover`, `--interactive-active`, `--focus-ring`.
- Texto: `--text-primary`, `--text-secondary`, `--text-disabled`.
- Estrutura: `--line-subtle`, `--line-strong`, `--shadow-popover`,
  `--shadow-dialog`.
- Geometria: raios de 2, 4, 6 e 8 px; escala espacial baseada em 4 px.
- Movimento: 120 ms para feedback e 180 ms para mudança de superfície.

### Regras de uso

1. A cor de destaque comunica seleção, foco ou ação primária; nunca decoração.
2. Hover altera uma superfície. Seleção combina superfície com trilho de foco.
3. Texto secundário usa `--text-secondary`; opacidade não substitui contraste.
4. Controles compactos têm 28 px no desktop e preservam 44 px em interfaces
   touch por media query.
5. Diálogos usam `--surface-raised`, borda forte e `--shadow-dialog`.
6. Animação nunca é necessária para entender o estado e é removida quando o
   sistema solicita movimento reduzido.

## Componentes-base

- **Chrome:** title bar, activity bar e status bar formam uma moldura contínua.
- **Panel header:** título em 11 px, peso 650 e tracking de 0,06 em.
- **Input:** borda sutil; focus combina borda de destaque e anel externo.
- **Icon button:** 28 × 28 px, raio médio e feedback de superfície.
- **Navigation row:** alinhamento à esquerda, raio médio e trilho de foco ativo.
- **Card/action:** superfície de painel, borda sutil e elevação apenas no hover.
- **Dialog/popover:** superfície elevada, sombra padronizada e foco contido.

## Plano progressivo

### Fase 1 — fundação (implementada em 1.1.0)

- Introduzir tokens semânticos derivados dos temas existentes.
- Uniformizar foco, hover, seleção, disabled, scrollbars e movimento reduzido.
- Refinar chrome, painéis, Command Center, configurações e diálogos sem alterar
  DOM, eventos ou contratos de componentes.

### Fase 2 — componentes (implementada em 1.2.0)

- Extrai as primitivas visuais para `src/styles/primitives.css`, carregado após
  os estilos de layout. A separação mantém `app.css` responsável pela estrutura
  e permite migrar componentes sem alterar seus contratos.
- Disponibiliza botões, icon buttons, campos, selects, tabs, badges, toolbars,
  headers, listas, cards, divisores, tooltips, estados vazios e estados
  assíncronos/erro por classes semânticas `ui-*`.
- Migra Explorer, Source Control, Extensions, runtimes, Arduino e IA, mantendo
  as classes antigas somente quando ainda carregam responsabilidade de layout.
- Padroniza tooltips de icon buttons com `aria-label` e `data-tooltip`; isso
  remove o acoplamento entre comportamento e o atributo visual `title`.
- Adiciona `--success` ao contrato de temas e o deriva de cores VS Code quando
  disponível, com fallback próprio para temas claros e escuros.

#### Matriz das primitivas

| Primitiva | Classe | Responsabilidade |
| --- | --- | --- |
| Button | `ui-button` e variantes | Geometria, borda e estados de ação |
| Icon button | `ui-icon-button` | Controle compacto de 28 px / 40 px touch |
| Field / Select | `ui-field`, `ui-select` | Entrada, placeholder, hover e foco |
| Tabs | `ui-tabs`, `ui-tab` | Navegação compacta e seleção |
| Badge | `ui-badge` | Metadado curto e status |
| Toolbar / Header | `ui-toolbar`, `ui-panel-header` | Ritmo e divisores de painéis |
| List / Item | `ui-list`, `ui-list-item` | Hover, active, selected e trilho de foco |
| Card | `ui-card` | Agrupamento discreto em superfície de painel |
| Empty state | `ui-empty-state` | Ausência de conteúdo sem aparência promocional |
| Divider / Label | `ui-divider`, `ui-section-label` | Seções densas e hierarquia textual |
| Tooltip | `ui-tooltip` | Rótulo acessível para controles somente com ícone |
| Feedback | `is-loading`, `is-error` | Progresso e validação sem alterar layout |

### Fase 3 — validação e redução de dívida

- Em `1.4.0`, Search, Source Control e Chat de IA passam a compartilhar a
  mesma cadência visual do workbench: cabeçalhos compactos, superfícies
  silenciosas, trilhos de contexto, resultados densos e composer destacado.
- Textos gerados após o carregamento inicial devem usar `uiText` diretamente;
  a localização posterior da árvore DOM cobre apenas conteúdo já renderizado.

- Refina o chrome desktop em `1.3.0`: barra superior de 38 px, Command Center
  centralizado, navegação lateral mais silenciosa, abas com contexto ativo e
  status bar compacta. A composição se aproxima de editores contemporâneos sem
  acoplar a interface a um tema específico.
- Preserva densidade e comportamento nos layouts mobile existentes; o novo
  chrome é aplicado apenas acima de 768 px e possui uma faixa intermediária
  própria para notebooks e janelas estreitas.

- Adicionar testes visuais automatizados dos temas padrão, OLED e temas de
  extensão em tamanhos desktop, compacto e touch.
- Revisar navegação por teclado da File Tree e dos itens de Source Control, que
  continuam preservando a implementação de interação atual nesta fase.
- Migrar gradualmente Search, Remote, Keyboard Shortcuts, visualizadores e
  diálogos secundários para as mesmas primitivas.
- Dividir `app.css` por responsabilidade após cobertura visual automatizada,
  removendo regras legadas somente quando cada fluxo estiver protegido.
