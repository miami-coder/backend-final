import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { TokenService } from './jwt.service';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../rbac/entities/user-role.entity';
import { CacheService } from '../../../common/services/cache.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let userRoles: any;
  let tokens: any;
  let cache: any;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
    users = {
      create: jest.fn().mockImplementation(async (dto) => ({
        id: 'u-new',
        email: dto.email.toLowerCase(),
        passwordHash: 'hash',
      })),
      findById: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
      findByEmail: jest.fn(),
      verifyPassword: jest.fn(),
      restoreAccount: jest.fn().mockResolvedValue(undefined),
    };
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ code: 'user' }]),
    };
    userRoles = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      manager: {
        findOne: jest.fn().mockResolvedValue({ id: 'r-user', code: 'user' }),
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    tokens = {
      signAccess: jest.fn().mockReturnValue('access-tok'),
      signRefresh: jest.fn().mockReturnValue('refresh-tok'),
      verifyRefresh: jest.fn().mockReturnValue({ sub: 'u1' }),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: TokenService, useValue: tokens },
        { provide: UsersService, useValue: users },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('register throws when acceptEula false', async () => {
    await expect(
      service.register({
        email: 'a@b.com',
        password: 'Password1',
        firstname: 'A',
        lastname: 'B',
        acceptEula: false,
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('register creates user, assigns user role, returns tokens', async () => {
    const res = await service.register({
      email: 'A@B.com',
      password: 'Password1',
      firstname: 'A',
      lastname: 'B',
      acceptEula: true,
    });
    expect(users.create).toHaveBeenCalled();
    expect(userRoles.save).toHaveBeenCalledWith({
      userId: 'u-new',
      roleId: 'r-user',
    });
    expect(res.accessToken).toBe('access-tok');
    expect(res.user.roles).toEqual(['user']);
  });

  it('login throws on unknown email', async () => {
    users.findByEmail.mockResolvedValueOnce(null);
    await expect(
      service.login({ email: 'x@y.com', password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login throws on bad password', async () => {
    users.findByEmail.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    users.verifyPassword.mockResolvedValueOnce(false);
    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login returns tokens on success', async () => {
    users.findByEmail.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    users.verifyPassword.mockResolvedValueOnce(true);
    const res = await service.login({
      email: 'a@b.com',
      password: 'Password1',
    });
    expect(res.accessToken).toBe('access-tok');
  });

  // Дефект: soft-видалений (адмін-видалення) акаунт міг логінитесь паролем
  // «мулликом» — без ролей і невидимий у списку користувачів
  it('login soft-видаленого акаунта відновлює його перед видачею токенів', async () => {
    users.findByEmail.mockResolvedValueOnce({ id: 'u-del', email: 'a@b.com', deletedAt: new Date() });
    users.verifyPassword.mockResolvedValueOnce(true);
    const res = await service.login({ email: 'a@b.com', password: 'Password1' });
    expect(users.restoreAccount).toHaveBeenCalledWith('u-del');
    expect(res.accessToken).toBe('access-tok');
  });

  it('refresh throws when token revoked', async () => {
    cache.get.mockResolvedValueOnce(true);
    await expect(service.refresh('old')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh rotates token on success', async () => {
    const res = await service.refresh('old');
    expect(res.accessToken).toBe('access-tok');
    expect(cache.set).toHaveBeenCalledWith(
      'revoked:old',
      true,
      expect.any(Number),
    );
  });

  it('logout marks token revoked', async () => {
    await service.logout('r1');
    expect(cache.set).toHaveBeenCalledWith(
      'revoked:r1',
      true,
      expect.any(Number),
    );
  });
});
