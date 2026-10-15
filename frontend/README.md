# Mensageria Hospitalar — Front-end

Página única em React + TypeScript + Vite, com CSS Modules e integração real com o NestJS por Axios. Não utiliza dados mockados, bibliotecas de interface, formulários, tabelas ou estado global.

## Iniciar

Pré-requisitos: Node.js 22.12+ (validado com 22.16) e o back-end configurado conforme [`../messaging-api/README.md`](../messaging-api/README.md).

Em um terminal, inicie a API na pasta `messaging-api`:

```powershell
docker compose up -d --wait
npm run migration:run
npm run start:dev
```

Em outro terminal, a partir da raiz do repositório:

```powershell
cd frontend
npm install
Copy-Item .env.example .env # somente na primeira configuração
npm run dev
```

Abra **http://localhost:5173**. A porta é fixa: se estiver ocupada, o Vite avisa em vez de escolher outra origem e quebrar o CORS.

O front-end usa `VITE_API_URL=http://localhost:3000`, configurável no `.env`. Na ausência da variável, utiliza esse mesmo endereço. Reinicie o Vite após alterar variáveis de ambiente. O `.env` é ignorado pelo Git; a URL da API é pública no bundle e não deve conter segredos.

O back-end existente já permite `CORS_ORIGINS=http://localhost:5173`, portanto não foi necessário modificá-lo. Abra o front-end por `localhost`, pois `127.0.0.1` representa uma origem diferente. Para outras origens ou portas, configure o CORS do ambiente da API e reinicie-a.

## Fluxo de uso

1. Clique em **Importar pacientes** e selecione um CSV. O arquivo [`../messaging-api/examples/patients.csv`](../messaging-api/examples/patients.csv) contém dados fictícios para demonstração. O cabeçalho deve ser `name,phone`, com separador vírgula e codificação UTF-8.
2. Confira o resumo de importados, ignorados e inválidos. A listagem é atualizada automaticamente. O servidor valida as linhas e aceita até 1.000 registros; a interface também rejeita arquivos vazios, extensão diferente de `.csv` e tamanho acima de 1 MiB.
3. Busque por nome ou telefone e selecione os pacientes. O checkbox do cabeçalho seleciona somente a página atual. A seleção permanece ao paginar, mudar o tamanho da página ou buscar outros pacientes. O limite é 100 selecionados por lote.
4. Escolha um template ou clique em **+** para criá-lo. O modal valida título, conteúdo e o token exato `{{name}}`, aceita até 120 caracteres no título e 1.600 no conteúdo e seleciona automaticamente o template criado.
5. A prévia usa o primeiro paciente selecionado; sem seleção, mantém o token `{{name}}` visível. Não há nomes ou mensagens fictícias pré-carregadas no front-end.
6. Clique em **Enviar mensagens**, confira destinatários/template e confirme. A interface bloqueia alterações e novos disparos durante a requisição.
7. O resultado mostra total, aceitos pelo mock e falhas. A seleção é limpa somente após sucesso completo. Em falha parcial ou erro de rede, permanece selecionada com um aviso para evitar reenvios duplicados.

O POST de envio não possui timeout automático nem retentativas: a API processa até 100 envios de forma síncrona. Uma interrupção de rede pode deixar o resultado incerto. Como a resposta contém somente contagens, não é possível determinar no front-end quais pacientes falharam; não repita o lote sem conferir o histórico em `GET /messages` ou no Swagger da API.

## Contratos utilizados

| Endpoint                | Entrada                            | Resposta                                                    |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `POST /patients/import` | `FormData`, campo `file`           | `{ imported, ignored, invalid }`                            |
| `GET /patients`         | `page`, `limit`, `search` opcional | `{ data, total, page, limit }`                              |
| `GET /templates`        | —                                  | Array de templates com `id`, `name`, `content`, `createdAt` |
| `POST /templates`       | `{ name, content }`                | Template criado                                             |
| `POST /messages/send`   | `{ templateId, patientIds }`       | `{ total, sent, failed }`                                   |

O Axios é centralizado em `src/services/api.ts`; somente os arquivos em `services` conhecem os endpoints. As consultas cancelam requisições antigas ao mudar a busca/página ou desmontar a tela, evitando substituir dados novos por respostas antigas. A busca tem debounce de 300 ms. Todos os dados de pacientes e templates exibidos vêm da API.

## Organização

```text
src/
  components/
    CsvImporter/
    PatientTable/
    TemplateSelect/
    TemplateModal/
    SendMessageBar/
    Dialog/
    Feedback/
    Icon/
  pages/Dashboard/
  services/
  types/
  hooks/
  styles/
```

Os componentes visuais possuem `.tsx` e `.module.css`. O modal usa o elemento nativo `dialog` para manter o foco e restringir a navegação por teclado à janela aberta, com fechamento por Escape e retorno do foco ao acionador. Durante gravações ou envio, o fechamento é bloqueado até a resposta para evitar operações sem acompanhamento.

## Build

```powershell
npm run build
npm run preview
```

O build executa a checagem estrita do TypeScript e gera os arquivos em `dist/`. O preview serve em `http://localhost:4173`; para consumir a API nessa origem, inclua-a no `CORS_ORIGINS` do ambiente do back-end. Nenhum teste automatizado foi adicionado nesta etapa, conforme o escopo.

Esta é uma demonstração sem autenticação. Utilize apenas dados fictícios e proteja front-end e API antes de qualquer uso real com dados de pacientes. **Aceite pelo mock não significa envio real nem entrega de SMS no celular.**
