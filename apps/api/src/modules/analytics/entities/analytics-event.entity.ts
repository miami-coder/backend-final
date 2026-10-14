import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Venue } from '../../venues/entities/venue.entity';

@Entity('analytics_events')
@Index(['venueId', 'occurredAt'])
@Index(['eventType'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) venueId: string | null;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', length: 64 }) eventType: string;
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;
  @CreateDateColumn() occurredAt: Date;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
}
