import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VenueView } from './entities/venue-view.entity';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { CacheService } from '../../common/services/cache.service';

const VIEW_DEDUP_TTL = 1800; // 30 хвилин

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(VenueView)
    private readonly views: Repository<VenueView>,
    @InjectRepository(AnalyticsEvent)
    private readonly eventsRepo: Repository<AnalyticsEvent>,
    private readonly cache: CacheService,
  ) {}

  async recordView(
    venueId: string,
    userId?: string | null,
    sessionId?: string | null,
  ): Promise<{ recorded: boolean }> {
    const identity = userId ?? sessionId;
    if (identity) {
      const dedupKey = `view:dedup:${identity}:${venueId}`;
      const seen = await this.cache.get<string>(dedupKey);
      if (seen) return { recorded: false };
      await this.cache.set(dedupKey, '1', VIEW_DEDUP_TTL);
    }
    await this.views.save({
      venueId,
      userId: userId ?? null,
      sessionId: sessionId ?? null,
    });
    return { recorded: true };
  }

  async recordEvent(
    venueId: string | null,
    userId: string | null,
    eventType: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    await this.eventsRepo.save({ venueId, userId, eventType, payload });
  }

  async getForVenue(
    venueId: string,
    from?: string,
    to?: string,
  ): Promise<{
    totalViews: number;
    viewsByDay: { date: string; count: number }[];
    eventsByType: { eventType: string; count: number }[];
  }> {
    const viewsQb = this.views
      .createQueryBuilder('v')
      .select(`to_char(date_trunc('day', v."viewedAt"), 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)::int', 'count')
      .where('v."venueId" = :venueId', { venueId })
      .groupBy('date')
      .orderBy('date', 'ASC');
    if (from) viewsQb.andWhere('v."viewedAt" >= :from', { from });
    if (to) viewsQb.andWhere('v."viewedAt" <= :to', { to });
    const viewsByDay = await viewsQb.getRawMany<{
      date: string;
      count: number;
    }>();

    const eventsQb = this.eventsRepo
      .createQueryBuilder('e')
      .select('e."eventType"', 'eventType')
      .addSelect('COUNT(*)::int', 'count')
      .where('e."venueId" = :venueId', { venueId })
      .groupBy('e."eventType"')
      .orderBy('count', 'DESC');
    if (from) eventsQb.andWhere('e."occurredAt" >= :from', { from });
    if (to) eventsQb.andWhere('e."occurredAt" <= :to', { to });
    const eventsByType = await eventsQb.getRawMany<{
      eventType: string;
      count: number;
    }>();

    const totalViews = await this.views.count({ where: { venueId } });
    return { totalViews, viewsByDay, eventsByType };
  }

  async getOverview(): Promise<{
    totalViews: number;
    totalEvents: number;
    eventsByType: { eventType: string; count: number }[];
  }> {
    const totalViews = await this.views.count();
    const totalEvents = await this.eventsRepo.count();
    const eventsByType = await this.eventsRepo
      .createQueryBuilder('e')
      .select('e."eventType"', 'eventType')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('e."eventType"')
      .orderBy('count', 'DESC')
      .getRawMany<{ eventType: string; count: number }>();
    return { totalViews, totalEvents, eventsByType };
  }
}
