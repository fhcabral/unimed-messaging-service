import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger';
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExamsController } from './contexts/exams/exams.controller';
import { ExamsService } from './contexts/exams/exams.service';
import { ExamNotificationService } from './contexts/exams/exam-notification.service';
import { MessagesController } from './contexts/messages/messages.controller';
import { MessagesService } from './contexts/messages/messages.service';
import { PatientsController } from './contexts/patients/patients.controller';
import { PatientsService } from './contexts/patients/patients.service';
import { TemplatesController } from './contexts/templates/templates.controller';
import { TemplatesService } from './contexts/templates/templates.service';
import { setupApp } from './setup-app';

// Use the real controllers and application setup without database/seed/provider I/O.
describe('Swagger contract (no database required)', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;

  const routes = [
    ['/', 'get', 200, []],
    ['/config', 'get', 200, []],
    ['/patients/import', 'post', 201, [400, 413]],
    ['/patients', 'get', 200, [400]],
    ['/patients/{id}', 'delete', 204, [400, 404, 409]],
    ['/patients/bulk-delete', 'post', 200, [400, 404, 409]],
    ['/templates', 'post', 201, [400]],
    ['/templates', 'get', 200, []],
    ['/messages/send', 'post', 200, [400, 404]],
    ['/messages', 'get', 200, [400]],
    ['/exams', 'get', 200, [400]],
    ['/exams/process-pending', 'post', 200, []],
    ['/exams/{id}/retry', 'post', 200, [400, 404, 409]],
  ] as const;

  function schema(
    value: SchemaObject | ReferenceObject | undefined,
  ): SchemaObject {
    if (!value) throw new Error('Missing schema');
    if ('$ref' in value) {
      const name = value.$ref.replace('#/components/schemas/', '');
      return schema(document.components?.schemas?.[name]);
    }
    return value;
  }

  function model(name: string) {
    return schema(document.components?.schemas?.[name]);
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AppController,
        PatientsController,
        TemplatesController,
        MessagesController,
        ExamsController,
      ],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ EMAIL_PROVIDER: 'MOCK' }),
        },
        ...[
          PatientsService,
          TemplatesService,
          MessagesService,
          ExamsService,
          ExamNotificationService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('validates the generated OpenAPI document and resolves every schema reference', async () => {
    await expect(
      SwaggerParser.validate(
        structuredClone(document) as SwaggerParser['api'],
        { resolve: { external: false } },
      ),
    ).resolves.toBeDefined();
  });

  it('covers every current route with a summary, tag, correct success status and error schemas', () => {
    const operations = Object.values(document.paths).flatMap((path) =>
      ['get', 'post', 'delete', 'put', 'patch'].filter(
        (method) => path[method],
      ),
    );
    expect(operations).toHaveLength(routes.length);
    const operationIds = new Set<string>();
    for (const [path, method, status, errors] of routes) {
      const operation = document.paths[path]?.[method] as OperationObject;
      expect(operation).toBeDefined();
      expect(operation.summary).toBeTruthy();
      expect(operation.tags?.length).toBeGreaterThan(0);
      expect(operation.operationId).toBeTruthy();
      operationIds.add(operation.operationId!);
      const success = operation.responses[status];
      expect(success).toBeDefined();
      if (!success || '$ref' in success)
        throw new Error('Missing success response');
      if (status === 204) {
        expect(success.content).toBeUndefined();
      } else {
        const contentType = path === '/' ? 'text/html' : 'application/json';
        expect(success.content?.[contentType].schema).toBeDefined();
      }
      for (const error of [...errors, 500]) {
        expect(operation.responses[error]).toMatchObject({
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorDto' },
            },
          },
        });
      }
    }
    expect(operationIds.size).toBe(routes.length);
  });

  it('documents required multipart upload and integer pagination limits', () => {
    expect(document.paths['/patients/import'].post?.requestBody).toMatchObject({
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
    for (const path of ['/patients', '/messages', '/exams']) {
      const parameters = document.paths[path].get?.parameters;
      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'page',
            in: 'query',
            required: false,
            schema: expect.objectContaining({
              type: 'integer',
              default: 1,
              minimum: 1,
              maximum: 1000000,
            }) as unknown,
          }),
          expect.objectContaining({
            name: 'limit',
            in: 'query',
            required: false,
            schema: expect.objectContaining({
              type: 'integer',
              default: 20,
              minimum: 1,
              maximum: 100,
            }) as unknown,
          }),
        ]),
      );
    }
  });

  it('preserves request constraints, nullable subject and optional channel summaries', () => {
    expect(model('CreateTemplateDto').properties?.subject).toMatchObject({
      type: 'string',
      nullable: true,
      maxLength: 255,
    });
    for (const name of ['SendMessagesDto', 'DeletePatientsDto']) {
      expect(model(name).properties?.patientIds).toMatchObject({
        type: 'array',
        minItems: 1,
        maxItems: 100,
        uniqueItems: true,
        items: { type: 'string', format: 'uuid' },
      });
    }
    expect(model('SendMessagesDto').properties?.channels).toMatchObject({
      type: 'array',
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      items: { enum: ['SMS', 'EMAIL'] },
    });
    expect(model('SendMessagesResponseDto').required).not.toContain(
      'byChannel',
    );
    expect(model('ChannelSummaryDto').required ?? []).toEqual([]);
    expect(model('ProcessExamsResponseDto').required).toEqual(
      expect.arrayContaining(['total', 'sent', 'failed', 'uncertain']),
    );
  });

  it('describes nested paginated responses and automatic notifications without a template', () => {
    for (const [page, item] of [
      ['PaginatedPatientsDto', 'PatientResponseDto'],
      ['PaginatedMessagesDto', 'MessageResponseDto'],
      ['PaginatedExamsDto', 'ExamResponseDto'],
    ]) {
      expect(model(page).required).toEqual(
        expect.arrayContaining(['data', 'total', 'page', 'limit']),
      );
      expect(model(page).properties?.data).toMatchObject({
        type: 'array',
        items: { $ref: `#/components/schemas/${item}` },
      });
    }
    expect(model('MessageResponseDto').properties?.templateId).toMatchObject({
      type: 'string',
      format: 'uuid',
      nullable: true,
    });
    expect(model('MessageResponseDto').properties?.template).toMatchObject({
      nullable: true,
    });
    expect(
      model('ExamResponseDto').properties?.reconciliationRequired,
    ).toMatchObject({ type: 'boolean' });
  });

  it('serves Swagger UI assets and keeps root/config responses consistent', async () => {
    await request(app.getHttpServer())
      .get('/docs/')
      .expect(200)
      .expect('Content-Type', /html/);
    await request(app.getHttpServer())
      .get('/docs/swagger-ui-init.js')
      .expect(200)
      .expect(/SwaggerUIBundle/);
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Content-Type', /text\/html/)
      .expect('Servidor OK!');
    await request(app.getHttpServer())
      .get('/config')
      .expect(200)
      .expect({ smsProvider: 'MOCK', emailProvider: 'MOCK' });
  });
});
