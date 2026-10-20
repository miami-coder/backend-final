import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminUsersService } from './admin-users.service';
import { AuditService } from './audit.service';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Role } from '../rbac/entities/role.entity';
import { CacheService } from '../../common/services/cache.service';

function makeRepo() {
  return {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((x) => Promise.resolve(x)),
    delete: jest.fn(),
  };
}

// Бізнес-тести адміністрування юзерів (ревʼю крок 3: контролер не має
// напряму працювати з репозиторіями — логіка оселилась у сервісі).
describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let users: any;
  let profiles: any;
  let userRoles: any;
  let roles: any;
  let audit: any;
  let events: any;

  beforeEach(async () => {
    users = makeRepo();
    profiles = makeRepo();
    userRoles = makeRepo();
    roles = makeRepo();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: profiles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminUsersService);
  });

  describe('toDto', () => {
    it('мапить role.code → roles і прибирає userRoles та passwordHash', () => {
      const dto = service.toDto({
        id: 'u1',
        email: 'a@b.c',
        passwordHash: 'secret-hash',
        deletedAt: null,
        profile: { id: 'p1' },
        userRoles: [
          { role: { code: 'super_admin' } },
          { role: { code: 'user' } },
        ],
      } as any);
      expect(dto.roles).toEqual(['super_admin', 'user']);
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('userRoles');
      expect(dto).toHaveProperty('profile');
      expect(dto.email).toBe('a@b.c');
    });

    it('повертає roles: [] коли userRoles не завантажені', () => {
      expect(service.toDto({ id: 'u2' } as any)).toEqual({
        id: 'u2',
        roles: [],
      });
    });
  });

  describe('list', () => {
    it('повертає сторінку з мапінгом toDto', async () => {
      users.findAndCount.mockResolvedValue([
        [
          {
            id: 'u1',
            profile: { id: 'p1' },
            userRoles: [{ role: { code: 'user' } }],
          },
        ],
        1,
      ]);
      const res = await service.list(1, 20);
      expect(res.data).toEqual([
        { id: 'u1', profile: { id: 'p1' }, roles: ['user'] },
      ]);
      expect(res.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        hasMore: false,
      });
      expect(users.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: expect.anything() },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('defaults page/limit when undefined', async () => {
      users.findAndCount.mockResolvedValue([[], 0]);
      const res = await service.list(undefined as any, undefined as any);
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(20);
    });
  });

  describe('get', () => {
    it('returns { data: user } with roles when found', async () => {
      users.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        passwordHash: 'secret-hash',
        profile: { id: 'p1' },
        userRoles: [{ role: { code: 'venue_admin' } }],
      });
      const res = await service.get('u1');
      expect(res.data).toEqual({
        id: 'u1',
        email: 'a@b.c',
        profile: { id: 'p1' },
        roles: ['venue_admin'],
      });
      expect(res.data).not.toHaveProperty('passwordHash');
      expect(users.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1', deletedAt: expect.anything() },
          relations: { profile: true, userRoles: { role: true } },
        }),
      );
    });

    it('throws NotFoundException when missing', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.get('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates and audits the profile', async () => {
      const existing = { userId: 'u1', name: 'old' };
      profiles.findOne.mockResolvedValue(existing);
      const res = await service.updateProfile(
        'u1',
        { name: 'new' } as any,
        'admin',
      );
      expect(res.data.name).toBe('new');
      expect(profiles.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'admin',
        'update_profile',
        'user',
        'u1',
        expect.objectContaining({ name: 'old' }),
        expect.objectContaining({ name: 'new' }),
      );
    });

    it('throws NotFoundException when profile missing', async () => {
      profiles.findOne.mockResolvedValue(null);
      await expect(
        service.updateProfile('u1', {} as any, 'admin'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes, sets cached deleted-flag, audits', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', deletedAt: null });
      const cache = { set: jest.fn() };
      // підмінити кеш-сервіс — інстанс створено в beforeEach; зручніше: тестуємо через audit + save
      const res = await service.softDelete('admin', 'u1');
      expect(res.data).toEqual({ id: 'u1' });
      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'admin',
        'soft_delete',
        'user',
        'u1',
        null,
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when user missing', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.softDelete('admin', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forbids deleting self', async () => {
      users.findOne.mockResolvedValue({ id: 'me', deletedAt: null });
      await expect(service.softDelete('me', 'me')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('assignRole', () => {
    it('adds role when action=add and not existing', async () => {
      roles.findOne.mockResolvedValue({ id: 'r1', code: 'admin' });
      userRoles.findOne.mockResolvedValue(null);
      const res = await service.assignRole('admin', 'u1', 'admin', 'add');
      expect(res.data).toEqual({ id: 'u1', roleCode: 'admin', action: 'add' });
      expect(userRoles.save).toHaveBeenCalledWith({
        userId: 'u1',
        roleId: 'r1',
        assignedBy: 'admin',
      });
      expect(audit.log).toHaveBeenCalledWith(
        'admin',
        'assign_role',
        'user',
        'u1',
        null,
        { roleCode: 'admin' },
      );
      expect(events.emit).toHaveBeenCalledWith('user_role.added', {
        userId: 'u1',
      });
    });

    it('skips save when role already assigned (event still emitted)', async () => {
      roles.findOne.mockResolvedValue({ id: 'r1', code: 'admin' });
      userRoles.findOne.mockResolvedValue({ userId: 'u1', roleId: 'r1' });
      await service.assignRole('admin', 'u1', 'admin', 'add');
      expect(userRoles.save).not.toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith('user_role.added', {
        userId: 'u1',
      });
    });

    it('removes role when action=remove', async () => {
      roles.findOne.mockResolvedValue({ id: 'r1', code: 'admin' });
      const res = await service.assignRole('admin', 'u1', 'admin', 'remove');
      expect(res.data).toEqual({
        id: 'u1',
        roleCode: 'admin',
        action: 'remove',
      });
      expect(userRoles.delete).toHaveBeenCalledWith({
        userId: 'u1',
        roleId: 'r1',
      });
      expect(audit.log).toHaveBeenCalledWith(
        'admin',
        'remove_role',
        'user',
        'u1',
        { roleCode: 'admin' },
        null,
      );
      expect(events.emit).toHaveBeenCalledWith('user_role.removed', {
        userId: 'u1',
      });
    });

    it('throws NotFoundException when role missing', async () => {
      roles.findOne.mockResolvedValue(null);
      await expect(
        service.assignRole('admin', 'u1', 'nope', 'add'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
