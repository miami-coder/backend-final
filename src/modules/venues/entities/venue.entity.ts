import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VenuePhoto } from './venue-photo.entity';
import { VenueFeatureAssignment } from './venue-feature-assignment.entity';
import { VenueTag } from './venue-tag.entity';
import { VenueTypeAssignment } from './venue-type-assignment.entity';

export enum VenueStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Archived = 'archived',
}

@Entity('venues')
@Index(['status'])
export class Venue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') ownerId: string;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text' }) address: string;
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: number | null;
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: number | null;
  @Column({ type: 'jsonb', default: {} }) contacts: {
    phone?: string;
    instagram?: string;
    facebook?: string;
    website?: string;
  };
  @Column({ type: 'jsonb', default: {} }) workingHours: Record<string, string>;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  averageCheck: number | null;
  @Column({ type: 'text', nullable: true }) mainPhotoUrl: string | null;
  @Column({ type: 'varchar', length: 16, default: VenueStatus.Pending })
  status: VenueStatus;
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  ratingAvg: number;
  @Column({ type: 'integer', default: 0 }) ratingCount: number;
  @Column({ type: 'integer', default: 0 }) viewCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => VenuePhoto, (photo) => photo.venue)
  photos: VenuePhoto[];

  @OneToMany(() => VenueFeatureAssignment, (fa) => fa.venue)
  featureAssignments: VenueFeatureAssignment[];

  @OneToMany(() => VenueTag, (vt) => vt.venue)
  venueTags: VenueTag[];

  @OneToMany(() => VenueTypeAssignment, (vta) => vta.venue)
  venueTypeAssignments: VenueTypeAssignment[];
}
