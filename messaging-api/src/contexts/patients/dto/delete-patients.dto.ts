import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export const MAX_DELETE_PATIENTS = 100;

export class DeletePatientsDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    minItems: 1,
    maxItems: MAX_DELETE_PATIENTS,
    uniqueItems: true,
    example: ['00000000-0000-4000-8000-000000000002'],
    description:
      'UUIDs v4 dos pacientes a excluir permanentemente, junto com os exames e o histórico vinculado.',
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DELETE_PATIENTS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  patientIds: string[];
}
