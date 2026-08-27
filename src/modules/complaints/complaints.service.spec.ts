import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
});
