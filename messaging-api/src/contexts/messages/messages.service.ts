import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MessageTemplate } from '../templates/entities/message-template.entity';
import { PaginationDto } from '../../common/pagination.dto';
import {
  Message,
  MessageChannel,
  MessageStatus,
} from './entities/message.entity';
import { SendMessagesDto } from './dto/send-messages.dto';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import type { SmsProvider } from './providers/sms-provider.interface';
import {
  DEFAULT_EMAIL_SUBJECT,
  EmailProvider,
  EmailProviderError,
} from './providers/email.provider';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(MessageTemplate)
    private readonly templates: Repository<MessageTemplate>,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly email: EmailProvider,
  ) {}

  async send({
    templateId,
    patientIds,
    channels: requestedChannels,
  }: SendMessagesDto) {
    const channels = requestedChannels ?? [MessageChannel.SMS];
    const template = await this.templates.findOneBy({ id: templateId });
    if (!template) throw new NotFoundException('Template não encontrado.');
    const patients = await this.patients.findBy({ id: In(patientIds) });
    if (patients.length !== patientIds.length)
      throw new NotFoundException(
        'Um ou mais pacientes não foram encontrados. Nenhum envio foi iniciado.',
      );
    const summary = {
      total: patients.length * channels.length,
      sent: 0,
      failed: 0,
    };
    const byChannel: Partial<
      Record<MessageChannel, { total: number; sent: number; failed: number }>
    > = {};
    for (const channel of channels)
      byChannel[channel] = { total: patients.length, sent: 0, failed: 0 };
    for (const patient of patients) {
      for (const channel of channels) {
        const message = await this.messages.save(
          this.messages.create({
            patientId: patient.id,
            templateId,
            channel,
            subject:
              channel === MessageChannel.EMAIL
                ? template.subject?.trim() || DEFAULT_EMAIL_SUBJECT
                : null,
            content: template.content.replaceAll(
              '{{name}}',
              () => patient.name,
            ),
            status: MessageStatus.PENDING,
            error: null,
            sentAt: null,
          }),
        );
        let failure: string | null = null;
        if (channel === MessageChannel.SMS && !patient.phone)
          failure = 'Paciente sem telefone para o canal SMS.';
        if (channel === MessageChannel.EMAIL && !patient.email)
          failure = 'Paciente sem e-mail para o canal EMAIL.';
        if (!failure) {
          try {
            if (channel === MessageChannel.SMS) {
              await this.sms.send(patient.phone!, message.content);
            } else {
              await this.email.send(
                patient.email!,
                message.subject!,
                message.content,
              );
            }
          } catch (error) {
            failure =
              channel === MessageChannel.SMS
                ? 'O provider mock rejeitou o envio simulado.'
                : error instanceof EmailProviderError
                  ? error.message
                  : 'O provider de e-mail não aceitou o envio.';
          }
        }
        const channelSummary = byChannel[channel]!;
        if (failure) {
          message.status = MessageStatus.FAILED;
          message.error = failure;
          summary.failed++;
          channelSummary.failed++;
        } else {
          message.status = MessageStatus.SENT;
          message.sentAt = new Date();
          summary.sent++;
          channelSummary.sent++;
        }
        await this.messages.save(message);
      }
    }
    // Preserve the exact legacy SMS response when channels was not supplied.
    return requestedChannels === undefined
      ? summary
      : { ...summary, byChannel };
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
