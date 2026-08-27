import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Venue } from '../venues/entities/venue.entity';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

interface FavoriteVenueRow {
  v_id: string | null;
  v_name: string | null;
  v_address: string | null;
  v_ratingAvg: string | null;
  v_mainPhotoUrl: string | null;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favorites: Repository<Favorite>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
  ) {}

  async add(userId: string, venueId: string): Promise<void> {
    await this.assertVenue(venueId);
    const existing = await this.favorites.findOne({
      where: { userId, venueId },
    });
    if (existing) return;
    await this.favorites.save({ userId, venueId });
  }

  async remove(userId: string, venueId: string): Promise<void> {
    await this.favorites.delete({ userId, venueId });
  }

  async list(userId: string, page = 1, limit = 20) {
    const { offset } = normalizePagination({ page, limit });
    const { raw } = await this.favorites
      .createQueryBuilder('f')
      .innerJoinAndSelect('venues', 'v', 'v.id = f."venueId"')
      .where('f."userId" = :userId', { userId })
      .orderBy('f."createdAt"', 'DESC')
      .skip(offset)
      .take(limit)
      .getRawAndEntities();
    const total = await this.favorites.count({ where: { userId } });
    const rows = raw as FavoriteVenueRow[];
    return {
      data: rows
        .filter((d) => d.v_id)
        .map((d) => ({
          id: d.v_id,
          name: d.v_name,
          address: d.v_address,
          ratingAvg: d.v_ratingAvg,
          mainPhotoUrl: d.v_mainPhotoUrl,
        })),
      meta: buildMeta({ page, limit, offset }, total),
    };
  }

  private async assertVenue(venueId: string) {
    const v = await this.venues.findOne({ where: { id: venueId } });
    if (!v) throw new NotFoundException('Заклад не знайдено');
  }
}
