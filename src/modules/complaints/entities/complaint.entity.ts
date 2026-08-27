import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Venue } from '../../venues/entities/venue.entity';
import { Review } from '../../reviews/entities/review.entity';

export enum ComplaintReason {
  FakePromo = 'fake_promo',
  Fraud = 'fraud',
  Other = 'other',
}

export enum ComplaintStatus {
  New = 'new',
  InReview = 'in_review',
  Resolved = 'resolved',
  Rejected = 'rejected',
}

@Entity('complaints')
@Index(['status', 'createdAt'])
export class Complaint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) venueId: string | null;
  @Column({ type: 'uuid', nullable: true }) reviewId: string | null;
  @Column('uuid') userId: string;
  @Column({ type: 'varchar', length: 16 }) reason: ComplaintReason;
  @Column({ type: 'text' }) text: string;
  @Column({
    type: 'varchar',
    length: 16,
    default: ComplaintStatus.New,
  })
  status: ComplaintStatus;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) resolvedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
  @ManyToOne(() => Venue, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
  @ManyToOne(() => Review, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'reviewId' })
  review: Review;
}
