import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplaintStatus } from '../entities/complaint.entity';

export class ResolveComplaintDto {
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;
  @IsOptional() @IsString() note?: string;
}
