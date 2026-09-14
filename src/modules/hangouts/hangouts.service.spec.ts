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
    venues = { findOneOrThrow: jest.fn().mockResolvedValue({ id: 'v1' }) };
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

  it('getForUser loads venue relation for participant', async () => {
    hangouts.findOne.mockResolvedValueOnce({
      id: 'h1',
      status: HangoutStatus.Open,
      participants: [{ userId: 'u1' }],
      venue: { id: 'v1' },
    });
    const h = await service.getForUser('u1', 'h1');
    expect(hangouts.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h1' },
        relations: { participants: true, venue: true },
      }),
    );
    expect(h.venue).toEqual({ id: 'v1' });
  });
});
