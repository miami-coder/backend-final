import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

/** Контролер Топу мав голі інтерфейси — ValidationPipe
 *  їх не бачив, сміттєві тіла тілом потрапляли в БД/500. Тепер — класи. */
export class CreateTopCategoryDto {
  @IsString() @Length(1, 120) title: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
}

export class UpdateTopCategoryDto {
  @IsOptional() @IsString() @Length(1, 120) title?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
}

export class CreateTopEntryDto {
  @IsUUID() venueId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
}

/** Новий порядок записів категорії — повний список айді (індекс = позиція). */
export class ReorderTopEntriesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  entryIds: string[];
}

/** Новий порядок самих категорій Топу. */
export class ReorderTopCategoriesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  categoryIds: string[];
}
