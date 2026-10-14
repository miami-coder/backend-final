import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordViewDto {
  @IsOptional() @IsString() @MaxLength(64) sessionId?: string;
}
