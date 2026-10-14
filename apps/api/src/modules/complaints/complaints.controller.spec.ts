import { Test } from '@nestjs/testing';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

describe('ComplaintsController', () => {
  let controller: ComplaintsController;
  let complaints: any;

  beforeEach(async () => {
    complaints = { create: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [ComplaintsController],
      providers: [{ provide: ComplaintsService, useValue: complaints }],
    }).compile();
    controller = module.get(ComplaintsController);
  });

  it('create delegates and wraps in data', async () => {
    complaints.create.mockResolvedValue({ id: 'c1' });
    const res = await controller.create(
      { sub: 'u1' } as any,
      {
        venueId: 'v1',
        text: 'Шумно',
      } as any,
    );
    expect(complaints.create).toHaveBeenCalledWith('u1', {
      venueId: 'v1',
      text: 'Шумно',
    });
    expect(res.data.id).toBe('c1');
  });
});
