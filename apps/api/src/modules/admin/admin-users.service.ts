import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull, Repository } from 'typeorm';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Role } from '../rbac/entities/role.entity';
import { AuditService } from './audit.service';
import {
  USER_ROLE_ADDED,
  USER_ROLE_REMOVED,
} from '../rbac/listeners/user-role.listener';
import { CacheService } from '../../common/services/cache.service';

/**
 * Бізнес-логіка адміністрування юзерів (контролер у
 * адмінці не має напряму працювати з репозиторіями).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly cache: CacheService,
  ) {}

  /** Мапить користувача до DTO: прибирає passwordHash і userRoles, додає roles. */
  toDto(u: User) {
    const { passwordHash: _passwordHash, userRoles, ...rest } = u;
    return { ...rest, roles: (userRoles ?? []).map((ur) => ur.role.code) };
  }

  list(page: number, limit: number) {
    const { page: p, limit: l, offset } = normalizePagination({ page, limit });
    return this.users
      .findAndCount({
        where: { deletedAt: IsNull() },
        relations: { profile: true, userRoles: { role: true } },
        skip: offset,
        take: l,
        order: { createdAt: 'DESC' },
      })
      .then(([data, total]) => ({
        data: data.map((u) => this.toDto(u)),
        meta: buildMeta({ page: p, limit: l, offset }, total),
      }));
  }

  findOneOrThrow(id: string): Promise<User> {
    return this.users
      .findOne({
        where: { id, deletedAt: IsNull() },
        relations: { profile: true, userRoles: { role: true } },
      })
      .then((u) => {
        if (!u) throw new NotFoundException('Користувача не знайдено');
        return u;
      });
  }

  get(id: string) {
    return this.findOneOrThrow(id).then((u) => ({ data: this.toDto(u) }));
  }

  /** Адмін-онування чужого профілю (інше, ніж self-update у users.controller). */
  async updateProfile(id: string, dto: Partial<Profile>, actorId: string) {
    const profile = await this.profiles.findOne({ where: { userId: id } });
    if (!profile) throw new NotFoundException('Профіль не знайдено');
    const before = { ...profile };
    Object.assign(profile, dto);
    const saved = await this.profiles.save(profile);
    await this.audit.log(actorId, 'update_profile', 'user', id, before, saved);
    return { data: saved };
  }

  /** Мʼяке видалення: deletedAt + прапор кешу для jwt-strategy. */
  async softDelete(
    actorId: string,
    id: string,
  ): Promise<{ data: { id: string } }> {
    const user = await this.users.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (user.id === actorId) {
      throw new ForbiddenException('Не можна видалити самого себе');
    }
    user.deletedAt = new Date();
    await this.users.save(user);
    await this.cache.set(`deleted:${id}`, true, 960);
    await this.audit.log(actorId, 'soft_delete', 'user', id, null, {
      deletedAt: user.deletedAt,
    });
    return { data: { id } };
  }

  /** Призначити/зняти роль — семантика 1-в-1 з попереднього контролера
   *  (assignedBy, події user_role.added/removed, порядок audit-аргументів). */
  async assignRole(
    actorId: string,
    id: string,
    roleCode: string,
    action: 'add' | 'remove',
  ) {
    const role = await this.roles.findOne({ where: { code: roleCode } });
    if (!role) throw new NotFoundException('Роль не знайдено');
    if (action === 'add') {
      const existing = await this.userRoles.findOne({
        where: { userId: id, roleId: role.id },
      });
      if (!existing) {
        await this.userRoles.save({
          userId: id,
          roleId: role.id,
          assignedBy: actorId,
        });
      }
      await this.audit.log(actorId, 'assign_role', 'user', id, null, {
        roleCode: role.code,
      });
      this.events.emit(USER_ROLE_ADDED, { userId: id });
    } else {
      await this.userRoles.delete({ userId: id, roleId: role.id });
      await this.audit.log(
        actorId,
        'remove_role',
        'user',
        id,
        { roleCode: role.code },
        null,
      );
      this.events.emit(USER_ROLE_REMOVED, { userId: id });
    }
    return { data: { id, roleCode: role.code, action } };
  }
}
