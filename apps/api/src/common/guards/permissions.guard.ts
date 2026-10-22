import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtUser } from '../decorators/current-user.decorator';
import { PermissionsService } from '../../modules/rbac/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private perms: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('No authenticated user');

    // Перевірка конкретного права має відбуватись у самому захисті маршруту,
    // а не залежати від того, чи сервіс про неї згадав.
    // hasAnyPermission читає role_permissions у БД через кеш Redis (TTL 300s).
    const allowed = await this.perms.hasAnyPermission(user.sub, required);
    if (!allowed) throw new ForbiddenException('Недостатньо дозволів');
    return true;
  }
}
