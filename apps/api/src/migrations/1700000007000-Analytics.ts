import { MigrationInterface, QueryRunner } from 'typeorm';

export class Analytics1700000007000 implements MigrationInterface {
  name = 'Analytics1700000007000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "venue_views" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "sessionId" varchar(64),
        "viewedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_venue_views_venue_viewed" ON "venue_views"("venueId","viewedAt" DESC)`,
    );
    await q.query(`
      CREATE TABLE "analytics_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid REFERENCES "venues"("id") ON DELETE CASCADE,
        "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "eventType" varchar(64) NOT NULL,
        "payload" jsonb,
        "occurredAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_analytics_events_venue_occurred" ON "analytics_events"("venueId","occurredAt" DESC)`,
    );
    await q.query(
      `CREATE INDEX "idx_analytics_events_type" ON "analytics_events"("eventType")`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "analytics_events" CASCADE`);
    await q.query(`DROP TABLE IF EXISTS "venue_views" CASCADE`);
  }
}
