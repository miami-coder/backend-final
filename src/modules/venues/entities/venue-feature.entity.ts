import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('venue_features')
export class VenueFeature {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) icon: string | null;
}
