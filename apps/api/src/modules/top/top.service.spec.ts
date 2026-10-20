import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TopService } from './top.service';
import { TopCategory } from './top-category.entity';
import { TopEntry } from './top-entry.entity';
import { Venue } from '../venues/entities/venue.entity';

describe('TopService (фіча «Топ закладів» — ревʼю викладача)', () => {
  let service: TopService;
  let categories: any;
  let entries: any;
  let venues: any;

  beforeEach(async () => {
    categories = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    entries = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    venues = {
      findOne: jest.fn().mockResolvedValue({ id: 'v1', status: 'approved' }),
    };
    const module = await Test.createTestingModule({
      providers: [
        TopService,
        { provide: getRepositoryToken(TopCategory), useValue: categories },
        { provide: getRepositoryToken(TopEntry), useValue: entries },
        { provide: getRepositoryToken(Venue), useValue: venues },
      ],
    }).compile();
    service = module.get(TopService);
  });

  it('createCategory: тітул тримиться, position за замовчуванням 0', async () => {
    const c = await service.createCategory({
      title: ' Найкращий для весілля ',
    });
    expect(c.title).toBe('Найкращий для весілля');
    expect(c.position).toBe(0);
  });

  it('addEntry: pending-заклад → 409 «лише схвалені»', async () => {
    categories.findOne.mockResolvedValueOnce({ id: 'c1' });
    venues.findOne.mockResolvedValueOnce({ id: 'v1', status: 'pending' });
    await expect(service.addEntry('c1', { venueId: 'v1' })).rejects.toThrow(
      ConflictException,
    );
    expect(entries.save).not.toHaveBeenCalled();
  });

  it('addEntry: дубль у категорії → 409', async () => {
    categories.findOne.mockResolvedValueOnce({ id: 'c1' });
    entries.findOne.mockResolvedValueOnce({ id: 'e1' });
    await expect(service.addEntry('c1', { venueId: 'v1' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('removeEntry: неіснуючий запис → 404', async () => {
    entries.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.removeEntry('c1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteCategory: неіснуюча → 404', async () => {
    categories.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.deleteCategory('nope')).rejects.toThrow(
      NotFoundException,
    );
  });
});
