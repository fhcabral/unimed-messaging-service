# Mensageria hospitalar — desafio Unimed Chapecó

## Objetivo

Automatizar a identificação de exames com resultados liberados e simular o envio de SMS ao paciente, sem intervenção manual. O backend executa esse fluxo ao iniciar, mesmo sem abrir o dashboard React.

Mensagem obrigatória, enviada literalmente:

> Prezado cliente, os resultados dos seus exames estão disponíveis para retirada.

Após aceite do mock, o console apresenta `SMS enviado, cliente João Silva (fictício)`.

## Requisitos funcionais atendidos

- Exames pendentes e liberados, com rastreamento de notificação e histórico persistente.
- Seed demonstrativo idempotente, sem apagar dados ou sobrescrever edições.
- Processamento automático no bootstrap; proteção contra concorrência e duplicação por exame.
- Falhas individuais isoladas e reprocessamento explícito, preservando tentativas anteriores.
- Dashboard de exames, filtros, paginação e atualização manual.
- Importação CSV, templates, seleção, envio manual e exclusão de pacientes preservados.
- SMS sempre simulado. E-mail simulado por padrão, com Nodemailer/SMTP opcional e explícito.

## Tecnologias

NestJS 11, TypeORM, PostgreSQL 16, React 19, TypeScript, Vite, CSS Modules e Axios. Scripts Node.js coordenam a preparação e os processos, sem Redis, filas ou novas dependências de interface.

## Pré-requisitos

Node.js **22.12+**, npm, Docker com engine Linux em execução e Docker Compose v2 com suporte a `up --wait`. GNU Make é opcional. As portas padrão são 5432 (banco), 3000 (API) e 5173 (frontend). Nenhuma ferramenta é instalada automaticamente.

## Inicialização rápida com Make

Execute na raiz:

```bash
make setup
make dev
```

`setup` instala as dependências de cada aplicação, cria os `.env` somente se ausentes, inicia PostgreSQL, aguarda o healthcheck e executa migrations. Os exemplos configuram mocks e seed demonstrativo. **Arquivos `.env` existentes são preservados integralmente.** SMTP só é usado com `EMAIL_PROVIDER=SMTP`.

`dev` inicia NestJS e Vite no mesmo terminal; `Ctrl+C` encerra as duas árvores de processos. Acesse **http://localhost:5173** e a [documentação da API](http://localhost:3000/docs). O banco continua disponível depois de interromper os processos.

```bash
make build  # build das duas aplicações
make stop   # para Docker sem remover volumes ou dados
```

## Alternativa multiplataforma via npm

Os comandos funcionam na raiz, inclusive no Windows, sem GNU Make ou instalação adicional de dependências na raiz:

```bash
npm run setup
npm run dev
npm run build
npm run stop
```

Os caminhos do Compose, `.env` e migrations são resolvidos pelos scripts. `dev` não executa migrations; após atualizar o código, execute `setup` novamente para aplicar migrations pendentes.

## Funcionamento automático dos exames

1. As migrations são executadas explicitamente por `setup`, antes de iniciar a aplicação. `synchronize` e `migrationsRun` permanecem desabilitados.
2. No bootstrap, `SeedService` insere pacientes, exames e template fictícios quando `DEMO_SEED_ENABLED=true`. Identificadores são estáveis; registros existentes e templates personalizados são preservados. Em produção, o seed é sempre desabilitado.
3. Depois do seed, o processador envia somente exames `RELEASED/PENDING`. Exames não liberados permanecem `NOT_ELIGIBLE`.
4. Cada tentativa cria uma mensagem `PENDING` e marca o exame `PROCESSING` em transação **antes** de chamar o mock. Outra transação grava o resultado de ambos.
5. `SENT` nunca é reenviado; `FAILED` exige confirmação e `POST /exams/:id/retry`. Erros antigos permanecem no histórico. `PROCESSING` não é reenviado automaticamente.

Na execução pela raiz, a demonstração ativa o seed quando a opção não existe no ambiente nem no `.env`. Para desabilitar, configure `DEMO_SEED_ENABLED=false`. Iniciando apenas a API, configure a opção explicitamente no seu `.env`. Nenhum `.env` existente é modificado pelos scripts.

Defina `SMS_MOCK_FAIL_ALL=true` no backend e reinicie para demonstrar falhas em notificações novas. Remova a falha e use **Reprocessar falha** para uma nova tentativa. Reiniciar não reenvia falhas nem notificações já aceitas.

O MVP verifica pendências no bootstrap e por `POST /exams/process-pending`; não há monitoramento periódico. Não há criação manual de exames pela API. Uma atualização de `PENDING` para `RELEASED` pelo sistema de origem/banco define automaticamente a data de liberação e torna a notificação elegível; ela será processada na próxima verificação.

## Funcionalidades adicionais do dashboard

A navegação começa em **Exames** e mantém **Pacientes e Mensagens**. O dashboard mostra paciente, identificador, status, liberação, envio e erro controlado. Filtros acompanham o contrato paginado da API.

**Atualizar** apenas consulta os dados. **Processar pendentes** executa uma verificação explícita; **Reprocessar falha** exige confirmação. Abrir o React nunca cria dados nem dispara processamento. O modo de e-mail vem de `GET /config`, sem credenciais públicas.

## Decisões técnicas

PostgreSQL demonstra persistência, rastreabilidade, transações e controle das notificações. Bloqueios de registros coordenam processadores simultâneos e a exclusão de pacientes. Um índice único parcial por chave `exam:<id>:RESULT_SMS` permite no máximo uma tentativa `PENDING` ou `SENT`, preservando as tentativas `FAILED` anteriores.

A mensagem automática independe do template editável, garantindo o texto exato mesmo que o usuário altere o template demonstrativo. Por isso, mensagens automáticas podem ter `templateId=null`; envios manuais continuam exigindo template.

O seed serializa execuções concorrentes, usa inserções sem atualização e nunca associa um exame a um contato conflitante pertencente a outro cadastro. A ordem explícita do bootstrap garante seed antes do processamento.

## Limitações conhecidas

- Dados exclusivamente fictícios; **não existe autenticação e o sistema não está pronto para uso real com dados de pacientes**.
- `SENT` significa aceite da simulação ou do SMTP, sem confirmação de entrega. Nenhum SMS real é enviado.
- O mock é determinístico. Um provider real exigiria chave de idempotência no provedor, confirmação de entrega e reconciliação antes de qualquer retry de resultado desconhecido.
- Uma interrupção pode deixar exame `PROCESSING` e mensagem `PENDING`. O dashboard exibe o início do processamento e sinaliza reconciliação após cinco minutos. A conferência é operacional, sem rota que force reenvio de resultados incertos.
- Envios manuais não possuem deduplicação entre requisições. Consulte o histórico antes de repetir um lote interrompido.
- Excluir pacientes remove seus exames e mensagens após confirmação; envios pendentes bloqueiam a exclusão. Com seed habilitado, registros demonstrativos excluídos serão recriados no próximo bootstrap; desabilite-o para evitar a reposição.
- Scripts usam APIs multiplataforma e `taskkill` no Windows. A validação executada neste ambiente é Linux; o encerramento no Windows depende dessa ferramenta nativa.

## Documentação específica

- [Frontend: execução, componentes e fluxo de uso](frontend/README.md)
- [Backend: configuração, contratos, migrations e testes](messaging-api/README.md)

Validação pela raiz:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
```

Os testes e2e exigem PostgreSQL configurado e criam schemas temporários isolados; não apagam o banco existente.
