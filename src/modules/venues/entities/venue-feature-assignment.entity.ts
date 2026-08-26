import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { VenueFeature } from './venue-feature.entity';

@Entity('venue_feature_assignments')
export class VenueFeatureAssignment {
  @PrimaryColumn('uuid') venueId: string;
  @PrimaryColumn('uuid') featureId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @ManyToOne(() => VenueFeature, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'featureId' }) feature: VenueFeature;
}