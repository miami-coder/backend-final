import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

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

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('passes when no permissions required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeCtx({ roles: [] }, () => {}))).toBe(true);
  });

  it('throws when user not authenticated', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:create']);
    expect(() => guard.canActivate(makeCtx(undefined, () => {}))).toThrow(
      ForbiddenException,
    );
  });

  it('throws when user has no roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:create']);
    expect(() => guard.canActivate(makeCtx({ roles: [] }, () => {}))).toThrow(
      ForbiddenException,
    );
  });

  it('passes when user has roles (detailed check is in service)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['venue:create']);
    expect(guard.canActivate(makeCtx({ roles: ['user'] }, () => {}))).toBe(
      true,
    );
  });
});
