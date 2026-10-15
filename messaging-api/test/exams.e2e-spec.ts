import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { validateEnvironment } from '../src/config/environment';
import { databaseOptions } from '../src/database/database.options';
import { setupApp } from '../src/setup-app';
import { Exam, ExamStatus } from '../src/contexts/exams/entities/exam.entity';
import { ExamNotificationService } from '../src/contexts/exams/exam-notification.service';
import { EXAM_NOTIFICATION_CONTENT } from '../src/contexts/exams/exam-notification.constants';
import { Patient } from '../src/contexts/patients/entities/patient.entity';
import {
  Message,
  MessageStatus,
} from '../src/contexts/messages/entities/message.entity';
import { SMS_PROVIDER } from '../src/contexts/messages/providers/sms-provider.interface';
import { DatabaseBootstrapService } from '../src/database/bootstrap.service';
import { SeedService } from '../src/database/seeds/seed.service';
import {
  DEMO_PATIENTS,
  DEMO_EXAMS,
  DEMO_TEMPLATE,
} from '../src/database/seeds/data/demo-data';
import { MessageTemplate } from '../src/contexts/templates/entities/message-template.entity';
import { MockSmsProvider } from '../src/contexts/messages/providers/mock-sms.provider';

jest.setTimeout(30000);

describe('Exams + PostgreSQL (isolated schema)', () => {
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication<App>;
  let notifications: ExamNotificationService;
  let sms: MockSmsProvider;
  let config: ConfigService;
  let patient: Patient;
  const schema = `exams_test_${randomUUID().replaceAll('-', '')}`;
  const exams = () => database.getRepository(Exam);
  const messages = () => database.getRepository(Message);
  const createExam = (status = ExamStatus.RELEASED) =>
    exams().save(exams().create({ patientId: patient.id, status }));

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
    config = new ConfigService({
      ...validateEnvironment(process.env),
      DEMO_SEED_ENABLED: 'false',
      EMAIL_PROVIDER: 'MOCK',
      SMS_MOCK_FAIL_ALL: 'false',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(database)
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    notifications = module.get(ExamNotificationService);
    sms = module.get(SMS_PROVIDER);
  });

  beforeEach(async () => {
    await database.query(
      'TRUNCATE "exams", "messages", "patients", "message_templates" CASCADE',
    );
    config.set('SMS_MOCK_FAIL_ALL', 'false');
    config.set('DEMO_SEED_ENABLED', 'false');
    config.set('NODE_ENV', 'test');
    patient = await database.getRepository(Patient).save({
      name: 'João Silva (fictício)',
      phone: '+5549999990001',
      email: 'existing@example.test',
    });
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.destroy();
    }
  });

  it('sends the exact content once, logs success, keeps PENDING exams untouched and lists filters', async () => {
    const pending = await createExam(ExamStatus.PENDING);
    const released = await createExam();
    const log = jest.spyOn(Logger.prototype, 'log');
    const send = jest
      .spyOn(sms, 'send')
      .mockImplementation(async (_phone, content) => {
        expect(content).toBe(EXAM_NOTIFICATION_CONTENT);
        expect(
          await messages().countBy({ status: MessageStatus.PENDING }),
        ).toBe(1);
        expect(
          (await exams().findOneByOrFail({ id: released.id }))
            .notificationStatus,
        ).toBe('PROCESSING');
      });
    await request(app.getHttpServer())
      .post('/exams/process-pending')
      .expect(200)
      .expect({ total: 1, sent: 1, failed: 0, uncertain: 0 });
    await notifications.processPending();
    expect(send).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(`SMS enviado, cliente ${patient.name}`);
    expect(
      (await exams().findOneByOrFail({ id: pending.id })).notificationStatus,
    ).toBe('NOT_ELIGIBLE');
    expect(
      await messages().findOneByOrFail({ patientId: patient.id }),
    ).toMatchObject({
      content: EXAM_NOTIFICATION_CONTENT,
      status: 'SENT',
      templateId: null,
      sentAt: expect.any(Date) as Date,
    });
    await request(app.getHttpServer())
      .get('/exams?status=RELEASED&notificationStatus=SENT&page=1&limit=1')
      .expect(200)
      .expect((response: request.Response) => {
        const body = response.body as { total: number; data: Exam[] };
        expect(body.total).toBe(1);
        expect(body.data[0].patient.name).toBe(patient.name);
      });
    await request(app.getHttpServer()).get('/exams?status=unknown').expect(400);
    await request(app.getHttpServer())
      .get('/exams?page=0&limit=101')
      .expect(400);
    await request(app.getHttpServer())
      .post(`/exams/${released.id}/retry`)
      .expect(409);
  });

  it('allows concurrent processors to send each exam only once', async () => {
    await Promise.all([createExam(), createExam(), createExam()]);
    const send = jest.spyOn(sms, 'send');
    const results = await Promise.all([
      notifications.processPending(),
      notifications.processPending(),
      notifications.processPending(),
    ]);
    expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(await messages().count()).toBe(3);
    // Even an application bug cannot insert a second active/successful notification.
    const sent = await messages().findOneByOrFail({
      status: MessageStatus.SENT,
    });
    await expect(
      messages().insert({ ...sent, id: randomUUID() }),
    ).rejects.toThrow();
  });

  it('records deterministic failures and retries only explicitly while preserving failed history', async () => {
    const exam = await createExam();
    config.set('SMS_MOCK_FAIL_ALL', 'true');
    expect(await notifications.processPending()).toMatchObject({
      sent: 0,
      failed: 1,
    });
    expect(await exams().findOneByOrFail({ id: exam.id })).toMatchObject({
      notificationStatus: 'FAILED',
      notifiedAt: null,
    });
    expect(await notifications.processPending()).toMatchObject({ total: 0 });
    config.set('SMS_MOCK_FAIL_ALL', 'false');
    const responses = await Promise.all([
      request(app.getHttpServer()).post(`/exams/${exam.id}/retry`),
      request(app.getHttpServer()).post(`/exams/${exam.id}/retry`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await messages().countBy({ status: MessageStatus.FAILED })).toBe(1);
    expect(await messages().countBy({ status: MessageStatus.SENT })).toBe(1);
    expect(
      (await messages().findOneByOrFail({ status: MessageStatus.FAILED }))
        .error,
    ).toBe('O provider mock rejeitou o envio simulado.');
  });

  it('continues after an individual failure and supports missing phone', async () => {
    await Promise.all([createExam(), createExam()]);
    jest.spyOn(sms, 'send').mockRejectedValueOnce(new Error('Private error'));
    expect(await notifications.processPending()).toMatchObject({
      total: 2,
      sent: 1,
      failed: 1,
    });
    await database.getRepository(Patient).update(patient.id, { phone: null });
    const exam = await createExam();
    await notifications.processPending();
    expect(
      (await exams().findOneByOrFail({ id: exam.id })).notificationError,
    ).toBe('Paciente sem telefone para o canal SMS.');
  });

  it('keeps an uncertain result PROCESSING, visible for reconciliation and never auto retried', async () => {
    const exam = await createExam();
    jest.spyOn(sms, 'send').mockImplementationOnce(() => {
      jest
        .spyOn(database, 'transaction')
        .mockRejectedValueOnce(new Error('Lost connection'));
      return Promise.resolve();
    });
    expect(await notifications.processPending()).toMatchObject({
      uncertain: 1,
      sent: 0,
    });
    jest.restoreAllMocks();
    await exams().update(exam.id, {
      processingStartedAt: new Date(Date.now() - 6 * 60 * 1000),
    });
    await request(app.getHttpServer())
      .get('/exams?notificationStatus=PROCESSING')
      .expect(200)
      .expect((response: request.Response) => {
        expect(
          (response.body as { data: { reconciliationRequired: boolean }[] })
            .data[0].reconciliationRequired,
        ).toBe(true);
      });
    expect(await notifications.processPending()).toMatchObject({ total: 0 });
    await request(app.getHttpServer())
      .post(`/exams/${exam.id}/retry`)
      .expect(409);
    await request(app.getHttpServer())
      .post('/patients/bulk-delete')
      .send({ patientIds: [patient.id] })
      .expect(409);
  });

  it('transitions a newly released exam and preserves manual messaging and deletion', async () => {
    const exam = await createExam(ExamStatus.PENDING);
    await exams().update(exam.id, { status: ExamStatus.RELEASED });
    expect(await exams().findOneByOrFail({ id: exam.id })).toMatchObject({
      notificationStatus: 'PENDING',
      releasedAt: expect.any(Date) as Date,
    });
    await notifications.processPending();
    const templateResponse = await request(app.getHttpServer())
      .post('/templates')
      .send({ name: 'Manual', content: 'Olá {{name}}' })
      .expect(201);
    const templateId = (templateResponse.body as { id: string }).id;
    await request(app.getHttpServer())
      .get('/config')
      .expect(200)
      .expect({ smsProvider: 'MOCK', emailProvider: 'MOCK' });
    await request(app.getHttpServer())
      .post('/messages/send')
      .send({
        templateId,
        patientIds: [patient.id],
        channels: ['SMS', 'EMAIL'],
      })
      .expect(200)
      .expect((response: request.Response) => {
        expect(response.body as unknown).toMatchObject({
          total: 2,
          sent: 2,
          failed: 0,
        });
      });
    await request(app.getHttpServer())
      .post('/patients/bulk-delete')
      .send({ patientIds: [patient.id] })
      .expect(200)
      .expect({ deleted: 1 });
    expect(await exams().count()).toBe(0);
    expect(await messages().count()).toBe(0);
  });
  it('bootstraps seed before processing, remains idempotent and preserves user edits on restart', async () => {
    config.set('DEMO_SEED_ENABLED', 'true');
    const bootstrap = app.get(DatabaseBootstrapService);
    await bootstrap.onApplicationBootstrap();
    expect(await exams().count()).toBe(4);
    expect(await messages().countBy({ status: MessageStatus.SENT })).toBe(2);
    await database
      .getRepository(Patient)
      .update(DEMO_PATIENTS[0].id, { name: 'Nome editado pelo usuário' });
    await database
      .getRepository(MessageTemplate)
      .update(DEMO_TEMPLATE.id, { content: 'Template editado' });
    const send = jest.spyOn(sms, 'send');
    await Promise.all([app.get(SeedService).run(), app.get(SeedService).run()]);
    await bootstrap.onApplicationBootstrap();
    expect(send).not.toHaveBeenCalled();
    expect(await exams().count()).toBe(4);
    expect(await database.getRepository(Patient).count()).toBe(4);
    expect(
      (
        await database
          .getRepository(Patient)
          .findOneByOrFail({ id: DEMO_PATIENTS[0].id })
      ).name,
    ).toBe('Nome editado pelo usuário');
    expect(
      (
        await database
          .getRepository(MessageTemplate)
          .findOneByOrFail({ id: DEMO_TEMPLATE.id })
      ).content,
    ).toBe('Template editado');
    expect(await messages().count()).toBe(2);
    config.set('DEMO_SEED_ENABLED', 'false');
  });

  it('does not seed production or disabled environments, nor link conflicting user contacts to demo exams', async () => {
    const seed = app.get(SeedService);
    config.set('DEMO_SEED_ENABLED', 'false');
    await seed.run();
    expect(await exams().count()).toBe(0);
    config.set('DEMO_SEED_ENABLED', 'true');
    config.set('NODE_ENV', 'production');
    await seed.run();
    expect(await exams().count()).toBe(0);
    config.set('NODE_ENV', 'test');
    await database
      .getRepository(Patient)
      .update(patient.id, { phone: DEMO_PATIENTS[0].phone });
    await seed.run();
    expect(await exams().count()).toBe(2);
    expect(await exams().existsBy({ id: DEMO_EXAMS[0].id })).toBe(false);
    expect(await exams().countBy({ patientId: patient.id })).toBe(0);
    config.set('DEMO_SEED_ENABLED', 'false');
  });
});
