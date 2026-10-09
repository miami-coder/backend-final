// backend-final/src/modules/venues/__tests__/me-venues.controller.spec.ts — локальні юніт-тести контролера
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MeVenuesController } from '../me-venues.controller';
import { VenuesService } from '../venues.service';
import { PermissionsService } from '../../rbac/permissions.service';

describe('MeVenuesController', () => {
  let controller: MeVenuesController;
  let venues: any;
  let perms: any;

  beforeEach(async () => {
    venues = { listMineForUser: jest.fn(), findOneForOwnerQuery: jest.fn() };
    perms = { hasPermission: jest.fn().mockResolvedValue(false) };
    const module = await Test.createTestingModule({
      controllers: [MeVenuesController],
      providers: [
        { provide: VenuesService, useValue: venues },
        { provide: PermissionsService, useValue: perms },
      ],
    }).compile();
    controller = module.get(MeVenuesController);
  });

  it('list delegates to listMineForUser and wraps in { data }', async () => {
    venues.listMineForUser.mockResolvedValue([{ id: 'v1', status: 'pending' }]);
    const res = await controller.list({ sub: 'u1' } as any);
    expect(venues.listMineForUser).toHaveBeenCalledWith('u1');
    expect(res.data[0].id).toBe('v1');
  });

  it('get returns own venue regardless of status', async () => {
    venues.findOneForOwnerQuery.mockResolvedValue({
      id: 'v1',
      ownerId: 'u1',
      status: 'pending',
    });
    const res = await controller.get({ sub: 'u1' } as any, 'v1');
    expect(res.data.status).toBe('pending');
  });

  it('get allows venue:edit:any for non-owner', async () => {
    perms.hasPermission.mockResolvedValue(true);
    venues.findOneForOwnerQuery.mockResolvedValue({
      id: 'v2',
      ownerId: 'other',
      status: 'rejected',
    });
    const res = await controller.get({ sub: 'u1' } as any, 'v2');
    expect(perms.hasPermission).toHaveBeenCalledWith('u1', 'venue:edit:any');
    expect(res.data.id).toBe('v2');
  });

  it('get throws Forbidden for non-owner without permission', async () => {
    perms.hasPermission.mockResolvedValue(false);
    venues.findOneForOwnerQuery.mockResolvedValue({
      id: 'v2',
      ownerId: 'other',
      status: 'approved',
    });
    await expect(
      controller.get({ sub: 'u1' } as any, 'v2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('get throws NotFound when venue missing', async () => {
    venues.findOneForOwnerQuery.mockResolvedValue(null);
    await expect(
      controller.get({ sub: 'u1' } as any, 'nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
