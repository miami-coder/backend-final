import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { VenueView } from './entities/venue-view.entity';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { CacheService } from '../../common/services/cache.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let views: any;
  let eventsRepo: any;
  let cache: any;

  beforeEach(async () => {
    views = {
      save: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };
    eventsRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };
    cache = { get: jest.fn(), set: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(VenueView), useValue: views },
        { provide: getRepositoryToken(AnalyticsEvent), useValue: eventsRepo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  it('recordView inserts on first call', async () => {
    cache.get.mockResolvedValueOnce(null);
    const r = await service.recordView('v1', 'u1');
    expect(r).toEqual({ recorded: true });
    expect(views.save).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
  });

  it('recordView dedups within TTL', async () => {
    cache.get.mockResolvedValueOnce('1');
    const r = await service.recordView('v1', 'u1');
    expect(r).toEqual({ recorded: false });
    expect(views.save).not.toHaveBeenCalled();
  });

  it('recordView without identity always records', async () => {
    const r = await service.recordView('v1', null, null);
    expect(r).toEqual({ recorded: true });
    expect(views.save).toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('recordEvent persists analytics event', async () => {
    await service.recordEvent('v1', 'u1', 'review_created', { x: 1 });
    expect(eventsRepo.save).toHaveBeenCalledWith({
      venueId: 'v1',
      userId: 'u1',
      eventType: 'review_created',
      payload: { x: 1 },
    });
  });
});
