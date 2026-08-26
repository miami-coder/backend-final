import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
}
