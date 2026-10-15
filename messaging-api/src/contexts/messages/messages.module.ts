import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MessageTemplate } from '../templates/entities/message-template.entity';
import { Message } from './entities/message.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { SMS_PROVIDER } from './providers/sms-provider.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Patient, MessageTemplate])],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    { provide: SMS_PROVIDER, useClass: MockSmsProvider },
  ],
})
export class MessagesModule {}
