import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Message } from '../../messages/entities/message.entity';

export enum ExamStatus {
  PENDING = 'PENDING',
  RELEASED = 'RELEASED',
}

export enum NotificationStatus {
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('exams')
@Check(
  'CHK_exams_eligibility',
  `("status" = 'PENDING' AND "notificationStatus" = 'NOT_ELIGIBLE' AND "releasedAt" IS NULL) OR ("status" = 'RELEASED' AND "notificationStatus" <> 'NOT_ELIGIBLE' AND "releasedAt" IS NOT NULL)`,
)
@Check(
  'CHK_exams_sent',
  `("notificationStatus" = 'SENT') = ("notifiedAt" IS NOT NULL)`,
)
@Index('IDX_exams_notification', ['status', 'notificationStatus'])
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_exams_patientId')
  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'patientId',
    foreignKeyConstraintName: 'FK_exams_patient',
  })
  patient: Patient;

  @Column({
    type: 'enum',
    enum: ExamStatus,
    enumName: 'exam_status_enum',
    default: ExamStatus.PENDING,
  })
  status: ExamStatus;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    enumName: 'exam_notification_status_enum',
    default: NotificationStatus.NOT_ELIGIBLE,
  })
  notificationStatus: NotificationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notificationError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processingStartedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  notificationMessageId: string | null;

  @OneToOne(() => Message, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'notificationMessageId',
    foreignKeyConstraintName: 'FK_exams_message',
  })
  notificationMessage: Message | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
