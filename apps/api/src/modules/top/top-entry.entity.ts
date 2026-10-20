import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TopCategory } from './top-category.entity';
import { Venue } from '../venues/entities/venue.entity';

/** Запис Топу: заклад у категорії з позицією (редагує супер-адмін). */
@Entity('top_entries')
@Unique('uq_top_entries_category_venue', ['categoryId', 'venueId'])
export class TopEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') categoryId: string;
  @Column('uuid') venueId: string;
  @Column({ type: 'integer', default: 0 }) position: number;
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => TopCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: TopCategory;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
}
