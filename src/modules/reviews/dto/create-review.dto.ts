import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @MinLength(10) @MaxLength(2000) text: string;
  @IsOptional() @IsString() checkPhotoUrl?: string;
}
