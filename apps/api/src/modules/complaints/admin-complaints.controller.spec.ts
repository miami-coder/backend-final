import { Test } from '@nestjs/testing';
import { AdminComplaintsController } from './admin-complaints.controller';
import { ComplaintsService } from './complaints.service';

describe('AdminComplaintsController', () => {
  let controller: AdminComplaintsController;
  let complaints: any;

  beforeEach(async () => {
    complaints = { listPending: jest.fn(), resolve: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AdminComplaintsController],
      providers: [{ provide: ComplaintsService, useValue: complaints }],
    }).compile();
    controller = module.get(AdminComplaintsController);
  });

  it('list delegates to listPending', async () => {
    complaints.listPending.mockResolvedValue({ data: [], meta: { total: 0 } });
    const res = await controller.list(1, 20);
    expect(complaints.listPending).toHaveBeenCalledWith(1, 20);
    expect(res).toEqual({ data: [], meta: { total: 0 } });
  });

  it('resolve delegates and wraps in data', async () => {
    complaints.resolve.mockResolvedValue({ id: 'c1', status: 'resolved' });
    const res = await controller.resolve({ sub: 'admin1' } as any, 'c1', {
      resolution: 'ok',
    } as any);
    expect(complaints.resolve).toHaveBeenCalledWith('c1', 'admin1', {
      resolution: 'ok',
    });
    expect(res.data.id).toBe('c1');
  });
});
