import { ApiHideProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from './profile.entity';
import { UserRole } from '../../rbac/entities/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'citext' }) email: string;
  @ApiHideProperty()
  @Column({ type: 'text', nullable: true })
  passwordHash: string | null;
  @Column({ type: 'boolean', default: false }) emailVerified: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Profile;

  // Ролі користувача (циклічний імпорт для TypeORM безпечний)
  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles: UserRole[];
}
