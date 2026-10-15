# Mensageria hospitalar — API do MVP

Back-end NestJS 11 + TypeORM + PostgreSQL. Importa pacientes fictícios via CSV, cadastra templates e simula o aceite de SMS, mantendo o histórico. O projeto Nest original foi mantido; não há front-end nesta entrega.

**Uso local, sem autenticação. Antes de usar dados reais de pacientes, proteja TODOS os endpoints (inclusive consultas e Swagger), implemente autorização e revise privacidade, retenção e segurança. Use apenas dados fictícios nesta demonstração.**

## Executar

Pré-requisitos: Node.js 22+, npm e Docker Desktop com engine Linux iniciado. No PowerShell, a partir da raiz do repositório:

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

O `.env.example` contém apenas valores de demonstração local. O `.env` não deve ser comitado. Configuração obrigatória: `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`. `DB_PORT` (5432) e `PORT` (3000) aceitam portas válidas. `CORS_ORIGINS` recebe origens HTTP exatas separadas por vírgula; vazio desabilita CORS. CORS não substitui autenticação.

Para simular rejeição de todos os SMS, defina `SMS_MOCK_FAIL_ALL=true` no `.env` e reinicie a API. Por padrão é `false`. Nenhuma configuração faz o mock enviar SMS real.

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
| `POST /patients/import` | Multipart, campo `file`, extensão `.csv`, UTF-8, separador vírgula, cabeçalho `name,phone`. Até 1 MiB e 1000 registros não vazios. Responde 201 com `imported`, `ignored`, `invalid`. |
| `GET /patients` | `page=1`, `limit=20` (máximo 100), `search` opcional por nome/telefone. Responde `{data,total,page,limit}`. |
| `POST /templates` | `{name,content}`. Nome até 120 caracteres e conteúdo até 1600; ambos obrigatórios e não vazios. Responde 201 com template e UUID. |
| `GET /templates` | Lista os templates cadastrados. |
| `POST /messages/send` | `{templateId,patientIds}` com UUIDs v4. Entre 1 e 100 pacientes distintos. Responde 200 com `{total,sent,failed}`. |
| `GET /messages` | Histórico com relações paciente/template; `page`, `limit`, mesmo formato paginado. |

Pacientes: nome até 160 caracteres; telefones brasileiros fixos ou celulares são validados com `libphonenumber-js/max` e armazenados em E.164, por exemplo `+5511999990001`. Texto, ramais, DDD inválido e números estrangeiros são rejeitados. Telefones duplicados no arquivo ou já existentes são ignorados por constraint UNIQUE, inclusive em importações concorrentes. O nome existente não é sobrescrito.

Linhas vazias são ignoradas; linhas com nome/telefone inválido ou número incorreto de colunas são contadas como inválidas sem impedir as demais. Cabeçalho obrigatório ausente/duplicado, CSV estruturalmente malformado (ex.: aspas abertas), UTF-8 inválido ou excesso de registros rejeitam o arquivo inteiro antes de gravar. Colunas adicionais são toleradas se todas as linhas tiverem a quantidade correta de colunas. O MIME do upload é apenas uma verificação inicial: o conteúdo também é parseado e validado.

Templates permitem somente o token exato `{{name}}`, em qualquer quantidade, ou texto sem variáveis. Outros placeholders, chaves incompletas ou chaves isoladas retornam 400. A interpolação preserva literalmente o nome, inclusive caracteres como `$`.

Envios são síncronos e sequenciais. Todos os IDs são verificados antes de criar mensagens. Template/paciente inexistente retorna 404 sem iniciar envios. Cada mensagem é persistida primeiro como `PENDING`; o resultado individual vira `SENT` ou `FAILED`. `SENT` significa **aceite simulado pelo mock**, sem confirmação de entrega no celular. Falha de um envio não impede os demais. Erros do provider são substituídos por uma mensagem fixa para não persistir dados pessoais acidentais. Não há logs de telefone/conteúdo completos.

Não há deduplicação entre requisições de envio: repetir o POST cria novos envios. Em caso de interrupção do processo ou erro de banco após o aceite, podem permanecer registros `PENDING`. Não há retentativa automática, reconciliação, filas ou garantia de entrega neste MVP. Não repita cegamente uma requisição interrompida.

Entradas inválidas retornam 400, upload acima de 1 MiB retorna 413 e falhas internas retornam 500 com mensagem genérica. Campos desconhecidos dos DTOs são rejeitados. O histórico contém conteúdo e dados dos pacientes, portanto também precisa ser protegido antes de uso real.

## Banco e migrations

`synchronize` e execução automática de migrations estão desabilitados em todos os ambientes. A migration inicial cria as três tabelas, enum de status, UUIDs, timestamps, constraint de telefone único, chaves estrangeiras com `RESTRICT` e índices do histórico.

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
# Exige o PostgreSQL iniciado e o .env configurado:
npm run test:e2e -- --runInBand
```

Os testes unitários verificam importação, linhas inválidas, duplicatas, limites, templates, placeholders, interpolação, aceite pelo mock e falhas individuais. Os testes e2e exercitam HTTP, upload, ValidationPipe, Swagger e persistência real em PostgreSQL, incluindo execução/reversão/reexecução da migration. Criam um schema temporário de nome aleatório no banco configurado e removem somente esse schema ao terminar; exigem permissão de criar schema. Execute-os somente em banco local de desenvolvimento e com `SMS_MOCK_FAIL_ALL=false`.

## Organização

- `src/contexts/patients`: upload, normalização/validação, importação e listagem.
- `src/contexts/templates`: validação, cadastro e listagem.
- `src/contexts/messages`: envio síncrono, provider injetável e histórico.
- `src/database`: configuração compartilhada, DataSource e migration.
- `src/config` e `src/common`: ambiente, paginação e erros HTTP sem dados pessoais nos logs.
- `src/setup-app.ts`: validação global, CORS e Swagger, reutilizados nos testes HTTP.
- `examples/patients.csv`: dados sintéticos para testar o fluxo.

Referências de implementação: [CSV Parse](https://csv.js.org/parse/options/relax_column_count/), [TypeORM InsertQueryBuilder](https://github.com/typeorm/typeorm/blob/0.3.31/src/query-builder/InsertQueryBuilder.ts) e [NestJS 11](https://github.com/nestjs/nest/tree/v11.0.1).
