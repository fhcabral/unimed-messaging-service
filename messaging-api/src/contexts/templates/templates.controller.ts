import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { TemplateResponseDto } from './dto/template-response.dto';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@ApiTags('templates')
@ApiInternalServerErrorResponse({
  type: ApiErrorDto,
  description: 'Falha interna ao processar a solicitação.',
})
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Post()
  @ApiOperation({
    summary: 'Cadastra um template de mensagem',
    description:
      'Nome e conteúdo são obrigatórios após remover espaços nas extremidades. Somente o conteúdo interpola {{name}}; o assunto é literal. Outros placeholders ou chaves isoladas são rejeitados.',
  })
  @ApiCreatedResponse({ type: TemplateResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description:
      'Campos inválidos, limites excedidos, placeholder inválido ou campos desconhecidos.',
  })
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista todos os templates, dos mais recentes aos mais antigos',
  })
  @ApiOkResponse({ type: [TemplateResponseDto] })
  findAll() {
    return this.templates.findAll();
  }
}
