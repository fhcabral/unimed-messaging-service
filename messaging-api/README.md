# Mensageria hospitalar — API do MVP

Back-end NestJS 11 + TypeORM + PostgreSQL. Importa pacientes via CSV, cadastra templates e registra envios por paciente e canal. **SMS continua com o MockSmsProvider original; EMAIL é simulado por padrão e usa Nodemailer/SMTP somente com `EMAIL_PROVIDER=SMTP`. Exames liberados são notificados automaticamente no bootstrap.** A interface React está em [`../frontend`](../frontend).

**Uso local, sem autenticação. Antes de usar dados reais de pacientes, proteja TODOS os endpoints (inclusive consultas e Swagger), implemente autorização e revise privacidade, retenção e segurança. Use apenas dados fictícios nesta demonstração.**

## Executar

Recomendado: execute `npm run setup` e `npm run dev` na raiz, conforme o [README principal](../README.md). Isso inicia também o frontend.

Pré-requisitos: Node.js 22.12+, npm e Docker Desktop com engine Linux iniciado. No PowerShell, a partir da raiz do repositório:

```powershell
cd messaging-api
npm install
Copy-Item .env.example .env # somente na primeira execução
# Ajuste o .env se a porta 5432 estiver ocupada.
docker compose up -d --wait
npm run migration:run
npm run start:dev
```

API: http://localhost:3000. Swagger interativo: http://localhost:3000/docs. OpenAPI: http://localhost:3000/docs-json. A API escuta somente em 127.0.0.1. O Compose executa exclusivamente PostgreSQL 16, com volume persistente e porta publicada somente em 127.0.0.1.

O Swagger documenta todas as rotas, corpos de entrada, respostas paginadas, relações, campos nulos e erros HTTP. O envio manual inclui `byChannel` apenas quando `channels` é informado; notificações automáticas têm template nulo e o processamento de exames inclui `uncertain`. Exclusões bloqueadas por mensagens `PENDING` ou exames `PROCESSING` retornam 409.

O `.env.example` contém apenas valores de demonstração local. O `.env` não deve ser comitado. Configuração obrigatória: `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`. `DB_PORT` (5432) e `PORT` (3000) aceitam portas válidas. `CORS_ORIGINS` recebe origens HTTP exatas separadas por vírgula; vazio desabilita CORS. CORS não substitui autenticação.

Para simular rejeição de todos os SMS, defina `SMS_MOCK_FAIL_ALL=true` no `.env` e reinicie a API. Por padrão é `false`. Nenhuma configuração faz o mock enviar SMS real.

## Exames e inicialização automática

`DEMO_SEED_ENABLED=true` habilita pacientes, exames e template fictícios no bootstrap. O padrão interno é `false`; o `.env.example` usa `true` para demonstração. Em `NODE_ENV=production`, nunca executa seed. Nenhuma rota pública cria dados demonstrativos. O bootstrap aguarda o seed e então verifica exames liberados, mesmo que o React não esteja aberto. Migrations devem ter sido executadas antes; a aplicação não as executa.

| Endpoint | Comportamento |
| --- | --- |
| `GET /config` | Apenas `{smsProvider:"MOCK",emailProvider:"MOCK" ou "SMTP"}`; sem credenciais. |
| `GET /exams` | `{data,total,page,limit}`, filtros `status` (`PENDING`, `RELEASED`) e `notificationStatus` (`NOT_ELIGIBLE`, `PENDING`, `PROCESSING`, `SENT`, `FAILED`). `page=1`, `limit=20`, máximo 100. Inclui paciente, datas, erro controlado, `processingStartedAt` e `reconciliationRequired`. |
| `POST /exams/process-pending` | Nova verificação de `RELEASED/PENDING`; resposta `{total,sent,failed,uncertain}`. Não reenvia `FAILED`, `SENT` ou `PROCESSING`. |
| `POST /exams/:id/retry` | Nova tentativa apenas para `FAILED`. 409 para outros estados/concorrência, 404 se ausente. Mantém mensagens com falha anteriores. |

O SMS automático usa sempre “Prezado cliente, os resultados dos seus exames estão disponíveis para retirada.”, independente de edições do template. Após aceite do mock, registra `SMS enviado, cliente X`. O histórico automático usa `templateId=null` e uma `notificationKey` estável por exame/tipo.

A migration `1792022402000-exams` adiciona a entidade e o índice único parcial das mensagens `PENDING`/`SENT`. A transação de reserva bloqueia paciente e exame, grava mensagem `PENDING` e exame `PROCESSING`, e é confirmada antes de chamar o provider. A conclusão grava mensagem e exame atomicamente. Falha de provider vira `FAILED` e não interrompe os demais exames; falha ao persistir o resultado deixa `PROCESSING` para conferência, sem reenvio cego. O rollback recusa remover o suporte se houver histórico automático sem template.

A liberação pelo sistema de origem/banco pode ser demonstrada com `UPDATE exams SET status = 'RELEASED' WHERE id = '<uuid>' AND status = 'PENDING';`. Um trigger define `releasedAt` e `notificationStatus=PENDING`. Depois, faça nova verificação ou reinicie. Não há endpoint de criação/liberação nem polling periódico neste MVP.

`PROCESSING` por cinco minutos sinaliza reconciliação no dashboard; isso também pode indicar uma execução longa, não comprova falha. Confira o histórico e o resultado antes de uma intervenção operacional. Um provider real precisa oferecer idempotência e confirmação de entrega; o mock determinístico não demonstra garantia de entrega real.

`EMAIL_PROVIDER=MOCK` é o padrão, inclusive sem qualquer configuração SMTP. O mock aceita o e-mail sem conexão externa. O SMS mock original permanece intacto.

## Configurar e-mail real por SMTP

Atualize as dependências com `npm install`, execute `npm run migration:run` e acrescente ao seu `.env` as variáveis abaixo. Não sobrescreva as configurações existentes de banco e CORS. O `.env.example` mantém os campos de SMTP vazios para evitar envios acidentais.

```dotenv
EMAIL_PROVIDER=SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Preencha `SMTP_HOST` com o host informado pelo seu provedor, `SMTP_USER`/`SMTP_PASS` com a autenticação SMTP e `SMTP_FROM` com um único endereço remetente autorizado (sem nome de exibição). Use senha de aplicativo quando exigida pelo provedor. Nunca coloque credenciais em arquivos versionados ou em variáveis `VITE_*` do front-end. Reinicie a API após alterar o `.env`.

Na porta **587**, use `SMTP_SECURE=false`: o transporte exige upgrade **STARTTLS** antes do envio. Na porta **465**, use `SMTP_SECURE=true` para TLS desde a conexão inicial. A validação de certificado permanece habilitada; não há envio em texto sem TLS. O corpo do e-mail é texto puro, sem HTML ou anexos. O `subject` literal do template é usado como assunto; vazio/ausente utiliza **Mensagem de acompanhamento**. Somente o conteúdo interpola `{{name}}`.

O provider só chama `createTransport()`/`sendMail()` durante um envio solicitado por `POST /messages/send` com `EMAIL`. Não há conexão, verificação SMTP ou envio na inicialização/migration. Sem host, usuário, senha ou remetente, cada tentativa de e-mail vira `FAILED`, sem envio; SMS continua funcionando. Erros SMTP geram mensagens controladas, sem credenciais, conteúdo, destinatário ou resposta bruta em logs. Em `NODE_ENV=test`, o e-mail real é sempre bloqueado, mesmo com credenciais configuradas.

Para uma validação real, configure seu SMTP e importe apenas endereços de teste sob seu controle. Os endereços `example.invalid` do arquivo `examples/patients-multichannel.csv` são fictícios e **não servem para validar entrega**. A interface exige selecionar E-mail e confirmar o lote explicitamente.

## Contrato multicanal e compatibilidade

```json
{
  "templateId": "uuid-v4-do-template",
  "patientIds": ["uuid-v4-paciente-1", "uuid-v4-paciente-2"],
  "channels": ["SMS", "EMAIL"]
}
```

`channels` aceita `SMS`, `EMAIL` ou ambos, sem duplicatas; `[]`, `null` e valores desconhecidos retornam 400. Se omitido, mantém exatamente o fluxo e a resposta legados de SMS: `{total,sent,failed}`. Quando informado, acrescenta `byChannel`:

```json
{
  "total": 4,
  "sent": 3,
  "failed": 1,
  "byChannel": {
    "SMS": { "total": 2, "sent": 2, "failed": 0 },
    "EMAIL": { "total": 2, "sent": 1, "failed": 1 }
  }
}
```

Os totais contam **pares paciente × canal**, não destinatários únicos. O limite continua 100 pacientes por requisição, logo até 200 tentativas com dois canais, processadas sequencialmente. Não há retries automáticos. Cada par gera sua própria mensagem `PENDING` e depois `SENT` ou `FAILED`. Paciente sem telefone para SMS ou sem e-mail para EMAIL gera falha apenas naquele par, sem invocar o provider; os demais continuam. O histórico inclui `channel` e o `subject` efetivamente usado no e-mail. Mensagens históricas anteriores recebem `channel=SMS` na migration.

Para SMS, `SENT` significa aceite do mock; para EMAIL, aceite do mock ou servidor SMTP conforme `EMAIL_PROVIDER`. **Nenhum dos dois confirma entrega ao destinatário.** Falhas SMTP ou de contato são registradas no campo `error`. O resumo não identifica os pacientes que falharam: consulte `GET /messages` antes de reenviar para evitar duplicatas.

## Fluxo completo no PowerShell

O arquivo `examples/patients.csv` usa somente nomes e telefones sintéticos para demonstração; não envie SMS real para esses números.

```powershell
$api = 'http://localhost:3000'

# 1. Importar; curl.exe evita o alias do PowerShell.
curl.exe -X POST "$api/patients/import" -F "file=@examples/patients.csv"
# {"imported":2,"ignored":0,"invalid":0}
# Repetir a importação retorna imported=0 e ignored=2.

# 2. Listar e selecionar pacientes.
$patients = Invoke-RestMethod "$api/patients?page=1&limit=20&search=Fictício"
$patients.data | Select-Object id, name, phone

# 3. Criar um template.
$templateBody = @{
  name = 'Avaliação fictícia'
  content = 'Olá, {{name}}! Como foi seu atendimento?'
} | ConvertTo-Json
$template = Invoke-RestMethod "$api/templates" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($templateBody))
Invoke-RestMethod "$api/templates"

# 4. Simular os envios.
$sendBody = @{
  templateId = $template.id
  patientIds = @($patients.data | ForEach-Object { $_.id })
} | ConvertTo-Json
Invoke-RestMethod "$api/messages/send" -Method Post -ContentType 'application/json' -Body $sendBody
# total=2, sent=2, failed=0

# 5. Consultar o histórico com paciente, template e conteúdo final.
$history = Invoke-RestMethod "$api/messages?page=1&limit=20"
$history.data | Select-Object id, content, status, createdAt, sentAt, error
```

Para demonstrar falhas, ative `SMS_MOCK_FAIL_ALL=true`, reinicie e repita o passo 4: o resumo terá `failed=2`; o histórico conterá `FAILED`, erro controlado e `sentAt=null`.

## Contratos e limites

| Endpoint | Comportamento |
| --- | --- |
| `POST /patients/import` | Multipart, campo `file`, extensão `.csv`, UTF-8, separador vírgula. Aceita `name,phone,email`, `name,phone` legado ou `name,email`. Até 1 MiB e 1000 registros não vazios. Responde 201 com `imported`, `ignored`, `invalid`. |
| `GET /patients` | `page=1`, `limit=20` (máximo 100), `search` opcional por nome/telefone/e-mail. Contatos ausentes são `null`. Responde `{data,total,page,limit}`. |
| `DELETE /patients/:id` | UUID v4. Exclui permanentemente o paciente, exames e mensagens. Responde 204 sem corpo. |
| `POST /patients/bulk-delete` | `{patientIds:["uuid-v4",...]}`, entre 1 e 100 IDs distintos. Exclusão atômica de pacientes, exames e histórico. Responde 200 com `{deleted:n}`. |
| `POST /templates` | `{name,content,subject?}`. Nome até 120 caracteres e conteúdo até 1600; ambos obrigatórios e não vazios. Assunto opcional até 255 caracteres, sem NUL/CR/LF. Responde 201 com template e UUID. |
| `GET /templates` | Lista os templates cadastrados. |
| `POST /messages/send` | `{templateId,patientIds,channels?}` com UUIDs v4. Entre 1 e 100 pacientes distintos. Resposta e comportamento legados se channels for omitido; com channels, inclui `byChannel`. |
| `GET /messages` | Histórico com relações paciente/template; `page`, `limit`, mesmo formato paginado. |

Pacientes: nome até 160 caracteres e pelo menos um contato válido. Telefones brasileiros fixos ou celulares são validados com `libphonenumber-js/max` e armazenados em E.164, por exemplo `+5511999990001`. E-mails são validados, limitados a 254 caracteres e normalizados em minúsculas; contatos vazios viram `null`. Um contato preenchido inválido torna a linha inválida mesmo quando o outro é válido. Telefones e e-mails têm constraints UNIQUE independentes, permitindo múltiplos valores nulos; uma constraint CHECK exige algum contato. Linhas com conflito em qualquer contato são ignoradas, inclusive em importações concorrentes. **Reimportar não atualiza nem completa contatos de um paciente já existente**; mantém a política anterior de não sobrescrever registros.

Linhas vazias são ignoradas; linhas com nome/telefone inválido ou número incorreto de colunas são contadas como inválidas sem impedir as demais. Cabeçalho obrigatório ausente/duplicado, CSV estruturalmente malformado (ex.: aspas abertas), UTF-8 inválido ou excesso de registros rejeitam o arquivo inteiro antes de gravar. Colunas adicionais são toleradas se todas as linhas tiverem a quantidade correta de colunas. O MIME do upload é apenas uma verificação inicial: o conteúdo também é parseado e validado.

Templates permitem somente o token exato `{{name}}`, em qualquer quantidade, ou texto sem variáveis. Outros placeholders, chaves incompletas ou chaves isoladas retornam 400. A interpolação preserva literalmente o nome, inclusive caracteres como `$`.

Envios são síncronos e sequenciais. Todos os IDs são verificados antes de criar mensagens. Template/paciente inexistente retorna 404 sem iniciar envios. Cada paciente/canal é persistido primeiro como `PENDING`; o resultado individual vira `SENT` ou `FAILED`. A falha de um provider/contato não impede os demais envios; falhas de persistência interrompem a requisição para não enviar sem histórico confiável. Erros do provider são substituídos por mensagens controladas, sem dados pessoais nos logs.

No envio manual, não há deduplicação entre requisições de envio: repetir o POST cria novos envios. Em caso de interrupção do processo ou erro de banco após o aceite, podem permanecer registros `PENDING`. Não há retentativa automática, reconciliação, filas ou garantia de entrega neste MVP. Não repita cegamente uma requisição interrompida.

Entradas inválidas retornam 400, upload acima de 1 MiB retorna 413 e falhas internas retornam 500 com mensagem genérica. Campos desconhecidos dos DTOs são rejeitados. O histórico contém conteúdo e dados dos pacientes, portanto também precisa ser protegido antes de uso real.

## Excluir pacientes/leads

A interface oferece lixeira por linha e **Excluir selecionados**, incluindo a seleção mantida em outras páginas. A confirmação informa que o cadastro e todo o histórico de mensagens desses pacientes serão apagados permanentemente. Templates permanecem cadastrados; a exclusão não cancela SMS/e-mails já processados.

Na API, use `DELETE /patients/:id` para um paciente ou `POST /patients/bulk-delete` com `patientIds` para até 100. A transação bloqueia os registros, valida a existência de todos os IDs, impede excluir pacientes com mensagens `PENDING` e só então remove exames, mensagens e pacientes. Um ID inexistente retorna 404; um envio pendente retorna 409; UUIDs inválidos, duplicados ou quantidade fora do limite retornam 400. Em qualquer desses casos, nenhum paciente do lote é excluído.

Envios `PENDING` que permaneceram após interrupção da aplicação precisam ser reconciliados antes da exclusão; o sistema não assume que o envio foi cancelado. Depois da exclusão, os contatos ficam livres para uma nova importação. Exames vinculados também são removidos na mesma transação, antes das mensagens. Exames `PROCESSING` bloqueiam a exclusão.

## Banco e migrations

`synchronize` e execução automática de migrations estão desabilitados em todos os ambientes. A migration inicial cria as três tabelas, enum de status, UUIDs, timestamps, constraint de telefone único, chaves estrangeiras com `RESTRICT` e índices do histórico.

A migration `1792022401000-multichannel` torna `phone` nullable, adiciona e-mail único e a exigência de contato, adiciona assunto aos templates e assunto/canal ao histórico. Não apaga os dados existentes. O rollback remove os campos novos e bloqueia a operação se houver pacientes sem telefone, evitando descartá-los para restaurar a constraint antiga.

```powershell
npm run migration:show
npm run migration:run
npm run migration:generate -- src/database/migrations/NomeDaAlteracao
# Reverter remove tabelas e dados da migration; usar apenas quando intencional:
npm run migration:revert
```

Após gerar uma migration, registre a nova classe em `src/database/database.options.ts`. A configuração compartilha entidades e migrations entre a API e a CLI.

Execução compilada (a aplicação exige as mesmas variáveis de ambiente):

```powershell
npm run build
npm run migration:run:prod
npm run start:prod
```

Para parar o PostgreSQL preservando os dados: `docker compose stop`. O exemplo de credencial é exclusivamente local.

## Validação

```powershell
npm run lint
npm run build
npm test -- --runInBand
# Valida o OpenAPI, referências, contratos e Swagger UI sem exigir banco:
npm run test:swagger
# Exige o PostgreSQL iniciado e o .env configurado:
npm run test:e2e -- --runInBand
```

Os testes unitários verificam importação, linhas inválidas, duplicatas, limites, templates, placeholders, interpolação, aceite pelo mock e falhas individuais. Os testes e2e exercitam HTTP, upload, ValidationPipe, Swagger e persistência real em PostgreSQL, incluindo execução/reversão/reexecução da migration. Criam um schema temporário de nome aleatório no banco configurado e removem somente esse schema ao terminar; exigem permissão de criar schema. Execute-os somente em banco local de desenvolvimento e com `SMS_MOCK_FAIL_ALL=false`.

`npm run test:swagger` também pode ser executado na raiz. Usa os controllers reais e o mesmo `setupApp`, com serviços substituídos para evitar banco, seed ou envio. Valida o documento gerado em `/docs-json` com `@apidevtools/swagger-parser`, a cobertura das rotas e seus códigos HTTP, os limites de entrada e a disponibilidade da interface Swagger. Esse teste também faz parte de `npm test`.

Os novos testes verificam seleção do provider de e-mail, validação do ambiente, transição de liberação, persistência antes do envio, concorrência, erros individuais, retries confirmados, estados incertos e seed idempotente com preservação de edições e conflitos de contatos. O provider bloqueia e-mail real em ambiente de teste. A entrega por um servidor SMTP externo exige validação manual com credenciais e destinatário sob seu controle.

A exclusão foi conferida por HTTP em schema temporário com dados fictícios: exclusão individual e em lote, remoção do histórico, bloqueio de pendências, validação de IDs, atomicidade, preservação de templates e reimportação dos contatos. Nenhum paciente existente foi removido durante essa verificação.

## Organização

- `src/contexts/patients`: upload, normalização/validação, importação e listagem.
- `src/contexts/templates`: validação, cadastro e listagem.
- `src/contexts/messages`: envio síncrono, provider injetável e histórico.
- `src/contexts/exams`: listagem e processamento de notificações com idempotência.
- `src/database/seeds`: dados fictícios e preparação idempotente.
- `src/database/bootstrap.service.ts`: executa seed antes das notificações.
- `src/database`: configuração compartilhada, DataSource e migrations.
- `src/config` e `src/common`: ambiente, paginação e erros HTTP sem dados pessoais nos logs.
- `src/setup-app.ts`: validação global, CORS e Swagger, reutilizados nos testes HTTP.
- `examples/patients.csv`: dados sintéticos para testar o fluxo.
- `examples/patients-multichannel.csv`: CSV com telefone/e-mail opcionais e endereços fictícios.

Provider de e-mail implementado conforme a [documentação oficial de SMTP do Nodemailer](https://nodemailer.com/smtp), com texto puro e sem logs SMTP.

Referências de implementação: [CSV Parse](https://csv.js.org/parse/options/relax_column_count/), [TypeORM InsertQueryBuilder](https://github.com/typeorm/typeorm/blob/0.3.31/src/query-builder/InsertQueryBuilder.ts) e [NestJS 11](https://github.com/nestjs/nest/tree/v11.0.1).
