import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { NewsCategory, NewsStatus } from '../entities/news.entity';

export class CreateNewsDto {
  @IsOptional() @IsUUID() venueId?: string;
  @IsEnum(NewsCategory) category: NewsCategory;
  @IsString() @MinLength(5) title: string;
  @IsString() @MinLength(20) content: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsEnum(NewsStatus) status?: NewsStatus;
  @IsOptional() @IsBoolean() isPromoted?: boolean;
}
