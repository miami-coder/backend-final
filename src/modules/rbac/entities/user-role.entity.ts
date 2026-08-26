import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
@Index(['userId'])
export class UserRole {
  @PrimaryColumn('uuid') userId: string;
  @PrimaryColumn('uuid') roleId: string;
  @CreateDateColumn() assignedAt: Date;
  @Column({ type: 'uuid', nullable: true }) assignedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Role, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'roleId' }) role: Role;
}
