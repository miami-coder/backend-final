import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Role } from '../rbac/entities/role.entity';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import {
  USER_ROLE_ADDED,
  USER_ROLE_REMOVED,
} from '../rbac/listeners/user-role.listener';
import { AuditService } from './audit.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  @Permissions('user:manage')
  list(@Query('page') page: number, @Query('limit') limit: number) {
    const { offset } = normalizePagination({ page, limit });
    return this.users
      .findAndCount({
        where: { deletedAt: IsNull() },
        relations: { profile: true },
        skip: offset,
        take: limit,
        order: { createdAt: 'DESC' },
      })
      .then(([data, total]) => ({
        data,
        meta: buildMeta({ page: page ?? 1, limit: limit ?? 20, offset }, total),
      }));
  }

  @Get(':id')
  @Permissions('user:manage')
  async get(@Param('id') id: string) {
    const user = await this.users.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { profile: true },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return { data: user };
  }

  @Patch(':id')
  @Permissions('user:manage')
  async updateProfile(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const profile = await this.profiles.findOne({ where: { userId: id } });
    if (!profile) throw new NotFoundException('Профіль не знайдено');
    const before = { ...profile };
    Object.assign(profile, dto);
    const saved = await this.profiles.save(profile);
    await this.audit.log(u.sub, 'update_profile', 'user', id, before, saved);
    return { data: saved };
  }

  @Delete(':id')
  @Permissions('user:manage')
  async softDelete(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    const user = await this.users.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (user.id === u.sub) {
      throw new ForbiddenException('Не можна видалити самого себе');
    }
    user.deletedAt = new Date();
    await this.users.save(user);
    await this.audit.log(u.sub, 'soft_delete', 'user', id, null, {
      deletedAt: user.deletedAt,
    });
    return { data: { id } };
  }

  @Post(':id/roles')
  @Permissions('user:manage')
  async assignRole(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    const role = await this.roles.findOne({ where: { code: dto.roleCode } });
    if (!role) throw new NotFoundException('Роль не знайдено');
    if (dto.action === 'add') {
      const existing = await this.userRoles.findOne({
        where: { userId: id, roleId: role.id },
      });
      if (!existing) {
        await this.userRoles.save({
          userId: id,
          roleId: role.id,
          assignedBy: u.sub,
        });
      }
      await this.audit.log(u.sub, 'assign_role', 'user', id, null, {
        roleCode: role.code,
      });
      this.events.emit(USER_ROLE_ADDED, { userId: id });
    } else {
      await this.userRoles.delete({ userId: id, roleId: role.id });
      await this.audit.log(
        u.sub,
        'remove_role',
        'user',
        id,
        { roleCode: role.code },
        null,
      );
      this.events.emit(USER_ROLE_REMOVED, { userId: id });
    }
    return { data: { id, roleCode: role.code, action: dto.action } };
  }
}
