import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reviews1700000002000 implements MigrationInterface {
  name = 'Reviews1700000002000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
        "text" text NOT NULL,
        "checkPhotoUrl" text,
        "isFeatured" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE("venueId","userId")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_reviews_venue_created" ON "reviews"("venueId","createdAt" DESC)`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "reviews" CASCADE`);
  }
}
