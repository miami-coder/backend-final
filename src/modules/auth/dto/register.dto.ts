import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Min, MinLength, Validate } from 'class-validator';
import { IsStrongPasswordConstraint } from './validators/password.validator';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) @Validate(IsStrongPasswordConstraint) password: string;
  @IsString() @MinLength(2) firstname: string;
  @IsString() @MinLength(2) lastname: string;
  @IsOptional() @IsNumber() @Min(18) @Type(() => Number) age?: number;
  @IsOptional() @IsString() phone?: string;
  @IsBoolean() acceptEula: boolean;
}
