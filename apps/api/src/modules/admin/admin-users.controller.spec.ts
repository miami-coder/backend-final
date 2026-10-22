import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { PermissionsService } from '../rbac/permissions.service';

// Контролер більше не працює з репозиторіями — кожен ендпоінт
// лише делегує в AdminUsersService. Бізнес-тести — в admin-users.service.spec.
describe('AdminUsersController — делегація в сервіс', () => {
  let controller: AdminUsersController;
  let service: any;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      get: jest.fn(),
      updateProfile: jest.fn(),
      softDelete: jest.fn(),
      assignRole: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        { provide: AdminUsersService, useValue: service },
        {
          provide: PermissionsService,
          useValue: { hasAnyPermission: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();
    controller = module.get(AdminUsersController);
  });

  it('list делегує (page, limit)', async () => {
    service.list.mockResolvedValue({ data: [], meta: {} });
    await controller.list('2' as any, '10' as any);
    expect(service.list).toHaveBeenCalledWith('2', '10');
  });

  it('get делегує (id)', async () => {
    service.get.mockResolvedValue({ data: {} });
    await controller.get('u1');
    expect(service.get).toHaveBeenCalledWith('u1');
  });

  it('updateProfile делегує (id, dto, actorId)', async () => {
    service.updateProfile.mockResolvedValue({ data: {} });
    await controller.updateProfile({ sub: 'admin' } as any, 'u1', {
      name: 'x',
    } as any);
    expect(service.updateProfile).toHaveBeenCalledWith(
      'u1',
      { name: 'x' },
      'admin',
    );
  });

  it('softDelete делегує (actorId, id)', async () => {
    service.softDelete.mockResolvedValue({ data: {} });
    await controller.softDelete({ sub: 'admin' } as any, 'u1');
    expect(service.softDelete).toHaveBeenCalledWith('admin', 'u1');
  });

  it('assignRole делегує (actorId, id, roleCode, action)', async () => {
    service.assignRole.mockResolvedValue({ data: {} });
    await controller.assignRole({ sub: 'admin' } as any, 'u1', {
      roleCode: 'critic',
      action: 'add',
    } as any);
    expect(service.assignRole).toHaveBeenCalledWith(
      'admin',
      'u1',
      'critic',
      'add',
    );
  });

  // Регресія: декоратори маршруту лишаються на методах делегації
  it('декоратори GET-маршруту лишаються на list', () => {
    const proto = AdminUsersController.prototype as any;
    expect(Reflect.getMetadata(PATH_METADATA, proto.list)).toBeDefined();
    expect(Reflect.getMetadata(METHOD_METADATA, proto.list)).toBe(
      RequestMethod.GET,
    );
  });
});
