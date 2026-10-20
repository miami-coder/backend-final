import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

/** Ревʼю Stage 4 I2: контролер Топу мав голі інтерфейси — ValidationPipe
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
