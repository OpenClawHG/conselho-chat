# Conselho Reset 2026-04-13

Propósito: registrar o reset operacional do Conselho para que o Claude no desktop trabalhe com o modelo novo, simples e previsível.

## Decisão

O desenho anterior ficou complexo demais e passou a produzir ruído:

- watchdog postando no feed;
- backlog automático;
- jobs canônicos derivados de conversa;
- painel operacional dando sensação falsa de controle;
- respostas com recibo mecânico em contextos de conversa humana.

Esse modelo foi abandonado.

## Modelo novo

### Chat

O chat volta a ser humano.

- Claude, Meyer e Codex podem conversar naturalmente.
- Opinião, dúvida, discordância e raciocínio são esperados.
- O chat não deve soar como terminal de logs.

### Execução

Execução só acontece quando o pedido for explícito.

- deploy;
- comando de host;
- validação objetiva;
- SQL / migration;
- checagem operacional concreta.

Nesses casos, Meyer pode responder com recibo operacional.
Fora disso, a resposta deve ser humana, não mecânica.

### Fonte de verdade

O Conselho não deve mais usar:

- watchdog;
- backlog automático;
- `pending.md` como motor de execução.

O backlog real deve ficar no Planka.
O chat serve para decisão, alinhamento, bloqueio e entrega.

## Mudanças versionadas neste repo

### `src/app/(chat)/rooms/[roomId]/page.tsx`

- remove o painel lateral de operações da experiência principal;
- a sala volta a ser essencialmente chat.

### `src/components/chat/room-header.tsx`

- remove o botão e o badge de `Ops`;
- o header volta a ser simples.

### `scripts/watchdog.py`

- o script agora nasce desligado por configuração;
- se for executado sem habilitação explícita, sai sem postar no chat.

## Mudanças aplicadas na VPS fora deste repo

Estas mudanças estão ativas no backend/runtime local e devem ser consideradas verdade operacional:

- `chat_agent_worker.py`
  - ignora totalmente mensagens do `Conselho Watchdog`;
  - não ativa backlog automaticamente depois de responder;
  - volta a privilegiar conversa humana;
  - só usa recibo operacional em execução real.

- `operational_jobs.py`
  - endurece `is_operational_request(...)`;
  - conversa abstrata não deve mais virar pseudo-operação.

- `/root/.openclaw/.env`
  - `CHAT_AGENT_ENABLE_BACKLOG_AUTOMATION=false`
  - `CONSELHO_WATCHDOG_ENABLED=false`

- systemd no VPS
  - os unit files do watchdog foram tirados do caminho;
  - o watchdog não deve mais subir como timer ativo.

## Regras operacionais para o Claude

O Claude deve assumir o seguinte:

- o handoff antigo do watchdog/backlog automático está obsoleto;
- o Conselho agora usa fluxo simples:
  - Hugo define
  - Claude implementa
  - Meyer executa/deploya/valida
  - Codex arbitra bugs quando for mencionado
- não tratar `pending.md` como motor autônomo;
- não assumir mais painel operacional ou watchdog como fonte de verdade.

## Lacuna que continua existindo

- o backend da VPS ainda não está em um repo remoto compartilhado próprio.
- enquanto isso, este documento é a ponte oficial entre o que roda na VPS e o que o Claude consegue ler pelo GitHub.
