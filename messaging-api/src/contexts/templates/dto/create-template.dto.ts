import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  NotContains,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Avaliação fictícia', maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @NotContains('\0')
  name: string;

  @ApiPropertyOptional({
    description:
      'Assunto literal do e-mail. Padrão: Mensagem de acompanhamento.',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @NotContains('\0')
  @NotContains('\r')
  @NotContains('\n')
  subject?: string | null;

  @ApiProperty({
    example: 'Olá, {{name}}! Como foi seu atendimento?',
    maxLength: 1600,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1600)
  @NotContains('\0')
  @Matches(/^(?:[^{}]|\{\{name\}\})*$/, {
    message:
      'content permite somente {{name}} como placeholder; chaves isoladas não são aceitas.',
  })
  content: string;
}
