import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  constructor(private readonly config: ConfigService) {}

  send(phone: string, content: string): Promise<void> {
    if (
      !phone ||
      !content ||
      this.config.get<string>('SMS_MOCK_FAIL_ALL') === 'true'
    ) {
      return Promise.reject(new Error('Simulated provider rejection'));
    }
    return Promise.resolve();
  }
}
