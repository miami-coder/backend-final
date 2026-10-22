import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TopService } from './top.service';
import { TopCategory } from './top-category.entity';
import { TopEntry } from './top-entry.entity';
import { Venue } from '../venues/entities/venue.entity';

describe('TopService (фіча «Топ закладів»)', () => {
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

  it('reorderEntries: новий порядок — position = індекс у списку', async () => {
    categories.findOne.mockResolvedValueOnce({ id: 'c1' });
    entries.find.mockResolvedValueOnce([
      { id: 'e2', position: 1 },
      { id: 'e1', position: 0 },
    ]);
    await service.reorderEntries('c1', ['e1', 'e2']);
    // зберігаються ТІ САМІ обʼєкти записів (не нові) з новими позиціями
    expect(entries.save).toHaveBeenCalledTimes(1);
    const saved = entries.save.mock.calls[0][0];
    expect(saved.find((e: { id: string }) => e.id === 'e1').position).toBe(0);
    expect(saved.find((e: { id: string }) => e.id === 'e2').position).toBe(1);
  });

  it('listAdmin: категорії і записи — сортування position → createdAt (при однакових position порядок стабільний, не «тасується»)', async () => {
    const late = new Date('2026-10-22T10:00:00Z');
    const early = new Date('2026-10-21T10:00:00Z');
    categories.find.mockResolvedValueOnce([
      // position однакові — порядок визначає createdAt (раніше створена — вище);
      // сірниковий вхід навмисно «перекинутий»
      { id: 'c2', position: 0, createdAt: late, entries: [] },
      { id: 'c1', position: 0, createdAt: early, entries: [] },
      { id: 'c3', position: 5, createdAt: early, entries: [] },
    ]);
    const res = await service.listAdmin();
    expect(res.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('listAdmin: записи всередині категорії теж сортовані position → createdAt', async () => {
    const late = new Date('2026-10-22T10:00:00Z');
    const early = new Date('2026-10-21T10:00:00Z');
    categories.find.mockResolvedValueOnce([
      {
        id: 'c1',
        position: 0,
        createdAt: early,
        entries: [
          { id: 'e2', position: 0, createdAt: late, venue: { id: 'v2', name: 'B' } },
          { id: 'e1', position: 0, createdAt: early, venue: { id: 'v1', name: 'A' } },
          { id: 'e3', position: 1, createdAt: late, venue: { id: 'v3', name: 'C' } },
        ],
      },
    ]);
    const res = await service.listAdmin();
    expect(res[0].entries.map((e: { id: string }) => e.id)).toEqual([
      'e1',
      'e2',
      'e3',
    ]);
  });

  it('listPublic: записи з однаковим position — стабільний порядок за createdAt', async () => {
    categories.find.mockResolvedValueOnce([
      { id: 'c1', title: 'Т', position: 0 },
    ]);
    const late = new Date('2026-10-22T10:00:00Z');
    const early = new Date('2026-10-21T10:00:00Z');
    entries.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'r2',
          categoryId: 'c1',
          position: 0,
          createdAt: late,
          venue: { id: 'v2', name: 'B', mainPhotoUrl: null, ratingAvg: null },
        },
        {
          id: 'r1',
          categoryId: 'c1',
          position: 0,
          createdAt: early,
          venue: { id: 'v1', name: 'A', mainPhotoUrl: null, ratingAvg: null },
        },
      ]),
    });
    const res = await service.listPublic();
    expect(res[0].venues.map((v) => v.name)).toEqual(['A', 'B']);
  });

  it('reorderCategories: новий порядок — position = індекс у списку', async () => {
    categories.find.mockResolvedValueOnce([
      { id: 'c2', position: 1, createdAt: new Date() },
      { id: 'c1', position: 0, createdAt: new Date() },
    ]);
    await service.reorderCategories(['c1', 'c2']);
    expect(categories.save).toHaveBeenCalledTimes(1);
    const saved = categories.save.mock.calls[0][0];
    expect(saved.find((c: { id: string }) => c.id === 'c1').position).toBe(0);
    expect(saved.find((c: { id: string }) => c.id === 'c2').position).toBe(1);
  });

  it('reorderCategories: список не відповідає категоріям → 400 (нічого не зберігається)', async () => {
    categories.find.mockResolvedValue([{ id: 'c1', position: 0 }]);
    await expect(
      service.reorderCategories(['c1', 'c-hack']),
    ).rejects.toThrow(BadRequestException);
    expect(categories.save).not.toHaveBeenCalled();
    await expect(service.reorderCategories([])).rejects.toThrow(
      BadRequestException,
    );
    expect(categories.save).not.toHaveBeenCalled();
  });

  it('reorderEntries: неіснуюча категорія → 404', async () => {
    categories.findOne.mockResolvedValueOnce(null);
    await expect(
      service.reorderEntries('nope', ['e1']),
    ).rejects.toThrow(NotFoundException);
  });

  it('reorderEntries: список не відповідає записам категорії → 400 (нічого не зберігається)', async () => {
    categories.findOne.mockResolvedValue({ id: 'c1' });
    entries.find.mockResolvedValue([{ id: 'e1', position: 0 }]);
    // чужий/зайвий айді — не зберігаєм
    await expect(
      service.reorderEntries('c1', ['e1', 'e-hack']),
    ).rejects.toThrow(BadRequestException);
    expect(entries.save).not.toHaveBeenCalled();
    // пропущений запис — теж
    await expect(
      service.reorderEntries('c1', []),
    ).rejects.toThrow(BadRequestException);
    expect(entries.save).not.toHaveBeenCalled();
  });

  it('deleteCategory: неіснуюча → 404', async () => {
    categories.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.deleteCategory('nope')).rejects.toThrow(
      NotFoundException,
    );
  });
});
