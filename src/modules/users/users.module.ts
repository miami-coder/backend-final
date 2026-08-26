import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, OAuthAccount])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
