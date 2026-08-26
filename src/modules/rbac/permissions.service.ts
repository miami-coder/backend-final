import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/user-role.entity';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private readonly TTL = 300;

  constructor(
    @InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>,
    private readonly cache: CacheService,
  ) {}

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = `perms:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const rows = await this.userRoles
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'r')
      .innerJoin('role_permissions', 'rp', 'rp.roleId = r.id')
      .innerJoin('permissions', 'p', 'p.id = rp.permissionId')
      .where('ur.userId = :userId', { userId })
      .select('DISTINCT p.code', 'code')
      .getRawMany<{ code: string }>();

    const codes = rows.map(r => r.code);
    await this.cache.set(cacheKey, codes, this.TTL);
    return new Set(codes);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.has(permission);
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissions.some(p => perms.has(p));
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`perms:${userId}`);
  }
}
