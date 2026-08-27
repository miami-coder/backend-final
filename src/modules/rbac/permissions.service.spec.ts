import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { UserRole } from './entities/user-role.entity';
import { CacheService } from '../../common/services/cache.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repo: { createQueryBuilder: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { code: 'venue:create' },
            { code: 'review:create' },
          ]),
      }),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(UserRole), useValue: repo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(PermissionsService);
  });

  it('queries DB and caches when no cache hit', async () => {
    const perms = await service.getUserPermissions('u1');
    expect(perms.has('venue:create')).toBe(true);
    expect(perms.has('review:create')).toBe(true);
    expect(cache.set).toHaveBeenCalledWith(
      'perms:u1',
      ['venue:create', 'review:create'],
      300,
    );
  });

  it('returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce(['venue:moderate']);
    const perms = await service.getUserPermissions('u1');
    expect([...perms]).toEqual(['venue:moderate']);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('hasPermission returns true when permission present', async () => {
    cache.get.mockResolvedValueOnce(['venue:create']);
    expect(await service.hasPermission('u1', 'venue:create')).toBe(true);
    expect(await service.hasPermission('u1', 'venue:moderate')).toBe(false);
  });

  it('invalidate clears cache', async () => {
    await service.invalidate('u1');
    expect(cache.del).toHaveBeenCalledWith('perms:u1');
  });
});
