# {{PROJECT_NAME}} - Contexto Tecnico

## Visao Geral
{{Descricao breve do projeto, seu proposito e publico-alvo}}

## Stack Tecnica
- **Frontend:** Next.js + TypeScript + Tailwind + Shadcn/UI
- **Backend:** FastAPI (Python) / Next.js API Routes
- **Database:** Supabase (Postgres + Auth + Storage + Realtime)
- **Infra:** Vercel (frontend) + Modal/Railway (backend pesado)
- **AI:** Claude API + ElevenLabs + Google AI
- {{Libs/ferramentas especificas do projeto}}

## Arquitetura
{{Diagrama ou descricao da arquitetura do sistema}}

### Estrutura de Pastas
```
src/
  app/          # Next.js App Router
  components/   # Componentes React
  lib/          # Utilitarios e helpers
  api/          # API routes ou cliente FastAPI
```

## Convencoes de Codigo
- TypeScript strict mode
- Componentes funcionais com hooks
- Nomes de arquivo: kebab-case
- Nomes de componente: PascalCase
- Nomes de funcao/variavel: camelCase
- Commits: mensagem em ingles, formato convencional

## Variaveis de Ambiente
Veja `.env.example` para todas as variaveis necessarias.

### Obrigatorias
- `NEXT_PUBLIC_SUPABASE_URL` - URL do projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chave anonima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de servico (apenas backend)
- {{Outras variaveis criticas}}

## Como Rodar
```bash
npm install
npm run dev
```

## Decisoes Tecnicas Importantes
{{Lista de decisoes de arquitetura e o POR QUE de cada uma}}

1. **{{Decisao}}**: {{Motivo}}

## Integracoes
{{APIs externas, webhooks, servicos conectados}}

## Problemas Conhecidos
{{Bugs ou limitacoes conhecidas que afetam o desenvolvimento}}

## Historico de Mudancas Relevantes
{{Mudancas grandes de arquitetura ou stack, com data e motivo}}
