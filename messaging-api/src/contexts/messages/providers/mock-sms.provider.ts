import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEMO_FAILURE_RECIPIENT } from '../../../database/seeds/demo/demo-data';
import { ExamSmsContext, SmsProvider } from './sms-provider.interface';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  constructor(private readonly config: ConfigService) {}

  send(
    phone: string,
    content: string,
    context?: ExamSmsContext,
  ): Promise<void> {
    const demoFailure =
      this.config.get<string>('NODE_ENV') !== 'production' &&
      context?.examId === DEMO_FAILURE_RECIPIENT.exam.id &&
      context.patientId === DEMO_FAILURE_RECIPIENT.patient.id &&
      phone === DEMO_FAILURE_RECIPIENT.patient.phone;
    if (
      !phone ||
      !content ||
      this.config.get<string>('SMS_MOCK_FAIL_ALL') === 'true' ||
      demoFailure
    ) {
      return Promise.reject(new Error('Simulated provider rejection'));
    }
    return Promise.resolve();
  }
}
