import { ApiProperty } from '@nestjs/swagger';

export class TemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ maxLength: 120, example: 'Avaliação fictícia' })
  name: string;

  @ApiProperty({
    maxLength: 1600,
    example: 'Olá, {{name}}! Como foi seu atendimento?',
  })
  content: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 255 })
  subject: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
