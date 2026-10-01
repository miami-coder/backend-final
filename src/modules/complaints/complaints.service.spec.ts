import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import {
  Complaint,
  ComplaintReason,
  ComplaintStatus,
} from './entities/complaint.entity';

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  let complaints: any;

  beforeEach(async () => {
    complaints = {
      create: jest.fn((x) => x),
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: getRepositoryToken(Complaint), useValue: complaints },
      ],
    }).compile();
    service = module.get(ComplaintsService);
  });

  it('create requires venueId or reviewId', async () => {
    await expect(
      service.create('u1', {
        reason: ComplaintReason.Other,
        text: 'Опис проблеми з достатньою довжиною',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(complaints.save).not.toHaveBeenCalled();
  });

  it('create saves a valid complaint', async () => {
    const r = await service.create('u1', {
      venueId: 'v1',
      reason: ComplaintReason.Fraud,
      text: 'Опис проблеми з достатньою довжиною',
    });
    expect(complaints.save).toHaveBeenCalled();
    expect(r.userId).toBe('u1');
    expect(r.venueId).toBe('v1');
    expect(r.status).toBe(ComplaintStatus.New);
  });

  it('resolve sets status, resolvedBy and resolvedAt', async () => {
    const existing = {
      id: 'c1',
      status: ComplaintStatus.New,
      resolvedBy: null,
      resolvedAt: null,
    };
    complaints.findOne.mockResolvedValueOnce(existing);
    const r = await service.resolve('c1', 'admin1', {
      status: ComplaintStatus.Resolved,
    });
    expect(r.status).toBe(ComplaintStatus.Resolved);
    expect(r.resolvedBy).toBe('admin1');
    expect(r.resolvedAt).toBeInstanceOf(Date);
  });

  it('resolve throws 404 when complaint missing', async () => {
    complaints.findOne.mockResolvedValueOnce(null);
    await expect(
      service.resolve('c1', 'admin1', { status: ComplaintStatus.Resolved }),
    ).rejects.toThrow(NotFoundException);
  });

  // §4.4: повторний resolve не перезаписує чуже рішення
  it('resolve throws 409 when complaint already Resolved (save не викликається)', async () => {
    complaints.findOne.mockResolvedValueOnce({
      id: 'c1',
      status: ComplaintStatus.Resolved,
    });
    await expect(
      service.resolve('c1', 'admin2', { status: ComplaintStatus.Rejected }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(complaints.save).not.toHaveBeenCalled();
  });

  it('resolve throws 409 when complaint already Rejected', async () => {
    complaints.findOne.mockResolvedValueOnce({
      id: 'c2',
      status: ComplaintStatus.Rejected,
    });
    await expect(
      service.resolve('c2', 'admin2', { status: ComplaintStatus.Resolved }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(complaints.save).not.toHaveBeenCalled();
  });

  // Скарги до закладу: venueId-скарги + скарги на відгуки цього закладу
  it('listForVenue filters by venueId (своїй ціллю або ціллю відгуку)', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([[{ id: 'c1' }], 1]),
    };
    complaints.createQueryBuilder.mockReturnValue(qb);
    const r = await service.listForVenue('v1', 1, 20);
    expect(qb.where).toHaveBeenCalledWith(
      '(c.venueId = :venueId OR r.venueId = :venueId)',
      { venueId: 'v1' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('c.status IN (:...statuses)', {
      statuses: [
        ComplaintStatus.New,
        ComplaintStatus.InReview,
      ],
    });
    expect(r.data).toEqual([{ id: 'c1' }]);
    expect(r.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });
  });
});
