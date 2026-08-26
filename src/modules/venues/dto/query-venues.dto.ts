import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../../../common/utils/pagination.util';

export type VenueSort = 'rating' | 'check' | 'newest' | 'name' | 'distance';

export class QueryVenuesDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() feature?: string;   // csv
  @IsOptional() @IsString() tag?: string;        // csv
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minCheck?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxCheck?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) minRating?: number;
  @IsOptional() @IsLatitude() @Type(() => Number) lat?: number;
  @IsOptional() @IsLongitude() @Type(() => Number) lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) @Max(100) radiusKm?: number;
  @IsOptional() @IsIn(['rating', 'check', 'newest', 'name', 'distance']) sort?: VenueSort;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = DEFAULT_PAGE;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number = DEFAULT_LIMIT;
}
