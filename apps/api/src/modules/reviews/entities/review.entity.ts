import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from '../../venues/entities/venue.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reviews')
@Unique(['venueId', 'userId'])
@Index(['venueId', 'createdAt'])
export class Review {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') venueId: string;
  @Column('uuid') userId: string;
  @Column({ type: 'smallint' }) rating: number;
  @Column({ type: 'text' }) text: string;
  @Column({ type: 'text', nullable: true }) checkPhotoUrl: string | null;
  @Column({ type: 'boolean', default: false }) isFeatured: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
