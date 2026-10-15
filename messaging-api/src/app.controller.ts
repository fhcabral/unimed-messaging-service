import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get('config')
  getPublicConfig() {
    return {
      smsProvider: 'MOCK',
      emailProvider: this.config.get<string>('EMAIL_PROVIDER', 'MOCK'),
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
