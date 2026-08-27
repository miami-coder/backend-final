import { Test } from '@nestjs/testing';
import { HangoutsController } from './hangouts.controller';
import { HangoutsService } from './hangouts.service';

describe('HangoutsController', () => {
  let controller: HangoutsController;
  let hangouts: any;

  beforeEach(async () => {
    hangouts = {
      listPublic: jest.fn(),
      create: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      cancel: jest.fn(),
      getForUser: jest.fn(),
      listMine: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [HangoutsController],
      providers: [{ provide: HangoutsService, useValue: hangouts }],
    }).compile();
    controller = module.get(HangoutsController);
  });

  it('list delegates to listPublic with query', async () => {
    hangouts.listPublic.mockResolvedValue({ data: [], meta: {} });
    const q = { venueId: 'v1', page: 1, limit: 10 };
    await controller.list(q);
    expect(hangouts.listPublic).toHaveBeenCalledWith(q);
  });

  it('create delegates and wraps in data', async () => {
    hangouts.create.mockResolvedValue({ id: 'h1' });
    const res = await controller.create({ sub: 'u1' } as any, 'v1', {
      title: 'x',
    } as any);
    expect(hangouts.create).toHaveBeenCalledWith('u1', 'v1', { title: 'x' });
    expect(res.data.id).toBe('h1');
  });

  it('join delegates and wraps in data', async () => {
    hangouts.join.mockResolvedValue({ id: 'h1' });
    const res = await controller.join({ sub: 'u1' } as any, 'h1');
    expect(hangouts.join).toHaveBeenCalledWith('u1', 'h1');
    expect(res.data.id).toBe('h1');
  });

  it('leave delegates and returns id', async () => {
    hangouts.leave.mockResolvedValue(undefined);
    const res = await controller.leave({ sub: 'u1' } as any, 'h1');
    expect(hangouts.leave).toHaveBeenCalledWith('u1', 'h1');
    expect(res.data.id).toBe('h1');
  });

  it('cancel delegates and wraps in data', async () => {
    hangouts.cancel.mockResolvedValue({ id: 'h1' });
    const res = await controller.cancel({ sub: 'u1' } as any, 'h1');
    expect(hangouts.cancel).toHaveBeenCalledWith('u1', 'h1');
    expect(res.data.id).toBe('h1');
  });

  it('get delegates to getForUser and wraps in data', async () => {
    hangouts.getForUser.mockResolvedValue({ id: 'h1' });
    const res = await controller.get({ sub: 'u1' } as any, 'h1');
    expect(hangouts.getForUser).toHaveBeenCalledWith('u1', 'h1');
    expect(res.data.id).toBe('h1');
  });

  it('myList delegates to listMine with role and wraps in data', async () => {
    hangouts.listMine.mockResolvedValue([{ id: 'h1' }]);
    const res = await controller.myList({ sub: 'u1' } as any, 'created');
    expect(hangouts.listMine).toHaveBeenCalledWith('u1', 'created');
    expect(res.data[0].id).toBe('h1');
  });
});
