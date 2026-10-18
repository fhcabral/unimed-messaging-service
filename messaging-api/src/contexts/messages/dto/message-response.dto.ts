import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PatientResponseDto } from '../../patients/dto/patient-response.dto';
import { TemplateResponseDto } from '../../templates/dto/template-response.dto';
import { MessageChannel, MessageStatus } from '../entities/message.entity';

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  patientId: string;

  @ApiProperty({ type: PatientResponseDto })
  patient: PatientResponseDto;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Nulo nas notificações automáticas de exames.',
  })
  templateId: string | null;

  @ApiProperty({ type: TemplateResponseDto, nullable: true })
  template: TemplateResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 100,
    description: 'Chave estável por exame/tipo; nula nos envios manuais.',
  })
  notificationKey: string | null;

  @ApiProperty({ example: 'Olá, Paciente Fictício! Como foi seu atendimento?' })
  content: string;

  @ApiProperty({ enum: MessageChannel })
  channel: MessageChannel;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 255,
    description: 'Assunto efetivamente usado no e-mail; nulo para SMS.',
  })
  subject: string | null;

  @ApiProperty({
    enum: MessageStatus,
    description:
      'SENT indica aceite pelo provider, sem confirmação de entrega.',
  })
  status: MessageStatus;

  @ApiProperty({ type: String, nullable: true })
  error: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PaginatedMessagesDto extends PaginatedResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  data: MessageResponseDto[];
}

export class SendSummaryDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 2,
    description: 'Quantidade de tentativas (pares paciente × canal).',
  })
  total: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 2 })
  sent: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 0 })
  failed: number;
}

export class ChannelSummaryDto {
  @ApiPropertyOptional({ type: SendSummaryDto })
  SMS?: SendSummaryDto;

  @ApiPropertyOptional({ type: SendSummaryDto })
  EMAIL?: SendSummaryDto;
}

export class SendMessagesResponseDto extends SendSummaryDto {
  @ApiPropertyOptional({
    type: ChannelSummaryDto,
    description:
      'Presente somente quando channels é informado; contém apenas os canais solicitados.',
  })
  byChannel?: ChannelSummaryDto;
}
