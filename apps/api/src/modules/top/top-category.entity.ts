import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TopEntry } from './top-entry.entity';

/** Категорія Топу («Найкращий заклад для весілля»), ревʼю викладача. */
@Entity('top_categories')
export class TopCategory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 120 }) title: string;
  @Column({ type: 'integer', default: 0 }) position: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToMany(() => TopEntry, (e) => e.category)
  entries: TopEntry[];
}