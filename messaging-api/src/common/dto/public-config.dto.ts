import { ApiProperty } from '@nestjs/swagger';

export class PublicConfigDto {
  @ApiProperty({ enum: ['MOCK'], example: 'MOCK' })
  smsProvider: string;

  @ApiProperty({ enum: ['MOCK', 'SMTP'], example: 'MOCK' })
  emailProvider: string;
}
