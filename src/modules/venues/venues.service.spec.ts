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
  let perms: any;
  let cache: any;
  let events: any;

  beforeEach(async () => {
    venues = { create: jest.fn((x) => x), save: jest.fn().mockResolvedValue(undefined), findOne: jest.fn(), findAndCount: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(qb()) };
    perms = { hasPermission: jest.fn() };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), delByPattern: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: getRepositoryToken(VenuePhoto), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(VenueFeature), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(Tag), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(VenueTag), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(VenueType), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: { save: jest.fn() } },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('create sets status=pending and emits event', async () => {
    const v = await service.create('u1', { name: 'X', address: 'Y' } as any);
    expect((v as any).status).toBe(VenueStatus.Pending);
    expect(events.emit).toHaveBeenCalledWith('venue.created', expect.anything());
  });

  it('update allows owner', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u1', status: VenueStatus.Approved });
    await service.update('u1', 'v1', { name: 'New' } as any);
    expect(events.emit).toHaveBeenCalledWith('venue.updated', expect.anything());
  });

  it('update throws for non-owner without permission', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u2', status: VenueStatus.Approved });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.update('u1', 'v1', { name: 'X' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('update allows super_admin (venue:edit:any)', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u2', status: VenueStatus.Approved });
    perms.hasPermission.mockResolvedValueOnce(true);
    await service.update('admin', 'v1', { name: 'X' } as any);
    expect(venues.save).toHaveBeenCalled();
  });

  it('findOneOrThrow throws on missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.findOneOrThrow('x')).rejects.toThrow(NotFoundException);
  });

  it('search returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce({ data: [{ id: 'v1', name: 'X' }], total: 1 });
    const res = await service.search({ page: 1, limit: 20 } as any);
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('search queries DB on cache miss', async () => {
    const res = await service.search({ page: 1, limit: 20 } as any);
    expect(venues.createQueryBuilder).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
    expect(res.data).toEqual([]);
  });

  it('changeStatus emits status_changed event', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', status: VenueStatus.Pending });
    await service.changeStatus('v1', VenueStatus.Approved);
    expect(events.emit).toHaveBeenCalledWith('venue.status_changed', expect.anything());
  });
});
