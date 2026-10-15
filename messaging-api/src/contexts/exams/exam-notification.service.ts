import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import {
  Message,
  MessageChannel,
  MessageStatus,
} from '../messages/entities/message.entity';
import { SMS_PROVIDER } from '../messages/providers/sms-provider.interface';
import type { SmsProvider } from '../messages/providers/sms-provider.interface';
import { Exam, ExamStatus, NotificationStatus } from './entities/exam.entity';
import { EXAM_NOTIFICATION_CONTENT } from './exam-notification.constants';

type Candidate = Pick<Exam, 'id' | 'patientId'>;
type Claim = { exam: Exam; patient: Patient; message: Message };
type Outcome = 'sent' | 'failed' | 'uncertain';

@Injectable()
export class ExamNotificationService {
  private readonly logger = new Logger(ExamNotificationService.name);

  constructor(
    private readonly database: DataSource,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async processPending() {
    const candidates = await this.database.getRepository(Exam).find({
      select: { id: true, patientId: true },
      where: {
        status: ExamStatus.RELEASED,
        notificationStatus: NotificationStatus.PENDING,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const result = { total: 0, sent: 0, failed: 0, uncertain: 0 };
    for (const candidate of candidates) {
      try {
        const claim = await this.claim(candidate, NotificationStatus.PENDING);
        if (!claim) continue;
        result.total++;
        result[await this.deliver(claim)]++;
      } catch {
        // Keep processing the remaining exams. Never blindly resend an uncertain claim.
        result.total++;
        result.uncertain++;
        this.logger.error(
          'Falha ao preparar notificação; consulte os exames e o histórico.',
        );
      }
    }
    return result;
  }

  async retryFailed(id: string) {
    const candidate = await this.database.getRepository(Exam).findOneBy({ id });
    if (!candidate) throw new NotFoundException('Exame não encontrado.');
    const claim = await this.claim(candidate, NotificationStatus.FAILED);
    if (!claim)
      throw new ConflictException(
        'Somente exames FAILED podem ser reprocessados. Atualize a lista; exames SENT ou PROCESSING não são reenviados.',
      );
    const outcome = await this.deliver(claim);
    return {
      total: 1,
      sent: Number(outcome === 'sent'),
      failed: Number(outcome === 'failed'),
      uncertain: Number(outcome === 'uncertain'),
    };
  }

  private claim(
    candidate: Candidate,
    expected: NotificationStatus,
  ): Promise<Claim | null> {
    return this.database.transaction(async (manager) => {
      // Same parent-first lock order as patient deletion; a committed PENDING message
      // prevents deletion after this transaction releases the parent lock.
      const patient = await manager.getRepository(Patient).findOne({
        where: { id: candidate.patientId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!patient) return null;
      const exam = await manager.getRepository(Exam).findOne({
        where: {
          id: candidate.id,
          status: ExamStatus.RELEASED,
          notificationStatus: expected,
        },
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      if (!exam) return null;
      const message = await manager.save(
        Message,
        manager.create(Message, {
          patientId: patient.id,
          templateId: null,
          notificationKey: `exam:${exam.id}:RESULT_SMS`,
          content: EXAM_NOTIFICATION_CONTENT,
          channel: MessageChannel.SMS,
          status: MessageStatus.PENDING,
          subject: null,
          error: null,
          sentAt: null,
        }),
      );
      exam.notificationStatus = NotificationStatus.PROCESSING;
      exam.processingStartedAt = new Date();
      exam.notificationMessageId = message.id;
      // The previous error remains visible until a confirmed success; old FAILED
      // Message rows are never overwritten when the user explicitly retries.
      await manager.save(Exam, exam);
      return { exam, patient, message };
    });
  }

  private async deliver({ exam, patient, message }: Claim): Promise<Outcome> {
    let failure: string | null = null;
    try {
      if (!patient.phone) {
        failure = 'Paciente sem telefone para o canal SMS.';
      } else {
        await this.sms.send(patient.phone, EXAM_NOTIFICATION_CONTENT);
        this.logger.log(`SMS enviado, cliente ${patient.name}`);
      }
    } catch {
      failure = 'O provider mock rejeitou o envio simulado.';
    }
    try {
      await this.database.transaction(async (manager) => {
        const sentAt = failure ? null : new Date();
        await manager.update(Message, message.id, {
          status: failure ? MessageStatus.FAILED : MessageStatus.SENT,
          error: failure,
          sentAt,
        });
        await manager.update(Exam, exam.id, {
          notificationStatus: failure
            ? NotificationStatus.FAILED
            : NotificationStatus.SENT,
          notificationError: failure,
          notifiedAt: sentAt,
          processingStartedAt: null,
        });
      });
    } catch {
      this.logger.error(
        'Resultado da notificação não persistido. Exame PROCESSING exige reconciliação; não reenviar automaticamente.',
      );
      return 'uncertain';
    }
    return failure ? 'failed' : 'sent';
  }
}
