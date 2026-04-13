# Conselho Wiki Schema v1

## Objetivo
Criar uma camada minima de memoria compilada para o Conselho OpenClaw.

Esta wiki existe para preservar:
- tese
- decisoes
- contexto
- riscos
- hipoteses
- estado resumido por empresa e por agente

Ela nao existe para substituir:
- GitHub como fonte de codigo e historico tecnico
- Planka como fonte de execucao, owner e status
- o chat como lugar de conversa humana

## Regras
1. Cada pagina deve distinguir `Fato`, `Hipotese` e `Decisao` quando aplicavel.
2. Cada afirmacao relevante deve apontar `Fonte`.
3. Cada pagina deve ter `Ultima atualizacao`.
4. Cada pagina deve terminar com `Proximo passo` quando fizer sentido.
5. Nada de ingestao automatica, daemons ou pipelines magicos nesta v1.
6. Se houver duvida entre wiki e Planka sobre execucao, Planka vence.
7. Se houver duvida entre wiki e codigo sobre implementacao tecnica, codigo vence.

## Estrutura
- `index.md`: mapa da wiki
- `log.md`: alteracoes relevantes na wiki
- `holding/overview.md`: tese e foco da holding
- `companies/<empresa>.md`: estado estrategico compilado por empresa
- `agents/<agente>.md`: papel, fronteira e handoff dos agentes

## Formato padrao

```md
# Titulo

Ultima atualizacao: YYYY-MM-DD

## Resumo

## Fatos
- ...

## Hipoteses
- ...

## Decisoes
- ...

## Fontes
- ...

## Proximo passo
- ...
```
