import { ApiProperty } from '@nestjs/swagger';

export class ProfileSnippetDto {
  @ApiProperty({ example: 'Олена', nullable: true })
  firstname: string | null;

  @ApiProperty({ example: 'Коваль', nullable: true })
  lastname: string | null;

  @ApiProperty({ example: 28, nullable: true })
  age: number | null;

  @ApiProperty({ example: '+380501234567', nullable: true })
  phone: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class MeResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ type: [String], example: ['user', 'owner'] })
  roles: string[];

  @ApiProperty({ type: () => ProfileSnippetDto })
  profile: ProfileSnippetDto;
}
