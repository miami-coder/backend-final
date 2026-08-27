import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Venue } from './venue.entity';

@Entity('venue_photos')
export class VenuePhoto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') venueId: string;
  @Column({ type: 'text' }) url: string;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
}
