import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { databaseOptions } from '../src/database/database.options';
import { validateEnvironment } from '../src/config/environment';
import { setupApp } from '../src/setup-app';
import {
  DemoScenarioError,
  runDemoScenario,
} from '../src/database/seeds/demo/demo-scenarios';
import {
  DEMO_FAILURE_RECIPIENT,
  DEMO_SCENARIOS,
  DemoCommand,
} from '../src/database/seeds/demo/demo-data';
import { SeedService } from '../src/database/seeds/seed.service';
import {
  DEMO_EXAMS,
  DEMO_PATIENTS,
  DEMO_TEMPLATE,
} from '../src/database/seeds/data/demo-data';
import {
  Exam,
  ExamStatus,
  NotificationStatus,
} from '../src/contexts/exams/entities/exam.entity';
import { Patient } from '../src/contexts/patients/entities/patient.entity';
import {
  Message,
  MessageStatus,
} from '../src/contexts/messages/entities/message.entity';
import { MessageTemplate } from '../src/contexts/templates/entities/message-template.entity';
import { SMS_PROVIDER } from '../src/contexts/messages/providers/sms-provider.interface';
import { MockSmsProvider } from '../src/contexts/messages/providers/mock-sms.provider';
import { EXAM_NOTIFICATION_CONTENT } from '../src/contexts/exams/exam-notification.constants';

jest.setTimeout(60000);
const exec = promisify(execFile);

describe('Demo scenario CLI with a running API (isolated PostgreSQL schema)', () => {
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication<App>;
  let config: ConfigService;
  const schema = `demo_test_${randomUUID().replaceAll('-', '')}`;
  const exams = () => database.getRepository(Exam);
  const messages = () => database.getRepository(Message);
  const patients = () => database.getRepository(Patient);
  const processPending = () =>
    request(app.getHttpServer()).post('/exams/process-pending');

  function cli(command: DemoCommand, overrides: NodeJS.ProcessEnv = {}) {
    return exec(
      process.execPath,
      [process.env.npm_execpath!, 'run', `demo:${command}`],
      {
        cwd: resolve(__dirname, '../..'),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PGOPTIONS: `-c search_path=${schema}`,
          ...overrides,
        },
      },
    );
  }

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
      NODE_ENV: 'test',
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
  });

  beforeEach(async () => {
    config.set('DEMO_SEED_ENABLED', 'false');
    config.set('SMS_MOCK_FAIL_ALL', 'false');
    await database.query(
      'TRUNCATE "exams", "messages", "patients", "message_templates" CASCADE',
    );
  });

  afterAll(async () => {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.destroy();
    }
  });

  it('runs pending from the repo root, is idempotent, and never sends for unreleased exams', async () => {
    expect((await cli('pending')).stdout).toContain('Exames criados: 3');
    expect(await runDemoScenario(database, 'pending')).toMatchObject({
      patientsCreated: 0,
      examsCreated: 0,
      existingRecords: 6,
    });
    await processPending()
      .expect(200)
      .expect({ total: 0, sent: 0, failed: 0, uncertain: 0 });
    expect(
      await exams().countBy({
        status: ExamStatus.PENDING,
        notificationStatus: NotificationStatus.NOT_ELIGIBLE,
      }),
    ).toBe(3);
    expect(await messages().count()).toBe(0);
    await request(app.getHttpServer())
      .get('/exams?status=PENDING')
      .expect(200)
      .expect((response: request.Response) => {
        expect(response.body as unknown).toMatchObject({ total: 3 });
      });
  });

  it('prepares released exams without processing, then sends exactly once through the API', async () => {
    await cli('released');
    expect(
      await exams().countBy({ notificationStatus: NotificationStatus.PENDING }),
    ).toBe(3);
    expect(await messages().count()).toBe(0);
    await processPending()
      .expect(200)
      .expect({ total: 3, sent: 3, failed: 0, uncertain: 0 });
    expect((await cli('released')).stdout).toContain('Registros existentes: 6');
    await processPending()
      .expect(200)
      .expect({ total: 0, sent: 0, failed: 0, uncertain: 0 });
    expect(
      await exams().countBy({ notificationStatus: NotificationStatus.SENT }),
    ).toBe(3);
    const history = await messages().find();
    expect(history).toHaveLength(3);
    expect(
      history.every(
        (message) =>
          message.status === MessageStatus.SENT &&
          message.content === EXAM_NOTIFICATION_CONTENT,
      ),
    ).toBe(true);
  });

  it('fails through the provider for exactly one scenario exam while normal and manual sends succeed', async () => {
    await cli('failed');
    await runDemoScenario(database, 'released');
    expect(await messages().count()).toBe(0);
    await processPending()
      .expect(200)
      .expect({ total: 6, sent: 5, failed: 1, uncertain: 0 });
    const failed = await exams().findOneByOrFail({
      id: DEMO_FAILURE_RECIPIENT.exam.id,
    });
    expect(failed).toMatchObject({
      notificationStatus: NotificationStatus.FAILED,
      notifiedAt: null,
      notificationError: 'O provider mock rejeitou o envio simulado.',
    });
    expect(await runDemoScenario(database, 'failed')).toMatchObject({
      existingRecords: 6,
    });
    await processPending()
      .expect(200)
      .expect({ total: 0, sent: 0, failed: 0, uncertain: 0 });
    expect(await messages().countBy({ status: MessageStatus.FAILED })).toBe(1);
    const template = await database
      .getRepository(MessageTemplate)
      .save({ name: 'Template manual', content: EXAM_NOTIFICATION_CONTENT });
    await request(app.getHttpServer())
      .post('/messages/send')
      .send({ templateId: template.id, patientIds: [failed.patientId] })
      .expect(200)
      .expect({ total: 1, sent: 1, failed: 0 });
    const otherExam = await exams().save({
      patientId: failed.patientId,
      status: ExamStatus.RELEASED,
    });
    await processPending()
      .expect(200)
      .expect({ total: 1, sent: 1, failed: 0, uncertain: 0 });
    expect(
      (await exams().findOneByOrFail({ id: otherExam.id })).notificationStatus,
    ).toBe(NotificationStatus.SENT);
  });

  it('reset removes only owned records/history, preserving the base seed, custom data and manual sends', async () => {
    config.set('DEMO_SEED_ENABLED', 'true');
    await app.get(SeedService).run();
    config.set('DEMO_SEED_ENABLED', 'false');
    const externalPatient = await patients().save({
      name: 'Paciente importado',
      phone: '+5549999990991',
      email: 'imported@example.test',
    });
    const externalExam = await exams().save({
      patientId: externalPatient.id,
      status: ExamStatus.RELEASED,
    });
    const template = await database
      .getRepository(MessageTemplate)
      .save({ name: 'Personalizado', content: 'Mensagem manual' });
    for (const scenario of ['pending', 'released', 'failed'] as const)
      await runDemoScenario(database, scenario);
    await processPending()
      .expect(200)
      .expect((response: request.Response) => {
        expect(response.body as unknown).toMatchObject({ sent: 8, failed: 1 });
      });
    const scenarioPatient = DEMO_SCENARIOS.released.records[0].patient;
    await request(app.getHttpServer())
      .post('/messages/send')
      .send({
        templateId: template.id,
        patientIds: [scenarioPatient.id, externalPatient.id],
      })
      .expect(200);
    const manualBefore = await messages().findBy({ templateId: template.id });
    expect((await cli('reset')).stdout).toContain('Exames removidos: 9');
    expect(await exams().count()).toBe(5);
    expect(await exams().existsBy({ id: externalExam.id })).toBe(true);
    expect(
      await exams().countBy({ id: In(DEMO_EXAMS.map((exam) => exam.id)) }),
    ).toBe(4);
    expect(
      await patients().countBy({
        id: In(DEMO_PATIENTS.map((patient) => patient.id)),
      }),
    ).toBe(3);
    expect(await patients().existsBy({ id: scenarioPatient.id })).toBe(true);
    expect(await messages().findBy({ templateId: template.id })).toEqual(
      manualBefore,
    );
    expect(await messages().count()).toBe(5);
    expect(
      await database
        .getRepository(MessageTemplate)
        .existsBy({ id: DEMO_TEMPLATE.id }),
    ).toBe(true);
    expect(
      await database
        .getRepository(MessageTemplate)
        .existsBy({ id: template.id }),
    ).toBe(true);
    expect(await runDemoScenario(database, 'reset')).toMatchObject({
      patientsRemoved: 0,
      examsRemoved: 0,
      messagesRemoved: 0,
    });
    await runDemoScenario(database, 'released');
    expect(
      await exams().countBy({
        id: In(DEMO_SCENARIOS.released.records.map((record) => record.exam.id)),
        notificationStatus: NotificationStatus.PENDING,
      }),
    ).toBe(3);
  });

  it('refuses reset during PROCESSING and rolls back, then allows reset after confirmed completion', async () => {
    await runDemoScenario(database, 'released');
    const provider = app.get<MockSmsProvider>(SMS_PROVIDER);
    const send = jest
      .spyOn(provider, 'send')
      .mockImplementationOnce(async () => {
        await expect(runDemoScenario(database, 'reset')).rejects.toBeInstanceOf(
          DemoScenarioError,
        );
        expect(await exams().count()).toBe(3);
        expect(
          await messages().countBy({ status: MessageStatus.PENDING }),
        ).toBe(1);
      });
    try {
      await processPending()
        .expect(200)
        .expect({ total: 3, sent: 3, failed: 0, uncertain: 0 });
    } finally {
      send.mockRestore();
    }
    expect(await runDemoScenario(database, 'reset')).toMatchObject({
      patientsRemoved: 3,
      examsRemoved: 3,
      messagesRemoved: 3,
    });
  });

  it('handles concurrent preparations without duplication and aborts a conflicting contact atomically', async () => {
    await Promise.all([
      runDemoScenario(database, 'released'),
      runDemoScenario(database, 'released'),
    ]);
    expect(await patients().count()).toBe(3);
    expect(await exams().count()).toBe(3);
    await runDemoScenario(database, 'reset');
    const conflict = DEMO_SCENARIOS.pending.records[1].patient;
    const external = await patients().save({
      name: 'Cadastro existente',
      email: conflict.email,
    });
    await expect(runDemoScenario(database, 'pending')).rejects.toBeInstanceOf(
      DemoScenarioError,
    );
    expect(await patients().count()).toBe(1);
    expect(await exams().count()).toBe(0);
    expect(await patients().existsBy({ id: external.id })).toBe(true);
  });

  it('rejects production CLI use without touching data and preserves the global failure switch', async () => {
    await expect(
      cli('released', { NODE_ENV: 'production' }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('somente em ambiente local') as string,
    });
    expect(await patients().count()).toBe(0);
    config.set('SMS_MOCK_FAIL_ALL', 'true');
    await runDemoScenario(database, 'released');
    await processPending()
      .expect(200)
      .expect({ total: 3, sent: 0, failed: 3, uncertain: 0 });
  });
});
