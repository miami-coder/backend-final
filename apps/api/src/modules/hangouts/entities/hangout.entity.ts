import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Venue } from '../../venues/entities/venue.entity';
import { User } from '../../users/entities/user.entity';
import { HangoutParticipant } from './hangout-participant.entity';

export enum HangoutGender {
  Male = 'male',
  Female = 'female',
  Any = 'any',
}

export enum HangoutPayer {
  Me = 'me',
  Split = 'split',
  Them = 'them',
}

export enum HangoutStatus {
  Open = 'open',
  Filled = 'filled',
  Cancelled = 'cancelled',
  Completed = 'completed',
}

@Entity('hangouts')
@Index(['venueId', 'date', 'status'])
export class Hangout {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') creatorId: string;
  @Column('uuid') venueId: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'varchar', length: 5 }) time: string;
  @Column({ type: 'varchar', length: 500 }) purpose: string;
  @Column({
    type: 'varchar',
    length: 16,
    default: HangoutGender.Any,
  })
  gender: HangoutGender;
  @Column({ type: 'smallint' }) groupSize: number;
  @Column({
    type: 'varchar',
    length: 16,
    default: HangoutPayer.Split,
  })
  payer: HangoutPayer;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  desiredBudget: number | null;
  @Column({
    type: 'varchar',
    length: 16,
    default: HangoutStatus.Open,
  })
  status: HangoutStatus;
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @OneToMany(() => HangoutParticipant, (p) => p.hangout)
  participants: HangoutParticipant[];
}
