import {
  Column,
  Entity,
  UpdateDateColumn,
} from 'typeorm';

/** Редакційні тексти сайту («Про нас», контакти): key/value, змінює
 *  супер-адмін («Про нас», контакти — правка в адмінці). */
@Entity('site_content')
export class SiteContent {
  @Column({ type: 'varchar', length: 64, primary: true })
  key: string;
  @Column({ type: 'text', nullable: true }) value: string | null;
  @UpdateDateColumn() updatedAt: Date;
}