import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { Role } from '../rbac/entities/role.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { PermissionsService } from '../rbac/permissions.service';
import * as bcrypt from 'bcryptjs';

const perms = { invalidate: jest.fn().mockResolvedValue(undefined) };

function makeRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let users: ReturnType<typeof makeRepo>;
  let profiles: ReturnType<typeof makeRepo>;
  let oauth: ReturnType<typeof makeRepo>;
  let roles: ReturnType<typeof makeRepo>;
  let userRoles: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    users = makeRepo();
    profiles = makeRepo();
    oauth = makeRepo();
    roles = makeRepo();
    userRoles = makeRepo();
    perms.invalidate.mockClear();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: profiles },
        { provide: getRepositoryToken(OAuthAccount), useValue: oauth },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: PermissionsService, useValue: perms },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('create', () => {
    it('throws ConflictException when email exists', async () => {
      users.findOne.mockResolvedValueOnce({ id: 'u1' });
      await expect(
        service.create({
          email: 'a@b.com',
          password: 'Password1',
          firstname: 'A',
          lastname: 'B',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and profile with hashed password', async () => {
      users.findOne.mockResolvedValueOnce(null);
      users.save.mockImplementationOnce(async (u) => ({ id: 'u-new', ...u }));
      profiles.save.mockImplementationOnce(async (p) => p);
      const user = await service.create({
        email: 'A@B.com',
        password: 'Password1',
        firstname: 'Іван',
        lastname: 'Петренко',
      });
      expect(user.email).toBe('a@b.com');
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(await bcrypt.compare('Password1', user.passwordHash!)).toBe(true);
      expect(profiles.save).toHaveBeenCalledWith(
        expect.objectContaining({
          firstname: 'Іван',
          lastname: 'Петренко',
          userId: 'u-new',
        }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFound when missing', async () => {
      users.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyPassword', () => {
    it('returns false when passwordHash is null (OAuth-only user)', async () => {
      const u = { passwordHash: null } as any;
      expect(await service.verifyPassword(u, 'x')).toBe(false);
    });
    it('returns true on correct password', async () => {
      const hash = await bcrypt.hash('Password1', 4);
      expect(
        await service.verifyPassword(
          { passwordHash: hash } as any,
          'Password1',
        ),
      ).toBe(true);
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('reuses existing user by provider id', async () => {
      oauth.findOne.mockResolvedValueOnce({ userId: 'u-existing' });
      users.findOne
        .mockResolvedValueOnce({
          id: 'u-existing',
          email: 'a@b.com',
        })
        .mockResolvedValueOnce(null); // у користувача ще немає ролі → бекфілл
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce(null);
      const u = await service.findOrCreateOAuthUser(
        'a@b.com',
        'google',
        'g-1',
        { firstname: 'A', lastname: 'B' },
      );
      expect(u.id).toBe('u-existing');
      expect(users.save).not.toHaveBeenCalled();
    });

    it('creates new user when no oauth account and no email', async () => {
      oauth.findOne.mockResolvedValueOnce(null);
      users.findOne.mockResolvedValueOnce(null);
      users.save.mockResolvedValueOnce({ id: 'u-new' });
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce(null);
      const u = await service.findOrCreateOAuthUser(
        'a@b.com',
        'google',
        'g-1',
        { firstname: 'A', lastname: 'B' },
      );
      expect(u.id).toBe('u-new');
      expect(oauth.save).toHaveBeenCalled();
    });

    // Дефект: oauth-користувач створювався БЕЗ ролі 'user'
    // (паритет із register(), який грантує 'user' при звичайній реєстрації)
    it("новий користувач отримує роль 'user' (паритет із register)", async () => {
      oauth.findOne.mockResolvedValueOnce(null);
      users.findOne.mockResolvedValueOnce(null);
      users.save.mockResolvedValueOnce({ id: 'u-new' });
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce(null);
      await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', {
        firstname: 'A',
        lastname: 'B',
      });
      expect(userRoles.save).toHaveBeenCalledWith({
        userId: 'u-new',
        roleId: 'role-user',
      });
      // кеш пермішенів новим користувачам не потрібен, але для бекфілла — так
      expect(perms.invalidate).toHaveBeenCalledWith('u-new');
    });

    it("ідемпотентно: роль 'user' уже є — не грантує двічі", async () => {
      oauth.findOne.mockResolvedValueOnce({ userId: 'u-exist' });
      users.findOne.mockResolvedValueOnce({ id: 'u-exist' });
      // ensureUserRole: користувач уже має роль 'user'
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce({
        userId: 'u-exist',
        roleId: 'role-user',
      });
      await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-2', {
        firstname: 'A',
        lastname: 'B',
      });
      expect(userRoles.save).not.toHaveBeenCalled();
      expect(perms.invalidate).not.toHaveBeenCalled();
    });

    it('бекфілл: існуючий oauth-акаунт без ролей отримує роль user', async () => {
      oauth.findOne.mockResolvedValueOnce({ userId: 'u-old' });
      users.findOne.mockResolvedValueOnce({ id: 'u-old' });
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce(null);
      await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-3', {
        firstname: 'A',
        lastname: 'B',
      });
      expect(userRoles.save).toHaveBeenCalledWith({
        userId: 'u-old',
        roleId: 'role-user',
      });
      // бекфілл змінює права — кеш мусимо інвалідувати
      expect(perms.invalidate).toHaveBeenCalledWith('u-old');
    });

    // Дефект: soft-видалений акаунт (адмін-видалення) при повторному oauth-вході
    // логінився «мулликом» — прихованим зі списку користувачів
    it('oauth-вхід soft-видаленого акаунта НЕ оживає — 409 (ревʼю крок 2)', async () => {
      oauth.findOne.mockResolvedValueOnce({ userId: 'u-del' });
      users.findOne.mockResolvedValueOnce({
        id: 'u-del',
        email: 'a@b.com',
        deletedAt: new Date(),
      });
      await expect(
        service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', {
          firstname: 'A',
          lastname: 'B',
        }),
      ).rejects.toThrow(ConflictException);
      expect(users.update).not.toHaveBeenCalledWith(
        { id: 'u-del' },
        { deletedAt: null },
      );
    });

    it('матч по email на soft-видаленого НЕ оживає — 409 (ревʼю крок 2)', async () => {
      oauth.findOne.mockResolvedValueOnce(null);
      users.findOne.mockResolvedValueOnce({
        id: 'u-del',
        email: 'a@b.com',
        deletedAt: new Date(),
      });
      await expect(
        service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', {
          firstname: 'A',
          lastname: 'B',
        }),
      ).rejects.toThrow(ConflictException);
      expect(users.update).not.toHaveBeenCalledWith(
        { id: 'u-del' },
        { deletedAt: null },
      );
    });
  });
});

describe('UsersService — OAuth-регістрація на видалений email', () => {
  it('видалений акаунт на той самий email → 409, без restoreAccount', async () => {
    const repo = () => ({
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const users = repo();
    const restoreAccount = jest.fn();
    const profiles = repo();
    const oauth = { ...repo(), findOne: jest.fn().mockResolvedValue(null) };
    users.findOne.mockResolvedValueOnce({
      id: 'u-del',
      email: 'a@b.com',
      deletedAt: new Date(),
    }); // findByEmail → deleted
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: profiles },
        { provide: getRepositoryToken(OAuthAccount), useValue: oauth },
        { provide: getRepositoryToken(Role), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(UserRole),
          useValue: { save: jest.fn(), findOne: jest.fn() },
        },
        { provide: PermissionsService, useValue: { invalidate: jest.fn() } },
      ],
    }).compile();
    const service = module.get(UsersService);
    await expect(
      service.findOrCreateOAuthUser('a@b.com', 'google', 'gid1', {
        firstname: 'A',
        lastname: 'B',
      }),
    ).rejects.toThrow(ConflictException);
    expect(users.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deletedAt: null }),
    );
  });
});

describe('UsersService.deleteMe — видалення власного профілю (revʼю крок 3: кабінет)', () => {
  it('ставить deletedAt, оживає через 401 при повторному логіні, токен-прапор — на боці адмін-логіки', async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({ id: 'u1', deletedAt: null }),
      save: jest.fn((x) => Promise.resolve(x)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(OAuthAccount), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Role), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(UserRole), useValue: { save: jest.fn(), findOne: jest.fn() } },
        { provide: PermissionsService, useValue: { invalidate: jest.fn() } },
      ],
    }).compile();
    const service = module.get(UsersService);
    await expect(service.deleteMe('u1')).resolves.toBeUndefined();
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', deletedAt: expect.any(Date) }),
    );
  });
});
