import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid') userId: string;
  @Column({ type: 'varchar', length: 64 }) firstname: string;
  @Column({ type: 'varchar', length: 64 }) lastname: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) phone: string | null;
  @Column({ type: 'integer', nullable: true }) age: number | null;
  @Column({ type: 'text', nullable: true }) avatarUrl: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
