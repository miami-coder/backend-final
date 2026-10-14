import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VenueStatus } from '../entities/venue.entity';

export class ChangeStatusDto {
  @IsEnum(VenueStatus) status: VenueStatus;
  @IsOptional() @IsString() reason?: string;
}
