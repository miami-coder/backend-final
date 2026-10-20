import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { HangoutsService } from './hangouts.service';
import { Hangout, HangoutStatus } from './entities/hangout.entity';
import { HangoutParticipant } from './entities/hangout-participant.entity';
import { VenuesService } from '../venues/venues.service';
import { CacheService } from '../../common/services/cache.service';
import { PermissionsService } from '../rbac/permissions.service';
import { Venue } from '../venues/entities/venue.entity';

describe('HangoutsService', () => {
  let service: HangoutsService;
  let hangouts: any;
  let participants: any;
  let venues: any;
  let cache: any;
  let events: any;

  beforeEach(async () => {
    hangouts = {
      create: jest.fn((x) => x),
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };
    participants = {
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    venues = {
      findOneOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'v1', status: 'approved' }),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        HangoutsService,
        { provide: getRepositoryToken(Hangout), useValue: hangouts },
        {
          provide: getRepositoryToken(HangoutParticipant),
          useValue: participants,
        },
        { provide: VenuesService, useValue: venues },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(HangoutsService);
  });

  const pastDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  it('create rejects past date', async () => {
    await expect(
      service.create('u1', 'v1', {
        date: pastDate(),
        time: '19:00',
        purpose: 'Зустріч для обговорення проєкту',
        groupSize: 2,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('join throws 409 when status is not open', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      status: HangoutStatus.Filled,
      groupSize: 2,
    });
    await expect(service.join('u2', 'h1')).rejects.toThrow(ConflictException);
  });

  it('join fills hangout and emits event', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      status: HangoutStatus.Open,
      groupSize: 2,
    });
    participants.findOne.mockResolvedValueOnce(null);
    participants.count.mockResolvedValueOnce(1);
    await service.join('u2', 'h1');
    expect(participants.save).toHaveBeenCalledWith({
      hangoutId: 'h1',
      userId: 'u2',
    });
    expect(hangouts.save).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalled();
  });

  it('leave blocks creator when others present', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      creatorId: 'u1',
      status: HangoutStatus.Open,
    });
    participants.count.mockResolvedValueOnce(2);
    await expect(service.leave('u1', 'h1')).rejects.toThrow(ForbiddenException);
  });

  it('cancel forbids non-creator', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      creatorId: 'u1',
      status: HangoutStatus.Open,
    });
    await expect(service.cancel('u2', 'h1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('getOne loads venue + participants-user-profile relations', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      status: HangoutStatus.Open,
      participants: [
        {
          hangoutId: 'h1',
          userId: 'u1',
          joinedAt: new Date('2026-09-30T10:00:00Z'),
          user: { profile: { firstname: 'Іван', lastname: 'Петренко' } },
        },
      ],
      venue: { id: 'v1' },
    });
    const h = await service.getOne('h1');
    expect(hangouts.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h1' },
        relations: { participants: { user: { profile: true } }, venue: true },
      }),
    );
    expect(h.participants[0]).toEqual({
      hangoutId: 'h1',
      userId: 'u1',
      joinedAt: new Date('2026-09-30T10:00:00Z'),
      firstname: 'Іван',
      lastname: 'Петренко',
    });
  });

  it('getOne дозволяє не-учаснику дивитись деталі (без 403)', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      status: HangoutStatus.Open,
      participants: [{ userId: 'someone' }],
      venue: null,
    });
    const h = await service.getOne('h1');
    expect(h.id).toBe('h1');
  });

  it('getOne витримує учасника без profile (фолбек на порожні імена)', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      status: HangoutStatus.Open,
      participants: [
        { hangoutId: 'h1', userId: 'u1', joinedAt: new Date(), user: null },
      ],
      venue: null,
    });
    const h = await service.getOne('h1');
    expect(h.participants[0].firstname).toBe('');
    expect(h.participants[0].lastname).toBe('');
  });
});

describe('HangoutsService.listPublic — кеш-хіт сторінок', () => {
  let service: HangoutsService;
  let hangouts: any;
  let cache: any;
  let venues: any;
  let perms: any;
  let events: any;

  beforeEach(async () => {
    hangouts = {
      save: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn() };
    venues = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    perms = {};
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        HangoutsService,
        { provide: getRepositoryToken(Hangout), useValue: hangouts },
        {
          provide: getRepositoryToken(HangoutParticipant),
          useValue: {},
        },
        { provide: VenuesService, useValue: venues },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(HangoutsService);
  });

  it('кеш-хіт сторінки 2: total повний (не довжина сторінки)', async () => {
    cache.get.mockResolvedValueOnce({
      data: [{ id: 'h1' }, { id: 'h2' }],
      total: 14,
    });
    const res = await service.listPublic({ page: 2, limit: 12 });
    expect(res.data).toHaveLength(2);
    expect(res.meta.total).toBe(14);
  });
});

describe('HangoutsService.create — лише схвалені заклади', () => {
  let service: HangoutsService;
  let hangouts: any;
  let venues: any;
  let participants: any;
  let cache: any;
  let events: any;

  beforeEach(async () => {
    hangouts = {
      save: jest.fn(),
      create: jest.fn((x) => x),
      findOne: jest.fn(),
    };
    participants = { save: jest.fn() };
    venues = {
      findOneOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'v1', status: 'pending' }),
    };
    cache = { get: jest.fn(), set: jest.fn(), delByPattern: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        HangoutsService,
        { provide: getRepositoryToken(Hangout), useValue: hangouts },
        {
          provide: getRepositoryToken(HangoutParticipant),
          useValue: participants,
        },
        { provide: VenuesService, useValue: venues },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(HangoutsService);
  });

  const futureDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  };

  it('create пиячок на pending-заклад → ForbiddenException', async () => {
    await expect(
      service.create('u1', 'v1', {
        date: futureDate(),
        time: '20:00',
        purpose: 'Пива',
        groupSize: 3,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create пиячок на archived-заклад → ForbiddenException', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({
      id: 'v1',
      status: 'archived',
    });
    await expect(
      service.create('u1', 'v1', {
        date: futureDate(),
        time: '20:00',
        purpose: 'Пива',
        groupSize: 3,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create на approved — ок', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({
      id: 'v1',
      status: 'approved',
    });
    await expect(
      service.create('u1', 'v1', {
        date: futureDate(),
        time: '20:00',
        purpose: 'Пива',
        groupSize: 3,
      }),
    ).resolves.toBeDefined();
  });
});

describe('HangoutsService.getOne — видалений учасник (ревʼю Stage 2)', () => {
  it('імʼя видаленого учасника приховано як «Обліковий запис видалено»', async () => {
    const repo = () => ({
      save: jest.fn(),
      create: jest.fn((x) => x),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    });
    const hangouts = repo();
    hangouts.findOne = jest.fn().mockResolvedValue({
      id: 'h1',
      participants: [
        {
          hangoutId: 'h1',
          userId: 'u-del',
          joinedAt: new Date(),
          user: {
            id: 'u-del',
            email: 'del@x.com',
            deletedAt: new Date(),
            profile: { firstname: 'Тарас', lastname: 'Секретний' },
          },
        },
        {
          hangoutId: 'h1',
          userId: 'u-ok',
          joinedAt: new Date(),
          user: {
            id: 'u-ok',
            email: 'ok@x.com',
            deletedAt: null,
            profile: { firstname: 'Олег', lastname: 'Савчук' },
          },
        },
      ],
    });
    const venues = repo();
    venues.findOneOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'v1', status: 'approved' });
    const module = await Test.createTestingModule({
      providers: [
        HangoutsService,
        { provide: getRepositoryToken(Hangout), useValue: hangouts },
        { provide: getRepositoryToken(HangoutParticipant), useValue: repo() },
        { provide: VenuesService, useValue: venues },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), delByPattern: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    const service = module.get(HangoutsService);
    const res = await service.getOne('h1');
    const del = res.participants.find((p) => p.userId === 'u-del');
    const ok = res.participants.find((p) => p.userId === 'u-ok');
    expect(del.firstname).toBe('Обліковий запис');
    expect(del.lastname).toBe('видалено');
    expect(ok.firstname).toBe('Олег');
    expect(ok.lastname).toBe('Савчук');
    expect(JSON.stringify(res)).not.toContain('Секретний');
  });
});

describe('HangoutsService — дата+час і видалення автором (ревʼю крок 3)', () => {
  let service: HangoutsService;
  let hangouts: any;
  let participants: any;
  let venues: any;
  let cache: any;
  let events: any;

  beforeEach(async () => {
    hangouts = {
      save: jest.fn((x) => Promise.resolve(x)),
      create: jest.fn((x) => x),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    participants = { save: jest.fn(), delete: jest.fn(), count: jest.fn() };
    venues = {
      findOneOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'v1', status: 'approved' }),
      createQueryBuilder: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn(), delByPattern: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        HangoutsService,
        { provide: getRepositoryToken(Hangout), useValue: hangouts },
        {
          provide: getRepositoryToken(HangoutParticipant),
          useValue: participants,
        },
        { provide: VenuesService, useValue: venues },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(HangoutsService);
  });

  it('create на сьогодні о 00:01 (минулий час) → 400, не тільки «до початку дня»', async () => {
    const today = new Date();
    const date = today.toISOString().slice(0, 10);
    await expect(
      service.create('u1', 'v1', {
        date,
        time: '00:01',
        purpose: 'Було',
        groupSize: 3,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create на сьогодні 23:00 — ок', async () => {
    const today = new Date();
    const date = today.toISOString().slice(0, 10);
    await expect(
      service.create('u1', 'v1', {
        date,
        time: '23:00',
        purpose: 'Буде',
        groupSize: 3,
      }),
    ).resolves.toBeDefined();
  });

  it('delete: автор видаляє запит повністю', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      creatorId: 'u1',
      status: 'open',
    });
    await service.delete('u1', 'h1');
    expect(hangouts.delete).toHaveBeenCalledWith('h1');
    expect(cache.delByPattern).toHaveBeenCalled();
  });

  it('delete: не-автор → 403', async () => {
    hangouts.findOne.mockResolvedValueOnce({ id: 'h1', creatorId: 'u9' });
    await expect(service.delete('u2', 'h1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(hangouts.delete).not.toHaveBeenCalled();
  });
});
