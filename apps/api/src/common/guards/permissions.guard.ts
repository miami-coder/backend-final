import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('No authenticated user');

    // Перевірка дозволів відбувається в сервісному шарі (там є доступ до БД / кешу).
    // Гард лише гарантує, що в користувача є роль. Детальна перевірка — через
    // PermissionsService.hasPermission(), який явно викликається у сервісах.
    const hasAnyRole = (user.roles ?? []).length > 0;
    if (!hasAnyRole) throw new ForbiddenException('No roles assigned');

    return true;
  }
}
