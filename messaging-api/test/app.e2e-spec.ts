import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { validateEnvironment } from '../src/config/environment';
import { databaseOptions } from '../src/database/database.options';
import { setupApp } from '../src/setup-app';
import { SMS_PROVIDER } from '../src/contexts/messages/providers/sms-provider.interface';
import { MockSmsProvider } from '../src/contexts/messages/providers/mock-sms.provider';
import {
  Message,
  MessageStatus,
} from '../src/contexts/messages/entities/message.entity';
import { Patient } from '../src/contexts/patients/entities/patient.entity';
import { MessageTemplate } from '../src/contexts/templates/entities/message-template.entity';
import { AppModule } from '../src/app.module';

jest.setTimeout(30000);

describe('API + PostgreSQL (isolated temporary schema)', () => {
  let app: INestApplication<App>;
  let admin: DataSource;
  let database: DataSource;
  let provider: MockSmsProvider;
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  let templateId: string;
  let patientIds: string[];

  beforeAll(async () => {
    const options = databaseOptions(validateEnvironment(process.env));
    admin = await new DataSource(options).initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    database = await new DataSource({
      ...options,
      schema,
      extra: { options: `-c search_path=${schema}` },
    }).initialize();
    await database.runMigrations();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ...validateEnvironment(process.env),
          DEMO_SEED_ENABLED: 'false',
          SMS_MOCK_FAIL_ALL: 'false',
          EMAIL_PROVIDER: 'MOCK',
        }),
      )
      .overrideProvider(DataSource)
      .useValue(database)
      .compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    provider = module.get<MockSmsProvider>(SMS_PROVIDER);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.destroy();
    }
  });

  it('serves Swagger and the existing root endpoint', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Servidor OK!');
    await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect((response: request.Response) => {
        expect(
          (response.body as { paths: Record<string, unknown> }).paths,
        ).toHaveProperty('/patients/import');
      });
  });

  it('rejects missing files, wrong extension, oversized files and malformed CSV', async () => {
    await request(app.getHttpServer()).post('/patients/import').expect(400);
    await request(app.getHttpServer())
      .post('/patients/import')
      .attach('file', Buffer.from('name,phone'), 'patients.txt')
      .expect(400);
    await request(app.getHttpServer())
      .post('/patients/import')
      .attach('file', Buffer.alloc(1024 * 1024 + 1, 'a'), 'patients.csv')
      .expect(413);
    await request(app.getHttpServer())
      .post('/patients/import')
      .attach('file', Buffer.from('name,address\nA,b'), 'patients.csv')
      .expect(400);
  });

  it('imports valid rows, counts invalid and duplicate rows, and persists normalized phones', async () => {
    const csv =
      'name,phone\nPaciente Fictício Alfa,11999990001\nPaciente Fictício Beta,21999990002\nDuplicado Fictício,+5511999990001\nInválido,abc\n,11999990003\n';
    await request(app.getHttpServer())
      .post('/patients/import')
      .attach('file', Buffer.from(csv), 'patients.csv')
      .expect(201)
      .expect({ imported: 2, ignored: 1, invalid: 2 });
    await request(app.getHttpServer())
      .post('/patients/import')
      .attach('file', Buffer.from(csv), 'patients.csv')
      .expect(201)
      .expect({ imported: 0, ignored: 3, invalid: 2 });
    const patients = await database
      .getRepository(Patient)
      .find({ order: { name: 'ASC' } });
    expect(patients.map((patient) => patient.phone)).toEqual([
      '+5511999990001',
      '+5521999990002',
    ]);
    patientIds = patients.map((patient) => patient.id);
    await request(app.getHttpServer())
      .get('/patients?page=1&limit=1&search=Fictício')
      .expect(200)
      .expect((response: request.Response) => {
        const body = response.body as { total: number; data: Patient[] };
        expect(body.total).toBe(2);
        expect(body.data).toHaveLength(1);
      });
    await request(app.getHttpServer())
      .get('/patients?search=5511')
      .expect(200)
      .expect((response: request.Response) => {
        expect((response.body as { total: number }).total).toBe(1);
      });
    await request(app.getHttpServer())
      .get('/patients?page=0&limit=101')
      .expect(400);
    await request(app.getHttpServer())
      .get('/patients?extra=invalid')
      .expect(400);
  });

  it('validates templates, rejects unknown placeholders, and lists persisted templates', async () => {
    await request(app.getHttpServer())
      .post('/templates')
      .send({ name: 'Fictício', content: 'Olá {{phone}}' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/templates')
      .send({ name: ' ', content: ' ' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/templates')
      .send({
        name: 'Avaliação fictícia',
        content: 'Olá, {{name}}! Obrigado, {{name}}.',
      })
      .expect(201)
      .expect((response: request.Response) => {
        templateId = (response.body as MessageTemplate).id;
      });
    await request(app.getHttpServer())
      .get('/templates')
      .expect(200)
      .expect((response: request.Response) => {
        expect(response.body as MessageTemplate[]).toHaveLength(1);
      });
  });

  it('rejects invalid, duplicate, excessive and missing IDs before sending anything', async () => {
    const endpoint = () => request(app.getHttpServer()).post('/messages/send');
    await endpoint().send({ templateId: 'invalid', patientIds }).expect(400);
    await endpoint().send({ templateId, patientIds: [] }).expect(400);
    await endpoint()
      .send({
        templateId,
        patientIds: [patientIds[0], patientIds[0].toUpperCase()],
      })
      .expect(400);
    await endpoint()
      .send({
        templateId,
        patientIds: Array.from({ length: 101 }, () => randomUUID()),
      })
      .expect(400);
    await endpoint()
      .send({ templateId, patientIds: [patientIds[0], randomUUID()] })
      .expect(404);
    await endpoint().send({ templateId: randomUUID(), patientIds }).expect(404);
    expect(await database.getRepository(Message).count()).toBe(0);
  });

  it('sends via the mock, interpolates content and exposes paginated history', async () => {
    await request(app.getHttpServer())
      .post('/messages/send')
      .send({ templateId, patientIds })
      .expect(200)
      .expect({ total: 2, sent: 2, failed: 0 });
    const messages = await database
      .getRepository(Message)
      .find({ relations: { patient: true } });
    for (const message of messages) {
      expect(message.status).toBe('SENT');
      expect(message.content).toBe(
        `Olá, ${message.patient.name}! Obrigado, ${message.patient.name}.`,
      );
      expect(message.sentAt).toBeInstanceOf(Date);
      expect(message.error).toBeNull();
    }
    await request(app.getHttpServer())
      .get('/messages?page=1&limit=1')
      .expect(200)
      .expect((response: request.Response) => {
        const body = response.body as { total: number; data: Message[] };
        expect(body.total).toBe(2);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].patient.id).toBeDefined();
        expect(body.data[0].template.id).toBe(templateId);
      });
  });

  it('persists FAILED safely and continues processing the next patient', async () => {
    const spy = jest
      .spyOn(provider, 'send')
      .mockRejectedValueOnce(new Error('Private provider response'));
    try {
      await request(app.getHttpServer())
        .post('/messages/send')
        .send({ templateId, patientIds })
        .expect(200)
        .expect({ total: 2, sent: 1, failed: 1 });
      expect(spy).toHaveBeenCalledTimes(2);
      const failed = await database
        .getRepository(Message)
        .findOneByOrFail({ status: MessageStatus.FAILED });
      expect(failed.sentAt).toBeNull();
      expect(failed.error).toBe('O provider mock rejeitou o envio simulado.');
    } finally {
      spy.mockRestore();
    }
  });

  it('reverts and reapplies the migration without synchronize', async () => {
    for (let index = 0; index < database.migrations.length; index++) {
      await database.undoLastMigration();
    }
    expect(await database.showMigrations()).toBe(true);
    await database.runMigrations();
    expect(await database.getRepository(Patient).count()).toBe(0);
    expect(await database.showMigrations()).toBe(false);
  });
});
