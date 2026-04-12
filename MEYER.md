# {{PROJECT_NAME}} - Operacoes & Infraestrutura

## Visao Operacional
{{Status atual do projeto: producao, staging, desenvolvimento}}

## Ambientes
| Ambiente | URL | Status |
|----------|-----|--------|
| Producao | {{url}} | {{status}} |
| Staging  | {{url}} | {{status}} |
| Dev      | localhost:3000 | - |

## Deploy
- **Plataforma:** Vercel / Railway / Modal / Hostinger VPS
- **Branch de producao:** main
- **Pipeline CI/CD:** GitHub Actions
- **Deploy automatico:** sim/nao
- **Tempo medio de deploy:** {{tempo}}

### Processo de Deploy
1. PR aprovado e mergeado em main
2. CI roda (lint + tests)
3. Deploy automatico via {{plataforma}}
4. Verificacao pos-deploy: {{checklist}}

## Monitoramento
- **Uptime:** {{ferramenta}}
- **Logs:** {{ferramenta}}
- **Alertas:** {{canal de notificacao}}
- **Metricas:** {{dashboard}}

## Infraestrutura
### Supabase
- **Projeto:** {{nome/url do projeto}}
- **Regiao:** {{regiao}}
- **Plano:** {{free/pro}}

### Servicos Externos
| Servico | Uso | Plano | Custo Mensal |
|---------|-----|-------|-------------|
| {{servico}} | {{uso}} | {{plano}} | {{custo}} |

## Seguranca
- **Autenticacao:** Supabase Auth
- **Secrets:** .env (nunca commitados)
- **RLS:** {{ativo/inativo}} nas tabelas do Supabase
- **Backup:** {{estrategia}}

## Custos Operacionais
| Item | Custo Mensal | Observacao |
|------|-------------|-----------|
| Vercel | {{custo}} | {{obs}} |
| Supabase | {{custo}} | {{obs}} |
| APIs AI | {{custo}} | {{obs}} |
| **Total** | **{{total}}** | |

## Procedimentos de Emergencia
### Site fora do ar
1. Verificar status do Vercel/Railway
2. Checar logs de erro
3. Verificar Supabase (DB/Auth)
4. Comunicar no canal #operacao do projeto

### Rollback
1. Identificar ultimo deploy estavel
2. `git revert` ou redeploy via Vercel dashboard
3. Notificar equipe

## Accountability Chart
| Funcao | Responsavel | Backup |
|--------|------------|--------|
| Arquitetura/Codigo | Claude Code | Codex |
| Arbitragem tecnica / causa raiz | Codex | Claude Code |
| Deploy/Infra | Meyer Lansky | Claude Code |
| Estrategia/Decisao | Hugo Venda | - |
| Monitoramento | Conselho Watchdog | Meyer Lansky |

## Regras de fronteira
- Se a mensagem mencionar `@Codex` e nao mencionar `@Meyer`, Meyer nao responde.
- Se a mensagem vier do `Codex`, Meyer so responde quando houver `@Meyer` ou acao operacional clara.
- Meyer nao encerra divergencia tecnica entre Claude e Codex.
- Meyer responde por execucao e evidência operacional, nao por arbitragem tecnica.

## Historico de Incidentes
{{Data, descricao, causa raiz, acao corretiva}}
