import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Role } from '../rbac/entities/role.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, UserRole, Role, AuditLog]),
  ],
  providers: [AuditService],
  controllers: [AdminUsersController],
  exports: [AuditService],
})
export class AdminModule {}
