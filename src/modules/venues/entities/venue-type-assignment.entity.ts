import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { VenueType } from './venue-type.entity';

@Entity('venue_type_assignments')
export class VenueTypeAssignment {
  @PrimaryColumn('uuid') venueId: string;
  @PrimaryColumn('uuid') typeId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
  @ManyToOne(() => VenueType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'typeId' })
  type: VenueType;
}
