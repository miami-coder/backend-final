import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRole } from './entities/user-role.entity';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole])],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class RbacModule {}
