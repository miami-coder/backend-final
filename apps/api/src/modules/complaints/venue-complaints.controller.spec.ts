import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { VenueComplaintsController } from './venue-complaints.controller';
import { ComplaintsService } from './complaints.service';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';

describe('VenueComplaintsController', () => {
  let controller: VenueComplaintsController;
  let complaints: any;
  let venues: any;
  let perms: any;

  beforeEach(async () => {
    complaints = { listForVenue: jest.fn().mockResolvedValue({ data: [], meta: undefined }) };
    venues = { findOneOrThrow: jest.fn() };
    perms = { hasPermission: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [VenueComplaintsController],
      providers: [
        { provide: ComplaintsService, useValue: complaints },
        { provide: VenuesService, useValue: venues },
        { provide: PermissionsService, useValue: perms },
      ],
    }).compile();
    controller = module.get(VenueComplaintsController);
  });

  it('власник закладу бачить скарги свого закладу', async () => {
    perms.hasPermission.mockResolvedValue(false);
    venues.findOneOrThrow.mockResolvedValue({ ownerId: 'u1' });
    complaints.listForVenue.mockResolvedValue({ data: [{ id: 'c1' }], meta: { total: 1 } });
    const res = await controller.list({ sub: 'u1' } as any, 'v1', 1, 20);
    expect(venues.findOneOrThrow).toHaveBeenCalledWith('v1');
    expect(complaints.listForVenue).toHaveBeenCalledWith('v1', 1, 20);
    expect(res.data).toEqual([{ id: 'c1' }]);
  });

  it('супер-адмін (complaint:manage) бачить скарги без перевірки власності', async () => {
    perms.hasPermission.mockResolvedValue(true);
    await controller.list({ sub: 'sa' } as any, 'v1', undefined, undefined);
    expect(venues.findOneOrThrow).not.toHaveBeenCalled();
    expect(complaints.listForVenue).toHaveBeenCalledWith('v1', 1, 20);
  });

  it('не-власник отримує 403 і listForVenue не викликається', async () => {
    perms.hasPermission.mockResolvedValue(false);
    venues.findOneOrThrow.mockResolvedValue({ ownerId: 'other' });
    await expect(
      controller.list({ sub: 'u1' } as any, 'v1', 1, 20),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(complaints.listForVenue).not.toHaveBeenCalled();
  });
});