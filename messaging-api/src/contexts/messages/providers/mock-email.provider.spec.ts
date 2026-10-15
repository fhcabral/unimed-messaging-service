import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MockEmailProvider } from './mock-email.provider';
import { EmailProvider } from './email.provider';
import { MessagesModule } from '../messages.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { MessageTemplate } from '../../templates/entities/message-template.entity';

describe('Email providers', () => {
  it('accepts mock mail without any SMTP connection', async () => {
    await expect(
      new MockEmailProvider().send('demo@example.test', 'Exame', 'Disponível'),
    ).resolves.toBeUndefined();
    await expect(
      new MockEmailProvider().send('invalid', 'Exame', 'Disponível'),
    ).rejects.toThrow();
  });
  it.each(['MOCK', 'SMTP'])(
    'selects %s explicitly through the module',
    async (mode) => {
      const builder = Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            isGlobal: true,
            load: [() => ({ EMAIL_PROVIDER: mode })],
          }),
          MessagesModule,
        ],
      });
      for (const entity of [Message, Patient, MessageTemplate])
        builder.overrideProvider(getRepositoryToken(entity)).useValue({});
      const module = await builder.compile();
      expect(module.get(EmailProvider)).toBeInstanceOf(
        mode === 'MOCK' ? MockEmailProvider : EmailProvider,
      );
      await module.close();
    },
  );
});
