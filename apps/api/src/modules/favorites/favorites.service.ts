import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Venue } from '../venues/entities/venue.entity';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

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
    const [favs, total] = await this.favorites.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    const venueIds = favs.map((f) => f.venueId);
    if (venueIds.length === 0) {
      return { data: [], meta: buildMeta({ page, limit, offset }, total) };
    }
    const venues = await this.venues.find({
      where: { id: In(venueIds) },
    });
    const byId = new Map(venues.map((v) => [v.id, v]));
    const data = favs
      .map((f) => {
        const v = byId.get(f.venueId);
        if (!v) return null;
        return {
          id: v.id,
          name: v.name,
          address: v.address,
          ratingAvg: v.ratingAvg,
          mainPhotoUrl: v.mainPhotoUrl,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  private async assertVenue(venueId: string) {
    const v = await this.venues.findOne({ where: { id: venueId } });
    if (!v) throw new NotFoundException('Заклад не знайдено');
  }
}
