import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { EmailProviderError } from './email.provider';

@Injectable()
export class MockEmailProvider {
  send(email: string, subject: string, content: string): Promise<void> {
    if (!isEmail(email) || !subject || !content) {
      return Promise.reject(
        new EmailProviderError('O mock de e-mail rejeitou os dados do envio.'),
      );
    }
    return Promise.resolve();
  }
}
