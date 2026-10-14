import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ComplaintReason } from '../entities/complaint.entity';

export class CreateComplaintDto {
  @IsOptional() @IsUUID() venueId?: string;
  @IsOptional() @IsUUID() reviewId?: string;
  @IsEnum(ComplaintReason) reason: ComplaintReason;
  @IsString() @MinLength(20) text: string;
}
