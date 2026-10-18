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
  @ApiProperty({
    example: 'Avaliação fictícia',
    minLength: 1,
    maxLength: 120,
    description:
      'Nome não vazio após remover espaços nas extremidades; não aceita NUL.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @NotContains('\0')
  name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Assunto literal do e-mail, sem NUL/CR/LF. Ausente, null ou vazio após trim usa Mensagem de acompanhamento no envio.',
    example: 'Mensagem de acompanhamento',
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
    minLength: 1,
    maxLength: 1600,
    pattern: '^(?:[^{}]|\\{\\{name\\}\\})*$',
    description:
      'Texto não vazio após trim, sem NUL. Aceita apenas {{name}} como placeholder.',
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
