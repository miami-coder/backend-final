import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRole } from './entities/user-role.entity';
import { PermissionsService } from './permissions.service';
import { UserRoleListener } from './listeners/user-role.listener';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole])],
  providers: [PermissionsService, UserRoleListener],
  exports: [PermissionsService],
})
// Глобальний: PermissionsGuard юзається через @UseGuards у модулях контролерів
// по всьому API і потребує PermissionsService у своєму DI-контексті.
@Global()
export class RbacModule {}
