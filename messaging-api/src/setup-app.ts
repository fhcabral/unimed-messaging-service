import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter';

export function setupApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const origins = app
    .get(ConfigService)
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : false });
  const config = new DocumentBuilder()
    .setTitle('Mensageria hospitalar — MVP local')
    .setDescription(
      'Sem autenticação: proteger os endpoints antes do uso real. SMS permanece simulado; EMAIL é mock por padrão e usa SMTP somente quando EMAIL_PROVIDER=SMTP. SENT significa aceite pelo mock ou SMTP, sem confirmação de entrega. Exames liberados são processados automaticamente após o seed demonstrativo opcional.',
    )
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
}
