# unimed-messaging-service
MVP local de mensageria hospitalar em NestJS, React, TypeScript e PostgreSQL: importação de pacientes via CSV, templates personalizados e envio síncrono multicanal, com histórico por paciente/canal. **SMS continua simulado pelo mock original; e-mail é real via Nodemailer/SMTP quando configurado.**

O back-end está em [`messaging-api`](messaging-api). Consulte o [guia de instalação, execução e exemplos da API](messaging-api/README.md). A documentação interativa fica em `http://localhost:3000/docs` após iniciar a aplicação.

O front-end está em [`frontend`](frontend), com React, TypeScript e Vite. Consulte o [guia de execução da interface](frontend/README.md). Após iniciar a API, execute `npm install` e `npm run dev` nessa pasta e acesse `http://localhost:5173`.

Pacientes/leads podem ser excluídos pela lixeira individual ou por **Excluir selecionados**, com confirmação. A exclusão apaga também o histórico vinculado, preserva templates e é bloqueada se houver envios pendentes.

Para ativar e-mail, atualize as dependências, execute `npm run migration:run` em `messaging-api` e configure as variáveis `SMTP_*` no `.env` do back-end. Consulte o [guia SMTP](messaging-api/README.md#configurar-e-mail-real-por-smtp). CSVs antigos e requisições sem `channels` preservam o fluxo SMS. Não há conexão ou envio de e-mail na inicialização; sem SMTP completo, o canal EMAIL falha sem enviar.

O MVP não inclui autenticação. Utilize dados fictícios e endereços de teste sob seu controle; todos os endpoints precisam ser protegidos antes de qualquer uso real com dados de pacientes. `SENT` significa aceite do mock SMS ou servidor SMTP, sem confirmação de entrega ao destinatário.
