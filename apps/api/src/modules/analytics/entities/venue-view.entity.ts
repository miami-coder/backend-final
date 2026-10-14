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

@Entity('venue_views')
@Index(['venueId', 'viewedAt'])
export class VenueView {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') venueId: string;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;
  @CreateDateColumn() viewedAt: Date;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
}
