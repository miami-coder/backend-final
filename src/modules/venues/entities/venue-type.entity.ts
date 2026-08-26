import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('venue_types')
export class VenueType {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) slug: string;
}
