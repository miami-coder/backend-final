import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { HangoutGender, HangoutPayer } from '../entities/hangout.entity';

export class CreateHangoutDto {
  @IsDateString() date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time: string;
  @IsString() @MinLength(10) @MaxLength(500) purpose: string;
  @IsOptional() @IsEnum(HangoutGender) gender?: HangoutGender;
  @IsInt() @Min(1) @Max(20) @Type(() => Number) groupSize: number;
  @IsOptional() @IsEnum(HangoutPayer) payer?: HangoutPayer;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) desiredBudget?: number;
}
