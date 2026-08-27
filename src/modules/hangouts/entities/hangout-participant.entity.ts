import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Hangout } from './hangout.entity';
import { User } from '../../users/entities/user.entity';

@Entity('hangout_participants')
export class HangoutParticipant {
  @PrimaryColumn('uuid') hangoutId: string;
  @PrimaryColumn('uuid') userId: string;
  @CreateDateColumn() joinedAt: Date;

  @ManyToOne(() => Hangout, (h) => h.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hangoutId' })
  hangout: Hangout;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
