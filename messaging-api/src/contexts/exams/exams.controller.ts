import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { ExamNotificationService } from './exam-notification.service';
import { ListExamsDto } from './dto/list-exams.dto';

@ApiTags('exams')
@Controller('exams')
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly notifications: ExamNotificationService,
  ) {}

  @Get()
  findAll(@Query() query: ListExamsDto) {
    return this.exams.findAll(query);
  }

  @Post('process-pending')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verifica RELEASED/PENDING. Não reenvia SENT, FAILED ou PROCESSING.',
  })
  processPending() {
    return this.notifications.processPending();
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Reprocessa explicitamente apenas FAILED, preservando as tentativas anteriores.',
  })
  retry(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.retryFailed(id);
  }
}
