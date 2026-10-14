import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) firstname?: string;
  @IsOptional() @IsString() @MinLength(2) lastname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() age?: number;
  @IsOptional() @IsString() avatarUrl?: string;
}
