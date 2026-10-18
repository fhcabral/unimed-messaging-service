import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 1 })
  total: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 1000000, example: 1 })
  page: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, example: 20 })
  limit: number;
}
