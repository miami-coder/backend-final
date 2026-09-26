import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Добрий день!', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}