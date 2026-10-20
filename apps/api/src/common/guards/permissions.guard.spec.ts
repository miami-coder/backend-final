import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from '../../modules/rbac/permissions.service';

function makeCtx(
  user: any,
  handler: any,
  classMeta: any[] = [],
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => (classMeta.length ? { prototype: {} } : function () {}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let perms: { hasAnyPermission: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    perms = { hasAnyPermission: jest.fn().mockResolvedValue(false) };
    guard = new PermissionsGuard(reflector, perms as unknown as PermissionsService);
  });

  it('passes when no permissions required (service not consulted)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(
      await guard.canActivate(makeCtx({ roles: ['user'] }, () => {})),
    ).toBe(true);
    expect(perms.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('passes when empty permission list required (service not consulted)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(
      await guard.canActivate(makeCtx({ roles: ['user'] }, () => {})),
    ).toBe(true);
    expect(perms.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('throws when user not authenticated', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:create']);
    await expect(guard.canActivate(makeCtx(undefined, () => {}))).rejects.toThrow(
      ForbiddenException,
    );
    expect(perms.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('throws when user has no permissions and no roles', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:create']);
    await expect(
      guard.canActivate(makeCtx({ sub: 'u1', roles: [] }, () => {})),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when user is authenticated but lacks the permission (RBAC hole)', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['user:manage']);
    perms.hasAnyPermission.mockResolvedValue(false);
    await expect(
      guard.canActivate(
        makeCtx({ sub: 'u1', email: 'a@b.c', roles: ['user'] }, () => {}),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(perms.hasAnyPermission).toHaveBeenCalledWith('u1', ['user:manage']);
  });

  it('throws when permission check returns false even with super_admin-style role in token', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:moderate']);
    perms.hasAnyPermission.mockResolvedValue(false);
    await expect(
      guard.canActivate(makeCtx({ sub: 'u2', roles: ['user'] }, () => {})),
    ).rejects.toThrow('Недостатньо дозволів');
  });

  it('passes when user has the required permission (DB-backed)', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['user:manage']);
    perms.hasAnyPermission.mockResolvedValue(true);
    expect(
      await guard.canActivate(
        makeCtx({ sub: 'admin1', roles: ['super_admin'] }, () => {}),
      ),
    ).toBe(true);
    expect(perms.hasAnyPermission).toHaveBeenCalledWith('admin1', [
      'user:manage',
    ]);
  });

  it('passes when user has any of the required permissions (any-of semantics)', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:edit:own', 'complaint:manage']);
    perms.hasAnyPermission.mockResolvedValue(true);
    expect(
      await guard.canActivate(makeCtx({ sub: 'v1', roles: ['venue_admin'] }, () => {})),
    ).toBe(true);
    expect(perms.hasAnyPermission).toHaveBeenCalledWith('v1', [
      'venue:edit:own',
      'complaint:manage',
    ]);
  });
});