import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NewsCategory {
  General = 'general',
  Promo = 'promo',
  Event = 'event',
}

export enum NewsStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

@Entity('news')
@Index(['category', 'publishedAt'])
export class News {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) venueId: string | null;
  @Column({ type: 'varchar', length: 16 }) category: NewsCategory;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'text', nullable: true }) imageUrl: string | null;
  @Column({
    type: 'varchar',
    length: 16,
    default: NewsStatus.Published,
  })
  status: NewsStatus;
  @Column({ type: 'boolean', default: false }) isPromoted: boolean;
  @Column({ type: 'date', nullable: true }) promotedUntil: string | null;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
