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

  beforeEach(async () => {
    venues = {
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    photos = { save: jest.fn(), insert: jest.fn(), count: jest.fn() };
    perms = { hasPermission: jest.fn() };
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
