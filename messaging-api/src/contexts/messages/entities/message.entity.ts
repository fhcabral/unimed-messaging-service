import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { MessageTemplate } from '../../templates/entities/message-template.entity';

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum MessageChannel {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_messages_patientId')
  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'patientId',
    foreignKeyConstraintName: 'FK_messages_patient',
  })
  patient: Patient;

  @Index('IDX_messages_templateId')
  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @ManyToOne(() => MessageTemplate, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'templateId',
    foreignKeyConstraintName: 'FK_messages_template',
  })
  template: MessageTemplate | null;

  @Index('UQ_messages_active_notification', {
    unique: true,
    where: `"status" IN ('PENDING', 'SENT')`,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  notificationKey: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageChannel,
    enumName: 'message_channel_enum',
    default: MessageChannel.SMS,
  })
  channel: MessageChannel;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    enumName: 'message_status_enum',
    default: MessageStatus.PENDING,
  })
  status: MessageStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Index('IDX_messages_createdAt')
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
