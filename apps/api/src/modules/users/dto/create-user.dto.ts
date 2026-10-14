import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @MinLength(2) firstname: string;
  @IsString() @MinLength(2) lastname: string;
  @IsOptional() age?: number;
  @IsOptional() phone?: string;
}
