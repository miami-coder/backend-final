import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinHangoutDto {
  @IsOptional() @IsString() @MaxLength(500) message?: string;
}
