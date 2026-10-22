import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';
import { SiteContent } from './site-content.entity';

describe('ContentService (загальні тексти)', () => {
  let service: ContentService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([
        { key: 'about', value: ['Стара правда'] },
        { key: 'contacts', value: null },
      ]),
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    const module = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: getRepositoryToken(SiteContent), useValue: repo },
      ],
    }).compile();
    service = module.get(ContentService);
  });

  it('getAll: усі дозволені ключі, навіть без рядка у БД', async () => {
    const map = await service.getAll();
    expect(Object.keys(map).sort()).toEqual(['about', 'contacts']);
  });

  it('update: зберігає нове значення', async () => {
    repo.findOne.mockResolvedValueOnce({ key: 'about', value: ['Старе'] });
    const res = await service.update('about', [' Новий текст ']);
    expect(res.value).toEqual([' Новий текст ']);
  });

  it('update: невідомий ключ → 404', async () => {
    await expect(service.update('hacker', ['x'])).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
