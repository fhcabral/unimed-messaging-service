import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import {
  PaginatedExamsDto,
  ProcessExamsResponseDto,
} from './dto/exam-response.dto';
import { ExamsService } from './exams.service';
import { ExamNotificationService } from './exam-notification.service';
import { ListExamsDto } from './dto/list-exams.dto';

@ApiTags('exams')
@ApiInternalServerErrorResponse({
  type: ApiErrorDto,
  description: 'Falha interna; consulte exames e histórico antes de reenviar.',
})
@Controller('exams')
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly notifications: ExamNotificationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista exames com paciente, paginação e filtros de estado',
  })
  @ApiOkResponse({ type: PaginatedExamsDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description:
      'Paginação, status ou notificationStatus inválido, ou campos desconhecidos.',
  })
  findAll(@Query() query: ListExamsDto) {
    return this.exams.findAll(query);
  }

  @Post('process-pending')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verifica RELEASED/PENDING. Não reenvia SENT, FAILED ou PROCESSING.',
    description:
      'Processa notificações SMS sequencialmente. uncertain indica tentativas que precisam de conferência antes de qualquer reenvio. Exames reservados por outra execução são ignorados e não entram no total.',
  })
  @ApiOkResponse({ type: ProcessExamsResponseDto })
  processPending() {
    return this.notifications.processPending();
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Reprocessa explicitamente apenas FAILED, preservando as tentativas anteriores.',
    description:
      'Somente exames RELEASED/FAILED podem ser reprocessados. uncertain indica resultado incerto, que exige conferência no histórico.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID do exame.' })
  @ApiOkResponse({ type: ProcessExamsResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'ID deve ser UUID válido.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Exame não encontrado.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Exame fora de RELEASED/FAILED ou reservado por outra execução.',
  })
  retry(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.retryFailed(id);
  }
}
