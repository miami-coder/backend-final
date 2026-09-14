import { ApiProperty } from '@nestjs/swagger';

/**
 * Metadata block returned alongside paginated lists.
 * Mirrors `PaginatedResponseMeta` from `src/common/utils/pagination.util.ts`.
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Поточна сторінка' })
  page: number;

  @ApiProperty({ example: 20, description: 'Розмір сторінки' })
  limit: number;

  @ApiProperty({ example: 42, description: 'Загальна кількість записів' })
  total: number;

  @ApiProperty({ example: true, description: 'Чи є наступна сторінка' })
  hasMore: boolean;
}
