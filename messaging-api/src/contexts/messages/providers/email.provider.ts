import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export const DEFAULT_EMAIL_SUBJECT = 'Mensagem de acompanhamento';

// Only controlled messages leave this provider; raw SMTP errors may contain personal data.
export class EmailProviderError extends Error {}

@Injectable()
export class EmailProvider {
  private transporter?: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private readonly config: ConfigService) {}

  async send(email: string, subject: string, content: string): Promise<void> {
    if (
      this.config.get<string>('NODE_ENV') === 'test' ||
      process.env.NODE_ENV === 'test'
    ) {
      throw new EmailProviderError(
        'E-mail real desabilitado em ambiente de teste.',
      );
    }
    const host = this.config.get<string>('SMTP_HOST', '').trim();
    const user = this.config.get<string>('SMTP_USER', '').trim();
    const pass = this.config.get<string>('SMTP_PASS', '');
    const from = this.config.get<string>('SMTP_FROM', '').trim();
    if (!host || !user || !pass.trim() || !from) {
      throw new EmailProviderError(
        'E-mail não enviado: configuração SMTP ausente ou incompleta.',
      );
    }
    if (!isEmail(email) || !isEmail(from)) {
      throw new EmailProviderError(
        'E-mail não enviado: endereço de e-mail inválido.',
      );
    }
    try {
      if (!this.transporter) {
        const secure =
          this.config.get<string>('SMTP_SECURE', 'false') === 'true';
        // No connection, verification or message is sent until send() is explicitly invoked.
        this.transporter = createTransport({
          host,
          port: Number(this.config.get<number>('SMTP_PORT', 587)),
          secure,
          requireTLS: !secure,
          auth: { user, pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          logger: false,
          debug: false,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
      }
      const result = await this.transporter.sendMail({
        from,
        to: { address: email, name: '' },
        subject: subject.trim() || DEFAULT_EMAIL_SUBJECT,
        text: content,
      });
      if (!result.accepted.length || result.rejected.length) {
        throw new EmailProviderError(
          'O servidor SMTP não aceitou o destinatário.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof EmailProviderError) throw error;
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'EAUTH'
      ) {
        throw new EmailProviderError('O servidor SMTP recusou a autenticação.');
      }
      throw new EmailProviderError(
        'Falha ao enviar e-mail via SMTP. Verifique a configuração e a conexão.',
      );
    }
  }
}
