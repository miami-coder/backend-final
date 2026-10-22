import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @MinLength(10) @MaxLength(2000) text: string;
  @IsOptional() @IsString() checkPhotoUrl?: string;
  /** Сума чека відвідувача, грн (опційно). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000)
  billAmount?: number;
}
