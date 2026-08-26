import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ContactsDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() website?: string;
}

export class CreateVenueDto {
  @IsString() @MinLength(3) name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @MinLength(5) address: string;
  @IsOptional() @IsLatitude() @Type(() => Number) latitude?: number;
  @IsOptional() @IsLongitude() @Type(() => Number) longitude?: number;
  @IsOptional() @ValidateNested() @Type(() => ContactsDto) contacts?: ContactsDto;
  @IsOptional() @IsObject() workingHours?: Record<string, string>;
  @IsOptional() @IsNumber() @Min(0) averageCheck?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) featureCodes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tagSlugs?: string[];
  @IsOptional() @IsString() typeSlug?: string;
}