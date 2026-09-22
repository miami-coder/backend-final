import { Test } from '@nestjs/testing';
import { VenuesAdminController } from './venues-admin.controller';
import { VenuesService } from './venues.service';
import { UsersService } from '../users/users.service';
import { VenueStatus } from './entities/venue.entity';

describe('VenuesAdminController', () => {
  let controller: VenuesAdminController;
  let venues: any;
  let users: any;

  beforeEach(async () => {
    venues = {
      findPending: jest.fn(),
      findApproved: jest.fn(),
      changeStatus: jest.fn(),
      findOneOrThrow: jest.fn(),
      venues: { save: jest.fn() },
    };
    users = { findById: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [VenuesAdminController],
      providers: [
        { provide: VenuesService, useValue: venues },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    controller = module.get(VenuesAdminController);
  });

  it('list delegates to findPending', async () => {
    venues.findPending.mockResolvedValue({ data: [], meta: { total: 0 } });
    await controller.list(1, 20);
    expect(venues.findPending).toHaveBeenCalledWith(1, 20);
  });

  it('listApproved delegates to findApproved', async () => {
    venues.findApproved.mockResolvedValue({ data: [], meta: { total: 0 } });
    await controller.listApproved(1, 20);
    expect(venues.findApproved).toHaveBeenCalledWith(1, 20);
  });

  it('approve changes status to Approved and wraps in { data }', async () => {
    venues.changeStatus.mockResolvedValue({ id: 'v1', status: 'approved' });
    const res = await controller.approve('v1');
    expect(venues.changeStatus).toHaveBeenCalledWith(
      'v1',
      VenueStatus.Approved,
    );
    expect(res.data.id).toBe('v1');
  });

  it('reject changes status to Rejected and wraps in { data }', async () => {
    venues.changeStatus.mockResolvedValue({ id: 'v1', status: 'rejected' });
    const res = await controller.reject('v1', { reason: 'spam' } as any);
    expect(venues.changeStatus).toHaveBeenCalledWith(
      'v1',
      VenueStatus.Rejected,
    );
    expect(res.data.id).toBe('v1');
  });

  it('assignOwner assigns owner and saves venue', async () => {
    const venue = { id: 'v1', ownerId: null };
    venues.findOneOrThrow.mockResolvedValue(venue);
    users.findById.mockResolvedValue({ id: 'u1' });
    venues.venues.save.mockResolvedValue({ id: 'v1', ownerId: 'u1' });
    const res = await controller.assignOwner('v1', 'u1');
    expect(venues.findOneOrThrow).toHaveBeenCalledWith('v1');
    expect(users.findById).toHaveBeenCalledWith('u1');
    expect(venue.ownerId).toBe('u1');
    expect(venues.venues.save).toHaveBeenCalledWith(venue);
    expect(res.data.ownerId).toBe('u1');
  });
});
