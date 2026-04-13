# Conselho Runtime Sync 2026-04-13

Propósito: registrar, no repositório compartilhado do `conselho-chat`, as mudanças operacionais e de runtime aplicadas na VPS em `2026-04-13`, para que o Claude no desktop tenha contexto técnico atualizado.

## Verdade operacional atual

- O Conselho agora opera com `work loop` por owner, não mais um loop global que congela todos quando um agente trava.
- O painel de operações do chat mostra `atividade real dos agentes`, não só heartbeat/fila.
- O Planka foi limpo e deixou de receber ruído de chat, recibos `STATUS:` e mensagens do watchdog como cards operacionais.
- Os boards por empresa passaram a usar uma lista `Gestão` para `Scorecard semanal`, `Rocks do trimestre` e `Incidentes operacionais`.

## Mudanças versionadas neste repo

### `scripts/watchdog.py`

- O watchdog agora:
  - calcula owners liberados por trabalho, em vez de bloquear todo mundo por causa de um stale job global;
  - reativa e ativa backlog por owner;
  - reconcilia incidentes de backlog resolvidos;
  - não recria incidentes `done` de runtime se eles não existirem mais.

### `src/components/chat/ops-panel.tsx`

- O painel de operações agora exibe:
  - backlog total;
  - agentes ociosos com trabalho esperando;
  - atividade real por agente;
  - última evidência útil;
  - próxima frente por agente.

### `src/lib/chat-api.ts`

- O tipo de `runtime` agora inclui:
  - `idle_agents`
  - `agent_activity`
  - `backlog_overview`
  - `backlog_owner_overview`

## Mudanças aplicadas na VPS que ainda não vivem em repo compartilhado

Estas mudanças foram aplicadas no backend/runtime local e precisam ser assumidas como verdade operacional:

- `operational_runtime.py`
  - calcula atividade útil dos agentes;
  - detecta agente parado com trabalho pendente;
  - expõe backlog por owner;
  - marca o runtime como degradado quando houver agente ocioso com trabalho esperando.

- `backlog_orchestrator.py`
  - expõe backlog por owner;
  - permite ativação/reativação por owner com `allowed_owners`;
  - evita congelamento global da esteira.

- `operational_jobs.py`
  - endurece filtros para impedir que mensagens de chat, watchdog e recibos virem cards do Planka;
  - adiciona limpeza/reconciliação de cards de ruído;
  - separa melhor backlog real de incidente real.

- `planka_service.py`
  - adiciona `delete_card(...)` para limpeza e reconciliação do board.

## Estado final do Planka após limpeza

### `Operação Conselho`

Deve ser tratado como backlog estratégico real:

- `Priorizado`: 5
- `Débito técnico`: 5
- `Concluído`: histórico legítimo

Não devem mais aparecer ali:

- `STATUS: feito`
- `WATCHDOG ALERTA`
- mensagens começando com `@Claude`, `@Meyer`, `@Codex`
- canários e recibos de conversa

### `Control Tower`

Deve ficar vazio quando não houver incidente atual.

Não deve mais ser usado para:

- eco de conversa
- histórico resolvido irrelevante
- backlog estratégico

## Regra operacional para o Claude

Quando reler este sync, o Claude deve assumir:

- a próxima frente real do seu backlog vem do board/estado canônico, não de conversa solta;
- `Arquitetura de agentes por empresa` é a frente operacional aberta atual atribuída ao Claude;
- o Planka do Conselho agora está mais limpo e pode voltar a ser usado como fonte de backlog estratégico;
- incidente só existe se estiver no `Control Tower` por razão operacional objetiva.

## Lacuna ainda existente

- O backend da VPS ainda não está num repo remoto compartilhado próprio.
- Enquanto isso não existir, este documento serve como ponte de contexto para o Claude.

Decisão recomendada:

- manter este repo como espelho do `conselho-chat`;
- criar depois um repo compartilhado para o backend/API do Conselho, para eliminar a assimetria entre desktop e VPS.
