import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';
import { Venue } from '../venues/entities/venue.entity';
import { PermissionsService } from '../rbac/permissions.service';

function qb() {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '2' }),
  };
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviews: any;
  let venues: any;
  let perms: any;
  let events: any;

  beforeEach(async () => {
    reviews = {
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    venues = { findOne: jest.fn(), update: jest.fn() };
    perms = { hasPermission: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviews },
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: PermissionsService, useValue: perms },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(ReviewsService);
  });

  it('create throws 404 when venue missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(
      service.create('u1', 'v1', {
        rating: 5,
        text: 'Чудовий заклад! Рекомендую',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('create throws 403 when reviewer is the venue owner', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u1' });
    reviews.save.mockResolvedValueOnce({ id: 'r-new' });
    await expect(
      service.create('u1', 'v1', {
        rating: 5,
        text: 'Чудовий заклад! Рекомендую',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(reviews.save).not.toHaveBeenCalled();
  });

  it('create throws 409 on duplicate review', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    reviews.findOne.mockResolvedValueOnce({ id: 'r1' });
    await expect(
      service.create('u1', 'v1', {
        rating: 5,
        text: 'Чудовий заклад! Рекомендую',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('create saves and recalcs rating', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    reviews.findOne.mockResolvedValueOnce(null);
    reviews.save.mockResolvedValueOnce({ id: 'r-new' });
    const r = await service.create('u1', 'v1', {
      rating: 5,
      text: 'Чудовий заклад! Рекомендую',
    });
    expect(r.id).toBe('r-new');
    expect(venues.update).toHaveBeenCalledWith('v1', {
      ratingAvg: 4.5,
      ratingCount: 2,
    });
    expect(events.emit).toHaveBeenCalledWith(
      'review.created',
      expect.anything(),
    );
  });

  it('update forbids non-owner without perm', async () => {
    reviews.findOne.mockResolvedValueOnce({
      id: 'r1',
      userId: 'u2',
      venueId: 'v1',
    });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(
      service.update('u1', 'r1', { text: 'X' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update allows super_admin', async () => {
    reviews.findOne.mockResolvedValueOnce({
      id: 'r1',
      userId: 'u2',
      venueId: 'v1',
      rating: 5,
      text: '...',
    });
    perms.hasPermission.mockResolvedValueOnce(true);
    const r = await service.update('admin', 'r1', { text: 'X' });
    expect(events.emit).toHaveBeenCalledWith(
      'review.updated',
      expect.anything(),
    );
  });

  it('softDelete removes and recalcs', async () => {
    reviews.findOne.mockResolvedValueOnce({
      id: 'r1',
      userId: 'u1',
      venueId: 'v1',
    });
    await service.softDelete('u1', 'r1');
    expect(reviews.delete).toHaveBeenCalledWith('r1');
    expect(events.emit).toHaveBeenCalledWith(
      'review.deleted',
      expect.anything(),
    );
  });

  describe('feature/unfeature', () => {
    it('feature sets isFeatured=true and saves', async () => {
      reviews.findOne.mockResolvedValueOnce({ id: 'r1', isFeatured: false });
      await service.feature('r1');
      expect(reviews.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r1', isFeatured: true }),
      );
    });

    it('unfeature sets isFeatured=false and saves', async () => {
      reviews.findOne.mockResolvedValueOnce({ id: 'r1', isFeatured: true });
      await service.unfeature('r1');
      expect(reviews.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r1', isFeatured: false }),
      );
    });

    it('feature/unfeature throws 404 when review missing', async () => {
      reviews.findOne.mockResolvedValue(null);
      await expect(service.feature('nope')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.unfeature('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
