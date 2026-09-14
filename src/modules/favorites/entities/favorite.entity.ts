import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('favorites')
export class Favorite {
  @PrimaryColumn('uuid') userId: string;
  @PrimaryColumn('uuid') venueId: string;
  @CreateDateColumn() createdAt: Date;
}
