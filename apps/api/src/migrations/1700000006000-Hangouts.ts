import { MigrationInterface, QueryRunner } from 'typeorm';

export class Hangouts1700000006000 implements MigrationInterface {
  name = 'Hangouts1700000006000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "hangouts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "creatorId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "time" varchar(5) NOT NULL,
        "purpose" varchar(500) NOT NULL,
        "gender" varchar(16) NOT NULL DEFAULT 'any',
        "groupSize" smallint NOT NULL CHECK ("groupSize" BETWEEN 1 AND 20),
        "payer" varchar(16) NOT NULL DEFAULT 'split',
        "desiredBudget" numeric(10,2),
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "createdAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_hangouts_venue_date_status" ON "hangouts"("venueId","date","status")`,
    );
    await q.query(`
      CREATE TABLE "hangout_participants" (
        "hangoutId" uuid NOT NULL REFERENCES "hangouts"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "joinedAt" timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("hangoutId","userId")
      )
    `);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hangout_participants" CASCADE`);
    await q.query(`DROP TABLE IF EXISTS "hangouts" CASCADE`);
  }
}
