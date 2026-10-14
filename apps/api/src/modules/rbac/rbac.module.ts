import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRole } from './entities/user-role.entity';
import { PermissionsService } from './permissions.service';
import { UserRoleListener } from './listeners/user-role.listener';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole])],
  providers: [PermissionsService, UserRoleListener],
  exports: [PermissionsService],
})
export class RbacModule {}
