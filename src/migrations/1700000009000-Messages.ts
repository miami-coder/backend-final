import { MigrationInterface, QueryRunner } from 'typeorm';

export class Messages1700000009000 implements MigrationInterface {
  name = 'Messages1700000009000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "senderId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "recipientId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "venueId" uuid REFERENCES "venues"("id") ON DELETE CASCADE,
        "kind" varchar(32) NOT NULL,
        "body" text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_messages_recipient_read" ON "messages"("recipientId","isRead")`,
    );
    await q.query(
      `CREATE INDEX "idx_messages_venue_kind" ON "messages"("venueId","kind")`,
    );
    await q.query(`CREATE INDEX "idx_messages_kind" ON "messages"("kind")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "messages" CASCADE`);
  }
}