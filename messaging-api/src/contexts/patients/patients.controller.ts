import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import {
  DeletePatientsResponseDto,
  ImportPatientsResponseDto,
  PaginatedPatientsDto,
} from './dto/patient-response.dto';
import { MAX_CSV_BYTES, PatientsService } from './patients.service';
import { ListPatientsDto } from './dto/list-patients.dto';
import { DeletePatientsDto } from './dto/delete-patients.dto';

@ApiTags('patients')
@ApiInternalServerErrorResponse({
  type: ApiErrorDto,
  description: 'Falha interna ao processar a solicitação.',
})
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Importa até 1000 pacientes de um CSV UTF-8 de até 1 MiB',
    description:
      'Separador vírgula e cabeçalho name com phone e/ou email. Aceita name,phone legado. Cada linha exige nome e algum contato válido. Conflitos de contato são ignorados, sem atualizar pacientes existentes. CSV estruturalmente inválido rejeita o arquivo inteiro antes de gravar.',
  })
  @ApiCreatedResponse({ type: ImportPatientsResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description:
      'Arquivo ausente, extensão/MIME inválido, CSV inválido ou mais de 1000 registros.',
  })
  @ApiPayloadTooLargeResponse({
    type: ApiErrorDto,
    description: 'Arquivo maior que 1 MiB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CSV_BYTES, files: 1, fields: 0 },
      fileFilter: (_request, file, callback) => {
        const accepted =
          /\.csv$/i.test(file.originalname) &&
          [
            'text/csv',
            'application/csv',
            'application/vnd.ms-excel',
            'text/plain',
            'application/octet-stream',
          ].includes(file.mimetype);
        callback(
          accepted ? null : new BadRequestException('Envie um arquivo .csv.'),
          accepted,
        );
      },
    }),
  )
  import(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('O campo file é obrigatório.');
    return this.patients.importCsv(file.buffer);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista pacientes com paginação e busca por contato ou nome',
  })
  @ApiOkResponse({ type: PaginatedPatientsDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Filtros inválidos ou campos desconhecidos.',
  })
  findAll(@Query() query: ListPatientsDto) {
    return this.patients.findAll(query);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Exclui permanentemente o paciente, exames e mensagens',
    description:
      'Bloqueia mensagens PENDING e exames PROCESSING. A exclusão não cancela envios já processados. Templates são preservados.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID v4 do paciente.' })
  @ApiNoContentResponse({
    description: 'Paciente, exames e mensagens excluídos. Sem corpo.',
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'ID deve ser UUID v4.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Paciente não encontrado.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Paciente possui mensagem PENDING ou exame PROCESSING.',
  })
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    await this.patients.removeMany([id.toLowerCase()]);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Exclui até 100 pacientes, exames e mensagens em uma única transação',
    description:
      'Bloqueia mensagens PENDING e exames PROCESSING. Qualquer ID inexistente ou pendência impede a exclusão de todo o lote. Templates são preservados.',
  })
  @ApiOkResponse({ type: DeletePatientsResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description:
      'Exige de 1 a 100 UUIDs v4 distintos; campos desconhecidos são rejeitados.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Um ou mais pacientes não encontrados; nenhum foi excluído.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Há mensagem PENDING ou exame PROCESSING; nenhum paciente foi excluído.',
  })
  removeMany(@Body() dto: DeletePatientsDto) {
    return this.patients.removeMany(dto.patientIds);
  }
}
