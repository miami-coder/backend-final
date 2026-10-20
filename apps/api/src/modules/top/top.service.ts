import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TopCategory } from './top-category.entity';
import { TopEntry } from './top-entry.entity';
import { Venue, VenueStatus } from '../venues/entities/venue.entity';

export interface CreateTopCategoryDto {
  title: string;
  position?: number;
}

export interface CreateTopEntryDto {
  venueId: string;
  position?: number;
}

@Injectable()
export class TopService {
  constructor(
    @InjectRepository(TopCategory)
    private readonly categories: Repository<TopCategory>,
    @InjectRepository(TopEntry)
    private readonly entries: Repository<TopEntry>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
  ) {}

  /** Публічний Топ: категорії за позицією, усередині — заклади за позицією. */
  async listPublic(): Promise<
    { id: string; title: string; venues: { id: string; name: string; mainPhotoUrl: string | null; ratingAvg: number | null }[] }[]
  > {
    const cats = await this.categories.find({ order: { position: 'ASC' } });
    if (cats.length === 0) return [];
    const rows = await this.entries
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.venue', 'v')
      .where('e.categoryId IN (:...ids)', { ids: cats.map((c) => c.id) })
      .orderBy('e.position', 'ASC')
      .getMany();
    return cats.map((c) => ({
      id: c.id,
      title: c.title,
      venues: rows
        .filter((e) => e.categoryId === c.id)
        .map((e) => ({
          id: e.venue.id,
          name: e.venue.name,
          mainPhotoUrl: e.venue.mainPhotoUrl ?? null,
          ratingAvg: e.venue.ratingAvg,
        })),
    }));
  }

  /** Адмін-список: повний, з усіма полями редагування. */
  listAdmin(): Promise<TopCategory[]> {
    return this.categories.find({
      relations: { entries: { venue: true } },
      order: { position: 'ASC' },
    });
  }

  async createCategory(dto: CreateTopCategoryDto): Promise<TopCategory> {
    const cat = this.categories.create({
      title: dto.title.trim(),
      position: dto.position ?? 0,
    });
    return this.categories.save(cat);
  }

  async updateCategory(
    id: string,
    dto: Partial<CreateTopCategoryDto>,
  ): Promise<TopCategory> {
    const cat = await this.categories.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Категорію не знайдено');
    if (dto.title !== undefined) cat.title = dto.title.trim();
    if (dto.position !== undefined) cat.position = dto.position;
    return this.categories.save(cat);
  }

  async deleteCategory(id: string): Promise<void> {
    const res = await this.categories.delete(id);
    if (!res.affected) throw new NotFoundException('Категорію не знайдено');
  }

  async addEntry(
    categoryId: string,
    dto: CreateTopEntryDto,
  ): Promise<TopEntry> {
    const cat = await this.categories.findOne({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Категорію не знайдено');
    const venue = await this.venues.findOne({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    if (venue.status !== VenueStatus.Approved)
      throw new ConflictException('У Топ можна додавати лише схвалені заклади');
    const dupe = await this.entries.findOne({
      where: { categoryId, venueId: dto.venueId },
    });
    if (dupe)
      throw new ConflictException('Заклад уже в цій категорії Топу');
    const entry = this.entries.create({
      categoryId,
      venueId: dto.venueId,
      position: dto.position ?? 0,
    });
    return this.entries.save(entry);
  }

  async removeEntry(categoryId: string, entryId: string): Promise<void> {
    const res = await this.entries.delete({
      id: entryId,
      categoryId,
    });
    if (!res.affected) throw new NotFoundException('Запис Топу не знайдено');
  }

  /** Категорії, у яких складено заклад — щоб адмінка показувала "де він у Топі". */
  async categoriesOfVenue(venueId: string): Promise<TopCategory[]> {
    const rows = await this.entries.find({ where: { venueId } });
    if (rows.length === 0) return [];
    const cats = await this.categories.find({
      where: { id: In(rows.map((r) => r.categoryId)) },
    });
    return cats;
  }
}