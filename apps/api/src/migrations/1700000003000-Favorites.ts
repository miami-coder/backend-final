import { MigrationInterface, QueryRunner } from 'typeorm';
export class Favorites1700000003000 implements MigrationInterface {
  name = 'Favorites1700000003000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "favorites" (
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("userId","venueId")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_favorites_user_created" ON "favorites"("userId","createdAt" DESC)`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "favorites" CASCADE`);
  }
}
