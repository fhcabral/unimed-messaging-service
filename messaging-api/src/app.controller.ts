import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiErrorDto } from './common/dto/api-error.dto';
import { PublicConfigDto } from './common/dto/public-config.dto';

@ApiTags('app')
@ApiInternalServerErrorResponse({
  type: ApiErrorDto,
  description: 'Falha interna ao processar a solicitação.',
})
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Consulta os providers ativos, sem credenciais' })
  @ApiOkResponse({ type: PublicConfigDto })
  getPublicConfig() {
    return {
      smsProvider: 'MOCK',
      emailProvider: this.config.get<string>('EMAIL_PROVIDER', 'MOCK'),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Verifica se o servidor responde' })
  @ApiOkResponse({
    description: 'Servidor disponível.',
    content: {
      'text/html': { schema: { type: 'string', example: 'Servidor OK!' } },
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
