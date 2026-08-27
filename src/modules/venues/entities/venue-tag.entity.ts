import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { Tag } from './tag.entity';

@Entity('venue_tags')
export class VenueTag {
  @PrimaryColumn('uuid') venueId: string;
  @PrimaryColumn('uuid') tagId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag: Tag;
}
