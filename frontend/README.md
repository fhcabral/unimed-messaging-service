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

1. Clique em **Importar pacientes** e selecione um CSV UTF-8 com separador vírgula. Aceita `name,phone,email`, `name,phone` legado ou `name,email`. Cada paciente precisa de telefone, e-mail ou ambos. Veja [`patients.csv`](../messaging-api/examples/patients.csv) e [`patients-multichannel.csv`](../messaging-api/examples/patients-multichannel.csv). Os e-mails `example.invalid` são fictícios, sem destinatários reais.
2. Confira o resumo de importados, ignorados e inválidos. A listagem é atualizada automaticamente. O servidor valida as linhas e aceita até 1.000 registros; a interface também rejeita arquivos vazios, extensão diferente de `.csv` e tamanho acima de 1 MiB.
3. Busque por nome, telefone ou e-mail e selecione os pacientes. A tabela mostra os dois contatos; ausência é exibida como “Não informado”. O checkbox do cabeçalho seleciona somente a página atual. A seleção permanece ao paginar, mudar o tamanho da página ou buscar outros pacientes. O limite é 100 selecionados por lote.
4. Escolha um template ou clique em **+** para criá-lo. O modal valida título, conteúdo, o token exato `{{name}}` e assunto opcional para e-mail: até 120 caracteres no título, 1.600 no conteúdo e 255 no assunto. O template criado é selecionado automaticamente.
5. Selecione **SMS**, **E-mail** ou ambos. SMS é o padrão e continua simulado; **e-mail é real via SMTP**, configurado somente no back-end. Sem canais selecionados, o envio fica desabilitado. A prévia usa o primeiro paciente selecionado e mostra o assunto quando E-mail está marcado. O assunto vazio usa “Mensagem de acompanhamento”; o assunto é literal, e somente o conteúdo interpola `{{name}}`.
6. Clique em **Enviar mensagens**, confira destinatários, template, canais e quantidade de envios e confirme. A interface avisa explicitamente quando haverá e-mail real e quando há pacientes sem contato para um canal. Esses pares serão registrados como falha, sem impedir os demais. Durante a requisição, bloqueia alterações e novos disparos.
7. O resultado mostra totais e resumo por canal, distinguindo aceites do mock SMS e do SMTP real. Os totais contam paciente × canal: dois pacientes em dois canais geram quatro tentativas. A seleção é limpa somente após sucesso completo. Em falha parcial ou erro de rede, permanece selecionada com um aviso para evitar reenvios duplicados.

O POST de envio não possui timeout automático nem retentativas: a API processa até 100 pacientes (até 200 pares paciente/canal) de forma síncrona. Uma interrupção de rede pode deixar o resultado incerto. Como a resposta contém somente contagens, não é possível determinar no front-end quais pacientes falharam; não repita o lote sem conferir o histórico em `GET /messages` ou no Swagger da API. O histórico inclui canal, assunto efetivo e erros individuais.

## Excluir pacientes/leads

Use a **lixeira** na linha do paciente ou selecione até 100 pacientes e clique em **Excluir selecionados**. A exclusão dos selecionados considera também outras páginas, conforme a seleção existente. O modal pede confirmação e explica que os cadastros e seu histórico de mensagens serão apagados permanentemente. O foco inicial fica em **Cancelar**.

Durante a exclusão, os controles são bloqueados para impedir ações duplicadas. Após sucesso, a seleção remove os pacientes excluídos e a lista/paginação é atualizada. Em caso de erro, o modal mostra o motivo e permite cancelar. A API bloqueia lotes com pacientes inexistentes ou mensagens pendentes sem excluir parcialmente os outros pacientes. Templates não são apagados. Excluir um paciente não cancela um e-mail que já foi enviado.

O front-end usa `POST /patients/bulk-delete` com `{patientIds}` tanto para exclusão individual como em lote e recebe `{deleted}`. A API também oferece `DELETE /patients/:id` para integrações.

Configure SMTP em [`messaging-api/.env`](../messaging-api/.env.example), conforme o [guia de SMTP do back-end](../messaging-api/README.md#configurar-e-mail-real-por-smtp), e execute a nova migration antes de iniciar a API. Nenhuma credencial SMTP deve aparecer no front-end ou em variáveis `VITE_*`. Sem configuração completa, e-mails falham sem enviar; o mock SMS continua funcionando. Nenhum envio ocorre automaticamente ao abrir a página.

## Contratos utilizados

| Endpoint                | Entrada                                | Resposta                                                               |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `POST /patients/import` | `FormData`, campo `file`               | `{ imported, ignored, invalid }`                                       |
| `GET /patients`         | `page`, `limit`, `search` opcional     | `{ data, total, page, limit }`                                         |
| `GET /templates`        | —                                      | Array de templates com `id`, `name`, `content`, `subject`, `createdAt` |
| `POST /templates`       | `{ name, content, subject? }`          | Template criado                                                        |
| `POST /messages/send`   | `{ templateId, patientIds, channels }` | `{ total, sent, failed, byChannel }`                                   |

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

Esta é uma aplicação local sem autenticação. Utilize dados fictícios e endereços de teste sob seu controle; proteja front-end e API antes de qualquer uso real com dados de pacientes. **SMS permanece simulado; e-mail é real quando o SMTP está configurado. Aceite pelo provider não comprova entrega ao celular ou à caixa de entrada.**
