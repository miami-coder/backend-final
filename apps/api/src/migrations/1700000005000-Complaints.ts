import { MigrationInterface, QueryRunner } from 'typeorm';

export class Complaints1700000005000 implements MigrationInterface {
  name = 'Complaints1700000005000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "complaints" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid REFERENCES "venues"("id") ON DELETE CASCADE,
        "reviewId" uuid REFERENCES "reviews"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reason" varchar(16) NOT NULL,
        "text" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'new',
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "resolvedAt" timestamptz,
        "resolvedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX "idx_complaints_status_created" ON "complaints"("status","createdAt")`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "complaints" CASCADE`);
  }
}
