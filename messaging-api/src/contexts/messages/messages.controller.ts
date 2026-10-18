import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import {
  PaginatedMessagesDto,
  SendMessagesResponseDto,
} from './dto/message-response.dto';
import { PaginationDto } from '../../common/pagination.dto';
import { MessagesService } from './messages.service';
import { SendMessagesDto } from './dto/send-messages.dto';

@ApiTags('messages')
@ApiInternalServerErrorResponse({
  type: ApiErrorDto,
  description:
    'Falha interna; consulte o histórico antes de repetir uma requisição interrompida.',
})
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('send')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envia mensagens para até 100 pacientes por canal',
    description:
      'SMS é simulado; EMAIL usa mock ou SMTP conforme EMAIL_PROVIDER. Sem channels, mantém o SMS legado e omite byChannel na resposta. Com channels, os totais contam pares paciente × canal (até 200), com resumo por canal. SENT indica aceite do provider, sem confirmação de entrega. Falhas individuais são contadas e registradas no histórico. Envios são síncronos, sequenciais e sem deduplicação entre requisições; repetir o POST cria novas tentativas.',
  })
  @ApiOkResponse({ type: SendMessagesResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description:
      'UUIDs v4, pacientes/canais distintos e limites obrigatórios; channels não aceita null ou array vazio.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description:
      'Template ou paciente não encontrado; nenhum envio foi iniciado.',
  })
  send(@Body() dto: SendMessagesDto) {
    return this.messages.send(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Consulta o histórico paginado com paciente e template',
    description:
      'Inclui envios manuais e notificações automáticas de exames. Notificações automáticas têm templateId e template nulos.',
  })
  @ApiOkResponse({ type: PaginatedMessagesDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Paginação inválida ou campos desconhecidos.',
  })
  findAll(@Query() query: PaginationDto) {
    return this.messages.findAll(query);
  }
}
