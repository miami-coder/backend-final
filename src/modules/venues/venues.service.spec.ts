import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VenuesService } from './venues.service';
import { Venue, VenueStatus } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { PermissionsService } from '../rbac/permissions.service';
import { CacheService } from '../../common/services/cache.service';
import { FileStorageService } from '../../common/services/file-storage.service';
import { Role } from '../rbac/entities/role.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { AuditService } from '../admin/audit.service';

function qb() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn(),
  };
}

describe('VenuesService', () => {
  let service: VenuesService;
  let venues: any;
  let photos: any;
  let perms: any;
  let cache: any;
  let events: any;
  let storage: any;
  let roles: any;
  let userRoles: any;
  let audit: any;

  beforeEach(async () => {
    venues = {
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    photos = { save: jest.fn(), insert: jest.fn(), count: jest.fn() };
    perms = { hasPermission: jest.fn(), invalidate: jest.fn() };
    roles = { findOne: jest.fn() };
    userRoles = { findOne: jest.fn(), save: jest.fn() };
    audit = { log: jest.fn() };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      delByPattern: jest.fn(),
    };
    events = { emit: jest.fn() };
    storage = { save: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        {
          provide: getRepositoryToken(VenuePhoto),
          useValue: photos,
        },
        {
          provide: getRepositoryToken(VenueFeature),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(VenueFeatureAssignment),
          useValue: { save: jest.fn() },
        },
        { provide: getRepositoryToken(Tag), useValue: { find: jest.fn() } },
        {
          provide: getRepositoryToken(VenueTag),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(VenueType),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(VenueTypeAssignment),
          useValue: { save: jest.fn() },
        },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
        { provide: FileStorageService, useValue: storage },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('create sets status=pending and emits event', async () => {
    const v = await service.create('u1', { name: 'X', address: 'Y' });
    expect((v as any).status).toBe(VenueStatus.Pending);
    expect(events.emit).toHaveBeenCalledWith(
      'venue.created',
      expect.anything(),
    );
  });

  it('update allows owner', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Approved,
    });
    await service.update('u1', 'v1', { name: 'New' });
    expect(events.emit).toHaveBeenCalledWith(
      'venue.updated',
      expect.anything(),
    );
  });

  it('update throws for non-owner without permission', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(
      service.update('u1', 'v1', { name: 'X' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update allows super_admin (venue:edit:any)', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(true);
    await service.update('admin', 'v1', { name: 'X' });
    expect(venues.save).toHaveBeenCalled();
  });

  it('softDelete архівує заклад власника', async () => {
    const venue = {
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Approved,
    };
    venues.findOne.mockResolvedValueOnce(venue);
    await service.softDelete('u1', 'v1');
    expect(venue.status).toBe(VenueStatus.Archived);
    expect(venues.save).toHaveBeenCalledWith(venue);
    expect(events.emit).toHaveBeenCalledWith(
      'venue.status_changed',
      expect.anything(),
    );
  });

  it('softDelete дозволений супер-адміну (venue:edit:any)', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(true);
    await service.softDelete('admin', 'v1');
    expect(venues.save).toHaveBeenCalled();
  });

  it('approve змінює статус і видає власнику роль venue_admin', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    roles.findOne.mockResolvedValueOnce({ id: 'r1', code: 'venue_admin' });
    userRoles.findOne.mockResolvedValueOnce(null); // ролі ще нема
    const v = await service.approve('admin1', 'v1');
    expect(v.status).toBe(VenueStatus.Approved);
    expect(userRoles.save).toHaveBeenCalledWith({
      userId: 'u1',
      roleId: 'r1',
    });
    // кеш пермішенів власника скидається — роль набирає сили одразу
    expect(perms.invalidate).toHaveBeenCalledWith('u1');
    expect(audit.log).toHaveBeenCalledWith(
      'admin1',
      'venue_approve',
      'venue',
      'v1',
      null,
      expect.anything(),
    );
  });

  it('approve не дублює роль, якщо власник уже має venue_admin', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    roles.findOne.mockResolvedValueOnce({ id: 'r1', code: 'venue_admin' });
    userRoles.findOne.mockResolvedValueOnce({ userId: 'u1', roleId: 'r1' });
    await service.approve('admin1', 'v1');
    expect(userRoles.save).not.toHaveBeenCalled();
  });

  it('approve за відсутності ролі venue_admin у системі — статус змінює, роль не видає', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    roles.findOne.mockResolvedValueOnce(null);
    const v = await service.approve('admin1', 'v1');
    expect(v.status).toBe(VenueStatus.Approved);
    expect(userRoles.save).not.toHaveBeenCalled();
    expect(perms.invalidate).not.toHaveBeenCalled();
  });

  it('softDelete кидає 403 для не-власника без права', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.softDelete('u1', 'v1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('findOneOrThrow throws on missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.findOneOrThrow('x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('search returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce({
      data: [{ id: 'v1', name: 'X' }],
      total: 1,
    });
    const res = await service.search({ page: 1, limit: 20 });
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('search queries DB on cache miss', async () => {
    const res = await service.search({ page: 1, limit: 20 });
    expect(venues.createQueryBuilder).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
    expect(res.data).toEqual([]);
  });

  it('search тримить CSV тегів/фіч — « cocktails, dj » не втрачає dj', async () => {
    const mockQb = venues.createQueryBuilder(); // той самий обʼєкт, що піде у search
    await service.search({ page: 1, limit: 20, tag: ' cocktails, dj ', feature: 'wifi, parking' });
    const params = mockQb.andWhere.mock.calls.map((c) => c[1]).filter(Boolean);
    expect(params).toContainEqual({ tags: ['cocktails', 'dj'] });
    expect(params).toContainEqual({ features: ['wifi', 'parking'] });
  });

  it('changeStatus emits status_changed event', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      status: VenueStatus.Pending,
    });
    await service.changeStatus('v1', VenueStatus.Approved);
    expect(events.emit).toHaveBeenCalledWith(
      'venue.status_changed',
      expect.anything(),
    );
  });

  describe('uploadPhoto', () => {
    const file = {
      originalname: 'a.png',
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from('x'),
    };

    it('зберігає файл, створює VenuePhoto і ставить mainPhotoUrl, якщо його не було', async () => {
      venues.findOne.mockResolvedValueOnce({
        id: 'v1',
        ownerId: 'u1',
        mainPhotoUrl: null,
      });
      photos.count.mockResolvedValueOnce(2);
      storage.save.mockResolvedValueOnce({
        url: '/static/venues/v1/abc.png',
        filename: 'abc.png',
        size: 10,
      });
      const out = await service.uploadPhoto('u1', 'v1', file);
      expect(storage.save).toHaveBeenCalledWith('venues/v1', file);
      expect(photos.insert).toHaveBeenCalledWith({
        venueId: 'v1',
        url: '/static/venues/v1/abc.png',
        sortOrder: 2,
      });
      expect(venues.save).toHaveBeenCalledWith(
        expect.objectContaining({
          mainPhotoUrl: '/static/venues/v1/abc.png',
        }),
      );
      expect(out.url).toBe('/static/venues/v1/abc.png');
    });

    it('не перезаписує наявний mainPhotoUrl', async () => {
      venues.findOne.mockResolvedValueOnce({
        id: 'v1',
        ownerId: 'u1',
        mainPhotoUrl: '/static/venues/v1/old.png',
      });
      storage.save.mockResolvedValueOnce({
        url: '/static/venues/v1/new.png',
        filename: 'new.png',
        size: 10,
      });
      await service.uploadPhoto('u1', 'v1', file);
      expect(venues.save).not.toHaveBeenCalled();
      expect(photos.insert).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/static/venues/v1/new.png' }),
      );
    });

    it('кидає Forbidden для чужого закладу без права venue:edit:any', async () => {
      venues.findOne.mockResolvedValueOnce({
        id: 'v1',
        ownerId: 'u2',
        mainPhotoUrl: null,
      });
      perms.hasPermission.mockResolvedValueOnce(false);
      await expect(service.uploadPhoto('u1', 'v1', file)).rejects.toThrow(
        ForbiddenException,
      );
      expect(storage.save).not.toHaveBeenCalled();
    });
  });
});
