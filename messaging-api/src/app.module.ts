import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from './config/environment';
import { databaseOptions } from './database/database.options';
import { PatientsModule } from './contexts/patients/patients.module';
import { TemplatesModule } from './contexts/templates/templates.module';
import { SeedModule } from './database/seeds/seed.module';
import { DatabaseBootstrapService } from './database/bootstrap.service';
import { ExamsModule } from './contexts/exams/exams.module';
import { MessagesModule } from './contexts/messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions({
          DB_HOST: config.getOrThrow<string>('DB_HOST'),
          DB_PORT: config.getOrThrow<number>('DB_PORT'),
          DB_USERNAME: config.getOrThrow<string>('DB_USERNAME'),
          DB_PASSWORD: config.getOrThrow<string>('DB_PASSWORD'),
          DB_DATABASE: config.getOrThrow<string>('DB_DATABASE'),
        }),
        retryAttempts: 1,
      }),
    }),
    PatientsModule,
    TemplatesModule,
    MessagesModule,
    ExamsModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseBootstrapService],
})
export class AppModule {}
