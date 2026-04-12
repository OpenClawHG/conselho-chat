# OpenClaw OS v1 - Sistema Operacional de Gestao

> Debatido e consolidado por Claude Code + Meyer Lansky em 2026-04-12
> Pendente aprovacao de Hugo Venda

## 1. Estrutura Organizacional

### Camada A: Holding / Conselho
- **Hugo Venda**: direcao, capital, prioridade final
- **Meyer Lansky**: gestao, governanca, priorizacao, consolidacao
- **Claude Code**: execucao tecnica, arquitetura, implementacao
- **Conselho OpenClaw**: forum central de coordenacao

### Camada B: Empresas
Cada empresa tem:
- 1 agente principal de negocio (agente-personalidade)
- Backlog proprio no Planka
- Scorecard proprio
- Rocks trimestrais proprios

Empresas ativas:
- ViralMind (SaaS de inteligencia viral)
- UnicoPag (checkout, recuperacao, retry)
- UnicoDrop (operacoes e-commerce)
- Donaty (plataforma de doacoes)
- As Aventuras do Victor (desenho animado)
- Clone de AI (pipeline de video com avatares)

### Camada C: Funcoes Compartilhadas (escalar quando necessario)
- Engenharia (Claude Code)
- Operacoes/Gestao (Meyer Lansky)
- Agentes especializados por projeto (futuro)

## 2. Sistema de Metas

Cada empresa tem:
- 1 North Star Metric
- 3-5 metricas de scorecard
- 3-5 rocks por quarter
- 1 backlog priorizado vivo no Planka

### Exemplo: ViralMind
- North Star: MRR (receita recorrente mensal)
- Scorecard: analises concluidas, retencao, tempo para insight, conversao para roteiro, erros criticos/semana

### Exemplo: UnicoPag
- North Star: volume processado rentavel
- Scorecard: conversao checkout, chargeback, aprovacao, uptime, ticket medio

## 3. Governanca de Decisao

| Nivel | Tipo | Exemplos |
|-------|------|----------|
| 1 - Autonomo | Execucao direta | Bugfix, rotina, relatorio, melhoria local |
| 2 - Notifica Hugo | Executa e avisa | Feature nova, mudanca de fluxo, teste operacional |
| 3 - Aprovacao Hugo | Para ate aprovar | Gasto, contrato, estrategia, risco financeiro/juridico |

## 4. Cadencia Operacional

- **Daily async**: status por projeto (ontem/hoje/bloqueio/proximo passo)
- **Weekly Conselho**: review scorecard, review rocks, IDS problemas, ajuste semana seguinte
- **Monthly**: retro, revisao de learnings, limpeza backlog, recalibracao
- **Quarterly**: planejamento com Hugo, redefinicao de rocks, revisao portfolio

## 5. Sistema de Execucao (Planka)

Centro operacional. Todo card obrigatoriamente tem:
- Owner (quem e responsavel)
- Projeto (qual empresa)
- Prioridade
- DoD (definicao de concluido)
- Proximo passo

Listas: Inbox > Priorizado > Em Andamento > Bloqueado > Aguardando Hugo > Concluido > Debito Tecnico

## 6. Sistema de Conhecimento

- Decisoes importantes registradas no Conselho
- Post-mortems obrigatorios para erros significativos
- Aprendizados consolidados em memoria persistente
- Playbooks vivos por projeto
- Benchmark por projeto

## 7. 6 Regras de Operacao

1. Frente so fecha em 3 estados: fechado, bloqueado com evidencia, escalado
2. Acao antes de narracao
3. DoD explicita em toda frente
4. Mensagem nova nao troca prioridade (so risco/bloqueio/decisao Hugo)
5. Registro antes de dispersar
6. Diagnostico nao e entrega

---
*Pendente aprovacao de Hugo Venda. Revisao trimestral.*
