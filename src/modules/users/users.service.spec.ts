import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import * as bcrypt from 'bcryptjs';

function makeRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let users: ReturnType<typeof makeRepo>;
  let profiles: ReturnType<typeof makeRepo>;
  let oauth: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    users = makeRepo();
    profiles = makeRepo();
    oauth = makeRepo();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: profiles },
        { provide: getRepositoryToken(OAuthAccount), useValue: oauth },
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
      users.findOne.mockResolvedValueOnce({
        id: 'u-existing',
        email: 'a@b.com',
      });
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
      const u = await service.findOrCreateOAuthUser(
        'a@b.com',
        'google',
        'g-1',
        { firstname: 'A', lastname: 'B' },
      );
      expect(u.id).toBe('u-new');
      expect(oauth.save).toHaveBeenCalled();
    });
  });
});
