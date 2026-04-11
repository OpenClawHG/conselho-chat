# OpenClaw HG - Framework Padrao de Empresas
> Decidido em 2026-04-11 | Conselho OpenClaw | Hugo + Claude Code + Meyer Lansky

## 1. Stack Tecnica Padrao

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Frontend | Next.js + TypeScript + Tailwind + Shadcn/UI | Ja usado em todos os projetos |
| Backend | FastAPI (Python) ou Next.js API Routes | Flexibilidade por projeto |
| Database | Supabase (Postgres + Auth + Storage + Realtime) | Infraestrutura unificada |
| Infra Frontend | Vercel | Deploy automatico, preview deploys |
| Infra Backend | Modal / Railway | Para workloads pesados (AI, video) |
| AI | Claude API + ElevenLabs + Google AI | Stack de AI consolidada |

### Flexibilidade
- Cada projeto pode adicionar libs especificas
- Desvios da stack padrao exigem justificativa documentada (POR QUE)

## 2. Estrutura de Repositorios

**Modelo:** Multi-repo (1 repo por projeto)
**Revisao:** Reavaliar em 3 meses com dados reais de overhead

### Organizacao GitHub
- **Org:** OpenClawHG
- **Repos:** viralmind-saas, unicopag-app, conselho-chat, clone-ai-pipeline, etc.
- **Acesso:** Hugo (owner), Claude Code (push), Meyer Lansky (push)
- **PRs obrigatorios** para main, code review entre agentes
- **CI/CD automatizado** (lint + test + deploy)

### Pacote Compartilhado
- NPM privado com utils comuns (UI components, helpers)

## 3. Template de Projeto

Todo projeto novo nasce com:
1. Repo no GitHub com README padrao
2. Canais no Conselho (Operacao, Estrategia, Produto, Automacoes, Conteudo)
3. `CLAUDE.md` - Contexto tecnico (stack, arquitetura, decisoes)
4. `MEYER.md` - Contexto operacional (deploy, infra, custos, emergencias)
5. `README.md` - Quick start e visao geral
6. `.env.example` - Variaveis de ambiente necessarias
7. CI/CD basico configurado
8. Accountability chart (quem faz o que)

## 4. Papeis dos Agentes (RACI)

| Papel | Agente | Responsabilidades |
|-------|--------|-------------------|
| CEO | Hugo Venda | Estrategia, decisoes finais, priorizacao, direcao criativa |
| CTO | Claude Code | Arquitetura, codigo, automacoes, revisao tecnica, analise |
| COO | Meyer Lansky | Deploy, infra, monitoramento, integracoes externas, operacoes |

### Niveis de Autonomia
- **Nivel 1 (autonomo):** Deploys de rotina, bug fixes, reports
- **Nivel 2 (notifica Hugo):** Mudancas de arquitetura, novos features
- **Nivel 3 (aprovacao Hugo):** Gastos, contratos, mudancas de estrategia

## 5. Framework Operacional

### Metodologia
- **NAO** usar Scrum puro (overhead demais para 3 pessoas)
- **Kanban simples:** TODO > DOING > DONE
- **Rocks semanais:** prioridades claras por semana
- **Sem** story points, velocity ou burndown

### Ritmo Operacional
- **Daily async:** Cada agente posta status no canal do projeto
- **Weekly sync (sexta):** Review no Conselho + rocks da semana seguinte
- **Monthly:** Retrospectiva + ajuste de rocks trimestrais
- **Quarterly:** Planejamento estrategico com Hugo

### Metricas e OKRs
- Cada projeto: 1 metrica norte (ex: ViralMind = MRR, UnicoPag = taxa de conversao)
- 3-5 KPIs de suporte por projeto
- Review semanal com dados reais

### Padrao de Mensagem (toda solicitacao relevante)
- Objetivo
- Dono
- Prazo
- Criterio de pronto

## 6. Gestao de Tarefas

- **Ferramenta:** Trello (boards por projeto) + integracao API com Conselho
- **Temporario:** Conselho como Kanban ate Trello estar configurado
- **Notificacoes:** Cards concluidos notificam no canal do projeto

## 7. Aprendizado Continuo

- Repo dedicado: `knowledge-base`
- Post-mortems obrigatorios para todo erro significativo
  - O que aconteceu
  - Por que aconteceu
  - Plano de acao com responsavel e prazo
- Scorecard semanal: erros, acertos, tendencia
- Decisoes importantes registradas no canal #estrategia

## 8. Comunicacao

- **Hub principal:** Conselho OpenClaw (conselho.openclawhg.tech)
- **Canais por projeto:** Operacao, Estrategia, Produto, Automacoes, Conteudo
- **Conselho OpenClaw (sala):** Board room para decisoes cross-projeto
- **Regra:** Toda decisao no Conselho vira acao em canal de projeto

## 9. Projetos Ativos

| Projeto | Descricao | Status |
|---------|-----------|--------|
| ViralMind | SaaS de inteligencia viral (TRIBE v2) | Em desenvolvimento |
| UnicoPag | Checkout, recuperacao de carrinho, retry de pagamento | Em desenvolvimento |
| UnicoDrop | Operacoes e-commerce | Planejamento |
| Donaty | Plataforma de doacoes | Planejamento |
| As Aventuras do Victor | Desenho animado | Planejamento |
| Clone de AI | Pipeline de video com avatares AI | Em desenvolvimento |

---
*Framework aprovado por Hugo Venda em 2026-04-11. Revisao trimestral.*
