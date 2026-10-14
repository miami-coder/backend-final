import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
@Index(['actorId', 'createdAt'])
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) actorId: string | null;
  @Column({ type: 'varchar', length: 64 }) action: string;
  @Column({ type: 'varchar', length: 64 }) entityType: string;
  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId: string | null;
  @Column({ type: 'jsonb', nullable: true })
  before: object | null;
  @Column({ type: 'jsonb', nullable: true })
  after: object | null;
  @CreateDateColumn() createdAt: Date;
}
