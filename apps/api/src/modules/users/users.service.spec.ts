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
      userRoles.findOne.mockResolvedValueOnce({ userId: 'u-exist', roleId: 'role-user' });
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
    it('oauth-вхід soft-видаленого акаунта: відновлює його (знімає deletedAt + роль)', async () => {
      oauth.findOne.mockResolvedValueOnce({ userId: 'u-del' });
      users.findOne.mockResolvedValueOnce({ id: 'u-del', email: 'a@b.com', deletedAt: new Date() });
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce(null);
      const u = await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', {
        firstname: 'A',
        lastname: 'B',
      });
      expect(u.id).toBe('u-del');
      expect(users.update).toHaveBeenCalledWith({ id: 'u-del' }, { deletedAt: null });
      expect(userRoles.save).toHaveBeenCalledWith({ userId: 'u-del', roleId: 'role-user' });
    });

    it('матч по email на soft-видаленого: відновлюємо, а не створюємо дубля', async () => {
      oauth.findOne.mockResolvedValueOnce(null);
      users.findOne.mockResolvedValueOnce({ id: 'u-del', email: 'a@b.com', deletedAt: new Date() });
      roles.findOne.mockResolvedValueOnce({ id: 'role-user' });
      userRoles.findOne.mockResolvedValueOnce(null);
      await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', {
        firstname: 'A',
        lastname: 'B',
      });
      expect(users.create).not.toHaveBeenCalled();
      expect(users.update).toHaveBeenCalledWith({ id: 'u-del' }, { deletedAt: null });
      expect(oauth.save).toHaveBeenCalled();
    });
  });
});
