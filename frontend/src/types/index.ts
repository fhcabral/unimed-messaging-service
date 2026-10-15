export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  subject: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PatientQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface ImportResult {
  imported: number;
  ignored: number;
  invalid: number;
}

export interface CreateTemplateInput {
  name: string;
  content: string;
  subject?: string;
}

export type MessageChannel = 'SMS' | 'EMAIL';

export interface SendMessagesInput {
  templateId: string;
  patientIds: string[];
  channels: MessageChannel[];
}

export interface SendCounts {
  total: number;
  sent: number;
  failed: number;
}

export interface SendResult extends SendCounts {
  byChannel: Partial<Record<MessageChannel, SendCounts>>;
}

export type EmailProviderMode = 'MOCK' | 'SMTP';
export interface PublicConfig {
  smsProvider: 'MOCK';
  emailProvider: EmailProviderMode;
}

export type ExamStatus = 'PENDING' | 'RELEASED';
export type NotificationStatus = 'NOT_ELIGIBLE' | 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface Exam {
  id: string;
  patientId: string;
  patient: Patient;
  status: ExamStatus;
  releasedAt: string | null;
  notificationStatus: NotificationStatus;
  notifiedAt: string | null;
  notificationError: string | null;
  notificationMessageId: string | null;
  processingStartedAt: string | null;
  reconciliationRequired: boolean;
  createdAt: string;
}

export interface ExamQuery {
  page: number;
  limit: number;
  status?: ExamStatus;
  notificationStatus?: NotificationStatus;
}

export interface ExamProcessResult extends SendCounts {
  uncertain: number;
}
