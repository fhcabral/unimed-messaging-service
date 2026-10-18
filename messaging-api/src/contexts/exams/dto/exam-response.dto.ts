import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PatientResponseDto } from '../../patients/dto/patient-response.dto';
import { SendSummaryDto } from '../../messages/dto/message-response.dto';
import { ExamStatus, NotificationStatus } from '../entities/exam.entity';

export class ExamResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  patientId: string;

  @ApiProperty({ type: PatientResponseDto })
  patient: PatientResponseDto;

  @ApiProperty({ enum: ExamStatus })
  status: ExamStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  releasedAt: Date | null;

  @ApiProperty({ enum: NotificationStatus })
  notificationStatus: NotificationStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  notifiedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  notificationError: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  processingStartedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  notificationMessageId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({
    description:
      'PROCESSING sem data de início ou por pelo menos cinco minutos. Exige conferência antes de qualquer reenvio.',
  })
  reconciliationRequired: boolean;
}

export class PaginatedExamsDto extends PaginatedResponseDto {
  @ApiProperty({ type: [ExamResponseDto] })
  data: ExamResponseDto[];
}

export class ProcessExamsResponseDto extends SendSummaryDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 0,
    description:
      'Tentativas com resultado incerto; conferir exames e histórico antes de reenviar.',
  })
  uncertain: number;
}
