# Mensageria Hospitalar — Desafio Unimed Chapecó

## Objetivo

Automatizar a identificação de exames com resultados liberados e **simular o envio de SMS** ao paciente, sem intervenção manual.

Mensagem obrigatória:

> Prezado cliente, os resultados dos seus exames estão disponíveis para retirada.

Após o aceite do mock, o backend registra no console uma mensagem no formato `SMS enviado, cliente João Silva (fictício)`.

**O processamento principal acontece na inicialização do backend, sem depender da abertura do dashboard React.**

## Demonstração rápida

### 1. Preparar e iniciar

Na raiz do repositório:

```bash
npm run setup
npm run dev
```

O `setup` instala dependências, cria arquivos `.env` apenas se estiverem ausentes, inicia o PostgreSQL e executa migrations. O `dev` inicia NestJS e Vite.

- Dashboard: http://localhost:5173
- Swagger: http://localhost:3000/docs

Na primeira inicialização demonstrativa, o backend prepara dados fictícios (quando o seed está habilitado), identifica exames liberados e registra seus SMS simulados e estados.

### 2. Reproduzir o cenário de exames liberados

Com a aplicação já em execução, abra outro terminal na raiz:

```bash
npm run demo:released
```

No módulo **Exames**, clique em **Atualizar** e depois em **Processar pendentes**. Confira os logs `SMS enviado, cliente ...` no terminal da API e o status **Notificado** no dashboard.

Clique novamente em **Processar pendentes**: os exames já notificados não devem receber outro SMS.

> A interface é uma extensão para visualização. A automação exigida pelo desafio funciona sem ela. Os scripts de demonstração permitem exercitar novos cenários enquanto a API está rodando.

## Requisitos funcionais atendidos

- Identificação e processamento automático de exames com resultado liberado.
- SMS **simulado**, com mensagem fixa e confirmação no console.
- Histórico persistente e status por exame e tentativa de notificação.
- Proteção contra processamento concorrente e duplicação por exame.
- Falhas isoladas e reprocessamento explícito, preservando tentativas anteriores.
- Seed idempotente de dados fictícios.
- Cenários reproduzíveis sem acessar diretamente o banco.
- Dashboard de exames; módulo adicional de pacientes e mensagens.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Backend | NestJS 11, TypeScript, TypeORM |
| Banco de dados | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, CSS Modules, Axios |
| Execução | Node.js, npm, Docker Compose; GNU Make opcional |

## Pré-requisitos

- Node.js **22.12+** e npm.
- Docker em execução com engine Linux.
- Docker Compose v2 com suporte a `up --wait`.
- Portas padrão disponíveis: **5432** (PostgreSQL), **3000** (API) e **5173** (frontend).

O projeto não instala Node.js, Docker ou Make automaticamente.

## Comandos de execução

### Opção recomendada: npm (Windows e Linux)

Na raiz:

```bash
npm run setup  # instala dependências, prepara .env, sobe banco e aplica migrations
npm run dev    # inicia NestJS e Vite
npm run build  # gera os builds das duas aplicações
npm run stop   # para os serviços Docker sem excluir dados
```

### Alternativa com GNU Make

Para quem já possui `make` instalado:

```bash
make setup
make dev
make build
make stop
```

Os comandos de preparação preservam arquivos `.env` existentes. Após receber migrations novas, execute `setup` novamente; `dev` não aplica migrations automaticamente. `Ctrl+C` interrompe os processos de desenvolvimento; o banco permanece disponível.

## Como funciona a notificação automática

1. `setup` executa migrations. `synchronize` e a execução automática de migrations ficam desabilitados.
2. No bootstrap, o `SeedService` cria registros fictícios se `DEMO_SEED_ENABLED=true`. Os registros existentes não são sobrescritos.
3. O processador identifica exames `RELEASED` com notificação `PENDING`.
4. Antes de chamar o provider, registra uma tentativa de mensagem `PENDING` e o exame como `PROCESSING`, em transação.
5. O `MockSmsProvider` simula o envio da **mensagem exata** do desafio e imprime a confirmação no console.
6. Outra transação persiste o resultado: `SENT` ou `FAILED`, com histórico.

**Estados do exame:** `PENDING`, `RELEASED`.

**Estados da notificação:** `NOT_ELIGIBLE`, `PENDING`, `PROCESSING`, `SENT`, `FAILED`.

Exames não liberados não são notificados. Exames `SENT` não são reenviados. Falhas exigem confirmação e reprocessamento explícito; tentativas `PROCESSING` interrompidas não são reenviadas automaticamente.

O processamento ocorre no bootstrap e pode ser disparado manualmente por `POST /exams/process-pending`. **Não há cron job**: exames liberados após a inicialização são processados na próxima verificação. O React não dispara seed nem processamento ao abrir a página.

O seed demonstrativo fica desabilitado em produção. Na execução pela raiz, caso não exista configuração explícita, os scripts habilitam a demonstração; é possível configurar `DEMO_SEED_ENABLED=false` para desabilitá-la.

## Cenários de demonstração

Execute em **outro terminal, na raiz do projeto**, com a API iniciada:

| Comando | Resultado esperado |
| --- | --- |
| `npm run demo:pending` | Cria três exames `PENDING / NOT_ELIGIBLE` que não recebem SMS. |
| `npm run demo:released` | Cria três exames `RELEASED / PENDING`, prontos para o botão **Processar pendentes**. |
| `npm run demo:failed` | Cria três exames liberados; o mock rejeita um destinatário fictício e aceita os outros dois. |
| `npm run demo:reset` | Remove apenas os dados e as notificações dos cenários, preservando seed padrão e dados externos. |

**Roteiro sugerido de avaliação:**

1. Execute `npm run demo:released`.
2. Atualize a tabela no dashboard **Exames**: os novos registros aparecerão pendentes de notificação.
3. Clique em **Processar pendentes**, observe o console e confira `SENT` e as datas no dashboard.
4. Processe novamente e confirme que não houve duplicação.
5. Execute `npm run demo:pending` e confirme que esses exames não são notificados.
6. Execute `npm run demo:failed` para observar uma falha real do mock, com erro controlado, e outros envios bem-sucedidos.
7. Para repetir, use `npm run demo:reset` e prepare novamente os cenários.

Os scripts são idempotentes: rodá-los de novo não duplica registros nem restaura mensagens enviadas para pendentes. Executam somente em ambiente local de demonstração e não exigem acesso manual ao banco.

**Importante:** prepare os cenários enquanto a API estiver executando. Se reiniciar a API após criá-los, os exames liberados podem ser processados automaticamente no próximo bootstrap, antes de abrir o dashboard. O `reset` bloqueia a remoção de notificações em andamento.

## Funcionalidades adicionais: dashboard

O frontend contém dois módulos:

- **Exames:** filtros, paginação, status, histórico de notificação, botão Atualizar, processamento explícito e reprocessamento confirmado de falhas.
- **Pacientes e Mensagens:** importação CSV, templates personalizados, seleção de pacientes, envio manual e exclusão de cadastros.

O SMS permanece **sempre simulado**. O e-mail é **simulado por padrão**; envio real via Nodemailer/SMTP existe apenas como opção explicitamente configurada. A interface indica o modo de e-mail a partir da configuração pública fornecida pela API, sem expor credenciais.

## Decisões técnicas

**PostgreSQL em vez de dados apenas em memória.** Embora o desafio permita uma simulação simples em memória, a persistência facilita demonstrar rastreabilidade, transações, histórico e controle de concorrência.

**Automação no backend.** O processamento não depende de cliques nem da interface gráfica. O dashboard é uma extensão para facilitar a avaliação.

**Idempotência por exame.** Bloqueios e um índice único parcial para a chave de notificação do resultado evitam tentativas simultâneas e novos envios de exames já notificados, preservando o histórico de falhas anteriores.

**Mensagem fixa independente de templates.** A notificação automática usa literalmente o texto exigido, mesmo se o usuário alterar templates editáveis. Por isso, mensagens automáticas podem não ter vínculo com um template; envios manuais continuam usando templates.

**Seeds e scripts seguros.** Identificadores estáveis e inserções sem sobrescrever dados permitem repetir a demonstração de forma previsível.

## Limitações conhecidas

- Somente dados fictícios. Não há autenticação/autorização; a aplicação **não está pronta para uso real com dados de pacientes**.
- `SENT` significa aceite pelo mock ou servidor SMTP, não confirmação de entrega.
- Não existem SMS reais, cron jobs ou reconciliação automática de envios com resultado desconhecido.
- Se uma execução for interrompida, registros podem permanecer em `PROCESSING`/`PENDING` para avaliação operacional, sem reenvio automático.
- Envios manuais não são deduplicados entre requisições; confira o histórico antes de repetir um lote interrompido.
- Exclusão de pacientes afeta seus exames e mensagens, mas bloqueia operações com envios pendentes. Com seed habilitado, dados demonstrativos excluídos podem reaparecer no próximo bootstrap.
- A validação documentada dos scripts multiplataforma foi feita em Linux; no Windows, o encerramento de processos usa `taskkill`.

## Organização e documentação

```text
/
├── frontend/
│   └── README.md
├── messaging-api/
│   └── README.md
├── Makefile
└── README.md
```

- [Frontend — componentes, execução e fluxo de uso](frontend/README.md)
- [Backend — configuração, contratos, migrations e testes](messaging-api/README.md)

## Validação

Na raiz do projeto:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
```

Os testes e2e precisam do PostgreSQL configurado e usam schemas temporários isolados.

## Entrega

Conforme as instruções do exercício, o projeto é entregue por **Git Bundle**, incluindo o histórico de commits, sem necessidade de hospedagem remota.

```bash
git bundle create fhellipe_cabral.bundle HEAD main
git bundle verify fhellipe_cabral.bundle
git clone fhellipe_cabral.bundle teste-unimed
```

O avaliador pode executar os comandos de instalação e demonstração na pasta clonada, seguindo as seções acima.