import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export const MAX_SEND_PATIENTS = 100;

export class SendMessagesDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('4')
  templateId: string;

  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: MAX_SEND_PATIENTS,
    uniqueItems: true,
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
  @ArrayMaxSize(MAX_SEND_PATIENTS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  patientIds: string[];
}
