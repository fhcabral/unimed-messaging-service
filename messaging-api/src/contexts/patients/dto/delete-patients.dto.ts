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
    type: [String],
    minItems: 1,
    maxItems: MAX_DELETE_PATIENTS,
    uniqueItems: true,
    description:
      'Pacientes a excluir permanentemente, junto com o histórico vinculado.',
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
