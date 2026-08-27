import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminUsersController } from './admin-users.controller';
import { AuditService } from './audit.service';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Role } from '../rbac/entities/role.entity';

function makeRepo() {
  return {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((x) => Promise.resolve(x)),
    delete: jest.fn(),
  };
}

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
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
      controllers: [AdminUsersController],
      providers: [
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: profiles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    controller = module.get(AdminUsersController);
  });

  describe('list', () => {
    it('returns paginated data from users.findAndCount', async () => {
      const user = { id: 'u1', profile: { id: 'p1' } };
      users.findAndCount.mockResolvedValue([[user], 1]);
      const res = await controller.list(1, 20);
      expect(res.data).toEqual([user]);
      expect(res.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        hasMore: false,
      });
      expect(users.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          relations: { profile: true },
        }),
      );
    });

    it('defaults page/limit when undefined', async () => {
      users.findAndCount.mockResolvedValue([[], 0]);
      const res = await controller.list(undefined as any, undefined as any);
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(20);
      expect(users.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: undefined }),
      );
    });
  });

  describe('get', () => {
    it('returns { data: user } when found', async () => {
      users.findOne.mockResolvedValue({ id: 'u1' });
      const res = await controller.get('u1');
      expect(res.data).toEqual({ id: 'u1' });
    });

    it('throws NotFoundException when missing', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(controller.get('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates and audits the profile', async () => {
      const existing = { userId: 'u1', name: 'old' };
      profiles.findOne.mockResolvedValue(existing);
      const res = await controller.updateProfile(
        { sub: 'admin' } as any,
        'u1',
        { name: 'new' } as any,
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
        controller.updateProfile({ sub: 'admin' } as any, 'u1', {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes, audits and returns { data: { id } }', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', deletedAt: null });
      const res = await controller.softDelete({ sub: 'admin' } as any, 'u1');
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
      await expect(
        controller.softDelete({ sub: 'admin' } as any, 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids deleting self', async () => {
      users.findOne.mockResolvedValue({ id: 'me', deletedAt: null });
      await expect(
        controller.softDelete({ sub: 'me' } as any, 'me'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assignRole', () => {
    it('adds role when action=add and not existing', async () => {
      roles.findOne.mockResolvedValue({ id: 'r1', code: 'admin' });
      userRoles.findOne.mockResolvedValue(null);
      const res = await controller.assignRole({ sub: 'admin' } as any, 'u1', {
        roleCode: 'admin',
        action: 'add',
      } as any);
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

    it('skips save when role already assigned', async () => {
      roles.findOne.mockResolvedValue({ id: 'r1', code: 'admin' });
      userRoles.findOne.mockResolvedValue({ userId: 'u1', roleId: 'r1' });
      await controller.assignRole({ sub: 'admin' } as any, 'u1', {
        roleCode: 'admin',
        action: 'add',
      } as any);
      expect(userRoles.save).not.toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith('user_role.added', {
        userId: 'u1',
      });
    });

    it('removes role when action=remove', async () => {
      roles.findOne.mockResolvedValue({ id: 'r1', code: 'admin' });
      const res = await controller.assignRole({ sub: 'admin' } as any, 'u1', {
        roleCode: 'admin',
        action: 'remove',
      } as any);
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
        controller.assignRole({ sub: 'admin' } as any, 'u1', {
          roleCode: 'nope',
          action: 'add',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
