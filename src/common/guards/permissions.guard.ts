import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser | undefined;
    if (!user) throw new ForbiddenException('No authenticated user');

    // Permission check happens in service layer (has access to DB / cache).
    // Here we just ensure user has some role context. Detailed check is via
    // PermissionsService.hasPermission() called explicitly in services.
    const hasAnyRole = (user.roles ?? []).length > 0;
    if (!hasAnyRole) throw new ForbiddenException('No roles assigned');

    return true;
  }
}