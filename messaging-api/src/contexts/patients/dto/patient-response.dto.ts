import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

export class PatientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ maxLength: 160, example: 'Paciente Fictício' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 16,
    example: '+5511999990001',
  })
  phone: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    maxLength: 254,
    example: 'paciente@example.invalid',
  })
  email: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PaginatedPatientsDto extends PaginatedResponseDto {
  @ApiProperty({ type: [PatientResponseDto] })
  data: PatientResponseDto[];
}

export class ImportPatientsResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 2 })
  imported: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 0,
    description: 'Linhas válidas ignoradas por conflito de telefone ou e-mail.',
  })
  ignored: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 0 })
  invalid: number;
}

export class DeletePatientsResponseDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, example: 2 })
  deleted: number;
}
