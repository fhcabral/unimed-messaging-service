import { ConfigService } from '@nestjs/config';
import { MockEmailProvider } from './providers/mock-email.provider';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MessageTemplate } from '../templates/entities/message-template.entity';
import { Message } from './entities/message.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import { EmailProvider } from './providers/email.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Patient, MessageTemplate])],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MockEmailProvider,
    {
      provide: EmailProvider,
      inject: [ConfigService, MockEmailProvider],
      useFactory: (config: ConfigService, mock: MockEmailProvider) =>
        config.get<string>('EMAIL_PROVIDER', 'MOCK') === 'SMTP'
          ? new EmailProvider(config)
          : mock,
    },
    { provide: SMS_PROVIDER, useClass: MockSmsProvider },
  ],
  exports: [SMS_PROVIDER],
})
export class MessagesModule {}
