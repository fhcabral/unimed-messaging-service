export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface ExamSmsContext {
  examId: string;
  patientId: string;
}

export interface SmsProvider {
  send(phone: string, content: string, context?: ExamSmsContext): Promise<void>;
}
