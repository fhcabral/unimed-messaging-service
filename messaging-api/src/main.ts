import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(
    app.get(ConfigService).getOrThrow<number>('PORT'),
    '127.0.0.1',
  );
}
void bootstrap();
