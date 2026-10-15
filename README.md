# unimed-messaging-service
MVP local de mensageria hospitalar em NestJS, TypeScript e PostgreSQL: importação de pacientes via CSV, templates personalizados e envio síncrono de SMS por provider mock, com histórico de status.

O back-end está em [`messaging-api`](messaging-api). Consulte o [guia de instalação, execução e exemplos da API](messaging-api/README.md). A documentação interativa fica em `http://localhost:3000/docs` após iniciar a aplicação.

Esta etapa não inclui front-end nem autenticação. Utilize somente dados fictícios; todos os endpoints precisam ser protegidos antes de qualquer uso real com dados de pacientes. `SENT` indica somente aceite simulado pelo mock, sem envio ou confirmação de entrega de SMS real.
