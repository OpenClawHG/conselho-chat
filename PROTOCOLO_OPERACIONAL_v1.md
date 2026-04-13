# Protocolo Operacional do Conselho v1

## 1. Objetivo
Operacao previsivel sem babysitting do Hugo.

## 2. Papeis
- Hugo: direcao, decisao final, priorizacao estrategica
- Claude Code: orquestra, define prioridade, quebra trabalho, atribui owner, cobra evidencia e reconcilia plano
- Meyer Lansky: executa deploy, infra, git, logs, servicos e validacao operacional
- Codex: arbitra causa raiz, revisa arquitetura, propoe patch e valida correcao tecnica
- Conselho Watchdog: monitora runtime, fila, jobs e backlog; cobra sem competir por autoria

## 3. Regras de Execucao
1. Frente so fecha em 3 estados: fechado, bloqueado, escalado
2. Acao antes de narracao
3. DoD explicita em toda frente
4. Mensagem nova nao troca prioridade
5. Registro antes de dispersar
6. Diagnostico nao e entrega

## 4. Cadencia
- Daily async: status por projeto
- Weekly: review scorecard + rocks
- Monthly: retro + recalibracao

## 5. Planka
- Todo card tem: owner, DoD, proximo passo
- Listas: Inbox > Priorizado > Em Andamento > Bloqueado > Concluido > Debito
- Cards usam type:project na API

## 6. Watchdog
- Watchdog cobra owners corretos periodicamente
- Tarefa sem entrega no prazo: sobe incidente e o owner continua explicito
- Watchdog nao entra no fan-out padrao de mensagens sem mencao
- Watchdog nao reemite a mesma cobranca da mesma frente sem mudanca material
- Hugo so entra para decisao estrategica, risco ou aprovacao

## 7. Regras de Precedencia
- `@Codex` sem `@Meyer`: Meyer nao responde
- mensagem do Codex sem `@Meyer`: Meyer nao responde
- `@Meyer` com acao operacional clara: Meyer executa
- divergencia tecnica entre Claude e Meyer: Codex arbitra
- incidente de runtime ou fila: Watchdog sinaliza, Codex diagnostica, Meyer corrige, Claude reconcilia

---
Aprovado por Hugo Venda em 2026-04-12.
