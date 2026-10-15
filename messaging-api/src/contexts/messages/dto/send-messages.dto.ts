import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { MessageChannel } from '../entities/message.entity';

export const MAX_SEND_PATIENTS = 100;

export class SendMessagesDto {
  @ApiPropertyOptional({
    enum: MessageChannel,
    isArray: true,
    default: [MessageChannel.SMS],
    minItems: 1,
    maxItems: 2,
    uniqueItems: true,
    description:
      'Se omitido, mantém o envio SMS legado. Não aceita null nem array vazio.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsEnum(MessageChannel, { each: true })
  channels?: MessageChannel[];

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
