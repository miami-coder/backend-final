import { MigrationInterface, QueryRunner } from 'typeorm';

export class Admin1700000008000 implements MigrationInterface {
  name = 'Admin1700000008000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN "deletedAt" timestamptz NULL`,
    );
    await q.query(`CREATE INDEX "idx_users_deletedAt" ON "users"("deletedAt")`);
    await q.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actorId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" varchar(64) NOT NULL,
        "entityType" varchar(64) NOT NULL,
        "entityId" varchar(64),
        "before" jsonb,
        "after" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_audit_logs_actor_created" ON "audit_logs"("actorId","createdAt" DESC)`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entityType","entityId")`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await q.query(`DROP INDEX IF EXISTS "idx_users_deletedAt"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletedAt"`);
  }
}
