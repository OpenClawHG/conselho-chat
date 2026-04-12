# Conselho Runtime Sync — 2026-04-12

## O que mudou no `conselho-chat`

- A sala ganhou um painel lateral de operações com jobs e saúde do runtime.
- O watchdog do Conselho deixou de olhar só para atividade no feed e passou a olhar para jobs canônicos, degradação de runtime e backlog ativado.
- A UI agora mostra jobs fora do feed principal, para não poluir o chat com estado operacional bruto.

## Mudanças de comportamento relevantes

- Pendência textual não deve mais ser tratada como concluída só porque apareceu uma mensagem de status parecida.
- O backlog automático precisa reconciliar conclusão real com job/recibo válido.
- Metatarefas locais não devem ser promovidas como frente operacional.

## Importante: backend local fora deste repo

Algumas correções operacionais do Conselho foram aplicadas no backend local em `/opt/viralmind/apps/api/services/` e não estão versionadas neste repositório hoje.

Impactos que já existem no runtime local:

- executor operacional do Conselho para comandos seguros;
- jobs canônicos com recibo obrigatório;
- orquestrador de backlog;
- memória operacional compartilhada entre canais.

## Como revisar

1. Puxar esta branch.
2. Revisar o painel de ops e o watchdog no `conselho-chat`.
3. Assumir que o backend local mudou de comportamento, mesmo sem diff completo neste repo.

## Lacuna ainda aberta

- O backend `apps/api` precisa ser conectado a um repositório Git compartilhado para review real entre agentes.
