# ViralMind

Ultima atualizacao: 2026-04-13

## Resumo
ViralMind e a aposta mais forte da holding hoje: um sistema de inteligencia viral que captura conteudo que esta performando, analisa por que ele funciona e usa essa memoria para orientar novas criacoes.

## Fatos
- O codigo atual ja tem:
  - dashboard web com trending, analyze, generate, insights e scripts
  - API com ingestao de trending
  - scoring TRIBE para scripts e videos
  - agregacao de padroes virais
  - geracao de roteiros rankeados por TRIBE
- O estado atual do banco mostra uma lacuna importante entre tese e realidade:
  - `trending_videos = 0`
  - `viral_patterns = 0`
  - `scripts = 0`
  - `video_analyses = 11`
- Stack atual:
  - Next.js
  - FastAPI
  - Supabase
  - Gemini
  - Apify
- Existe referencia externa importante:
  - `viralist.ai`
- O produto parece estar funcional em nivel de MVP, mas ainda sem tese comercial consolidada e sem loop forte de memoria viral.

## Hipoteses
- O maior diferencial nao deve ser "mais um buscador de videos virais".
- O diferencial certo e virar um sistema de memoria de viralidade:
  - capturar o que esta performando
  - entender por que esta performando
  - transformar isso em padroes reutilizaveis
  - usar esses padroes para orientar novas pecas
- O wedge inicial mais forte agora e:
  - times e criadores que ja produzem conteudo longo ou lives e precisam de clipping e reutilizacao com mais inteligencia

## Decisoes
- Comecar a maturidade da Conselho Wiki pela ViralMind.
- Usar `viralist.ai` como benchmark de clareza comercial, nao como destino final do produto.
- Documentar o ViralMind como "viral intelligence operating system" e nao como simples banco de videos ou gerador de scripts.

## Fontes
- Codigo local do projeto ViralMind
- `https://viralist.ai/`
- `https://viralist.ai/pricing`
- [holding overview](../holding/overview.md)

## Produto alvo
Se o Viralist hoje ajuda a buscar criadores e reels virais, o ViralMind deve ir alem:
- explicar por que o conteudo funciona
- lembrar padroes recorrentes por nicho
- gerar briefs, roteiros e decisoes melhores a partir dessa memoria

## Roadmap resumido
### Fase 1
Dar clareza ao MVP atual:
- narrativa de produto
- estabilidade de refresh
- distincao clara entre trending, insights, analise e geracao

### Fase 2
Construir o `Viral Memory Engine v1`:
- pattern cards
- taxonomia de hooks
- taxonomia de formatos
- memorias por nicho

### Fase 3
Adicionar inteligencia de criadores e concorrentes:
- fingerprints de criadores
- watchlists
- market movers por nicho

### Fase 4
Transformar inteligencia em execucao:
- briefs
- series planner
- campaign generator
- recomendacoes de proximo conteudo

## Estrutura da empresa
### CEO
- Edwin

### Lideranca direta
- Rita — Produto
- Ada — Tecnologia
- Ogilvy — Growth

## Regra de governanca
- ViralMind opera nos canais da propria empresa
- Conselho so recebe report, excecao e decisao de holding
- Edwin e o responsavel por reportar para o Conselho

## Sala atual
Por enquanto a operacao da empresa foi simplificada para uma sala unica:
- `ViralMind / geral`

As salas antigas da empresa foram arquivadas para evitar fragmentacao precoce.

## Documento detalhado
- [viralmind-product-roadmap-2026-04-13.md](/opt/viralmind/docs/viralmind-product-roadmap-2026-04-13.md)
- [viralmind-company-brief-2026-04-13.md](/opt/viralmind/docs/viralmind-company-brief-2026-04-13.md)
- [viralmind-market-map-2026-04-13.md](/opt/viralmind/docs/viralmind-market-map-2026-04-13.md)
- [viralmind-gtm-2026-04-13.md](/opt/viralmind/docs/viralmind-gtm-2026-04-13.md)
- [viralmind-scorecard-2026-04-13.md](/opt/viralmind/docs/viralmind-scorecard-2026-04-13.md)
- [viralmind-docs-checklist-2026-04-13.md](/opt/viralmind/docs/viralmind-docs-checklist-2026-04-13.md)
- [viralmind-live-clipping-roadmap-2026-04-13.md](/opt/viralmind/docs/viralmind-live-clipping-roadmap-2026-04-13.md)
- [viralmind-sprint-2026-04-13.md](/opt/viralmind/docs/viralmind-sprint-2026-04-13.md)
- [viralmind-pattern-explorer-prd-2026-04-13.md](/opt/viralmind/docs/viralmind-pattern-explorer-prd-2026-04-13.md)
- [viralmind-post-stream-clipper-prd-2026-04-13.md](/opt/viralmind/docs/viralmind-post-stream-clipper-prd-2026-04-13.md)
- [viralmind-implementation-plan-2026-04-13.md](/opt/viralmind/docs/viralmind-implementation-plan-2026-04-13.md)
- [viralmind-weekly-review-template-2026-04-13.md](/opt/viralmind/docs/viralmind-weekly-review-template-2026-04-13.md)
- [viralmind-ceo-update-template-2026-04-13.md](/opt/viralmind/docs/viralmind-ceo-update-template-2026-04-13.md)
