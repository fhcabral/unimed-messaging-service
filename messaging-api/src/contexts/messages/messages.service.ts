import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MessageTemplate } from '../templates/entities/message-template.entity';
import { PaginationDto } from '../../common/pagination.dto';
import { Message, MessageStatus } from './entities/message.entity';
import { SendMessagesDto } from './dto/send-messages.dto';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import type { SmsProvider } from './providers/sms-provider.interface';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(MessageTemplate)
    private readonly templates: Repository<MessageTemplate>,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async send({ templateId, patientIds }: SendMessagesDto) {
    const template = await this.templates.findOneBy({ id: templateId });
    if (!template) throw new NotFoundException('Template não encontrado.');
    const patients = await this.patients.findBy({ id: In(patientIds) });
    if (patients.length !== patientIds.length)
      throw new NotFoundException(
        'Um ou mais pacientes não foram encontrados. Nenhum envio foi iniciado.',
      );
    const summary = { total: patients.length, sent: 0, failed: 0 };
    for (const patient of patients) {
      const message = await this.messages.save(
        this.messages.create({
          patientId: patient.id,
          templateId,
          content: template.content.replaceAll('{{name}}', () => patient.name),
          status: MessageStatus.PENDING,
          error: null,
          sentAt: null,
        }),
      );
      try {
        await this.sms.send(patient.phone, message.content);
      } catch {
        // Provider errors may contain personal data; store only a controlled message.
        message.status = MessageStatus.FAILED;
        message.error = 'O provider mock rejeitou o envio simulado.';
        await this.messages.save(message);
        summary.failed++;
        continue;
      }
      message.status = MessageStatus.SENT;
      message.sentAt = new Date();
      await this.messages.save(message);
      summary.sent++;
    }
    return summary;
  }

  async findAll({ page, limit }: PaginationDto) {
    const [data, total] = await this.messages.findAndCount({
      relations: { patient: true, template: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
