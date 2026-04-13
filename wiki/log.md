# Conselho Wiki Log

## 2026-04-13
- Wiki v1 criada como memoria compilada minima do Conselho.
- Escopo inicial definido:
  - `schema.md`
  - `index.md`
  - `log.md`
  - `holding/overview.md`
  - `companies/viralmind.md`
  - `agents/franklin.md`
  - `agents/agrippa.md`
  - `agents/codex.md`
  - `agents/claude.md`

Fonte:
- Discussao no Conselho sobre o gist do Karpathy e memoria compilada.

## 2026-04-13
- Pagina da `ViralMind` refinada com:
  - tese do produto
  - benchmark do `viralist.ai`
  - roadmap em fases
  - direcao para `Viral Memory Engine`
- Brief de roadmap adicionado em:
  - `docs/viralmind-roadmap-2026-04-13.md`

Fonte:
- Revisao do codigo local do ViralMind
- Benchmark publico em `viralist.ai`

## 2026-04-13
- Estrutura empresarial da ViralMind definida com:
  - Edwin (CEO)
  - Rita (Produto)
  - Ada (Tecnologia)
  - Ogilvy (Growth)
- Separacao explicita entre:
  - Conselho da holding
  - canais da empresa

Fonte:
- desenho organizacional da holding
- org chart inicial da ViralMind

## 2026-04-13
- Pack operacional da ViralMind reforcado com:
  - company brief
  - market map
  - GTM hypotheses
  - scorecard e rocks
  - docs checklist
  - sprint de 6 horas
- Ajuste de foco:
  - o banco do produto ainda esta vazio no nucleo (`trending_videos`, `viral_patterns`, `scripts`)
  - o wedge inicial deve ser clipping e reutilizacao inteligente de conteudo longo/live

Fonte:
- pesquisa de mercado em benchmarks publicos
- leitura do schema e contagem real do banco da ViralMind

## 2026-04-13
- Sprint operacional do ViralMind disparado na sala da empresa
- Docs faltantes criados:
  - `Pattern Explorer PRD`
  - `Post-stream Clipper PRD`
  - `Implementation Plan`
  - `Weekly Review Template`
  - `CEO Update Template`
- Core loop saiu do zero:
  - `trending_videos` passou a ter dados reais do TikTok
  - `viral_patterns` passou a ter a primeira agregacao simples
- Bloqueio tecnico identificado e parcialmente corrigido:
  - chamada da Apify usava actorId incorreto
  - refresh generico foi reduzido para a fonte que funciona hoje

Fonte:
- execucao direta no backend da ViralMind
- pesquisas e validacoes em runtime
