import { Test } from '@nestjs/testing';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { FileStorageService } from '../../common/services/file-storage.service';

describe('VenuesController', () => {
  let controller: VenuesController;
  let venues: any;
  let storage: any;

  beforeEach(async () => {
    venues = {
      search: jest.fn(),
      findOnePublic: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findOneOrThrow: jest.fn(),
      uploadPhoto: jest.fn(),
    };
    storage = { save: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [
        { provide: VenuesService, useValue: venues },
        { provide: FileStorageService, useValue: storage },
      ],
    }).compile();
    controller = module.get(VenuesController);
  });

  it('list delegates to service', async () => {
    venues.search.mockResolvedValue({ data: [], meta: { total: 0 } });
    const res = await controller.list({ page: 1, limit: 20 });
    expect(res.meta.total).toBe(0);
  });

  it('create delegates to service with user sub', async () => {
    venues.create.mockResolvedValue({ id: 'v1' });
    const res = await controller.create(
      { sub: 'u1', email: 'a@b.com', roles: ['user'] },
      { name: 'X', address: 'Y' },
    );
    expect(res.data.id).toBe('v1');
    expect(venues.create).toHaveBeenCalledWith('u1', expect.anything());
  });

  it('uploadPhoto делегує в сервіс', async () => {
    const file = {
      originalname: 'a.png',
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from('x'),
    } as Express.Multer.File;
    venues.uploadPhoto.mockResolvedValue({
      url: '/static/venues/v1/abc.png',
      filename: 'abc.png',
      size: 10,
    });
    const res = await controller.uploadPhoto(
      { sub: 'u1', email: 'a@b.com', roles: ['user'] } as any,
      'v1',
      file,
    );
    expect(venues.uploadPhoto).toHaveBeenCalledWith('u1', 'v1', file);
    expect(res.data.url).toBe('/static/venues/v1/abc.png');
  });
});
