import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { VenueView } from './entities/venue-view.entity';
import { Venue } from '../venues/entities/venue.entity';
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
        {
          provide: getRepositoryToken(Venue),
          useValue: { increment: jest.fn() },
        },
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

describe('AnalyticsService.stats — діапазон дат (ревʼю крок 3)', () => {
  it('totalViews рахується у відборі from..to (інклюзивно до кінця дня to), а не глобально', async () => {
    // загальний у репозиторії 120, але в діапазоні запит — 5; total має бути 5
    const viewsQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { date: '2020-12-30', count: 2 },
        { date: '2020-12-31', count: 3 },
      ]),
    };
    const eventsQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const views = {
      createQueryBuilder: jest.fn().mockReturnValue(viewsQb),
      count: jest.fn().mockResolvedValue(120),
    };
    const eventsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(eventsQb),
      count: jest.fn().mockResolvedValue(9),
    };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(VenueView), useValue: views },
        {
          provide: getRepositoryToken(Venue),
          useValue: { increment: jest.fn() },
        },
        { provide: getRepositoryToken(AnalyticsEvent), useValue: eventsRepo },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    const service = module.get(AnalyticsService);
    const res = await service.getForVenue('v1', '2020-01-01', '2020-12-31');
    // 2+3 з запиту у діапазоні; count(120) — глобальний — більше не юзається
    expect(res.totalViews).toBe(5);
    // останній день діапазону включно: < (to + 1 день), не <= to
    const withDate = viewsQb.andWhere.mock.calls.find(
      (c) => c[0].includes('viewedAt') && c[0].includes('<'),
    );
    expect(withDate).toBeTruthy();
  });
});

describe('AnalyticsService.recordView — лічильник закладу (ревʼю крок 3)', () => {
  it('recorded → viewCount закладу інкрементується', async () => {
    const views = {
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    const venues = {
      increment: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(VenueView), useValue: views },
        {
          provide: getRepositoryToken(Venue),
          useValue: { increment: jest.fn() },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { save: jest.fn() },
        },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: getRepositoryToken(Venue), useValue: venues },
      ],
    }).compile();
    const service = module.get(AnalyticsService);
    const res = await service.recordView('v1', 'u1', null);
    expect(res.recorded).toBe(true);
    expect(venues.increment).toHaveBeenCalledWith({ id: 'v1' }, 'viewCount', 1);
  });

  it('дедуплікація: recorded:false — лічильник не чіпається', async () => {
    const views = {
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const venues = { increment: jest.fn() };
    const cache = { get: jest.fn().mockResolvedValue('1'), set: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(VenueView), useValue: views },
        {
          provide: getRepositoryToken(Venue),
          useValue: { increment: jest.fn() },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { save: jest.fn() },
        },
        { provide: CacheService, useValue: cache },
        { provide: getRepositoryToken(Venue), useValue: venues },
      ],
    }).compile();
    const service = module.get(AnalyticsService);
    const res = await service.recordView('v1', 'u1', null);
    expect(res.recorded).toBe(false);
    expect(venues.increment).not.toHaveBeenCalled();
  });
});
