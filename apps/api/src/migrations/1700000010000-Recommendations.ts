import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Рекомендації критика: 1 критик на заклад, тому зберігаємо прямо на venues —
 * recommendedBy (критик) + recommendedAt. Плюс сід нового дозволу
 * venue:recommend для критика і супер-адміна.
 */
export class Recommendations1700000010000 implements MigrationInterface {
  name = 'Recommendations1700000010000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "venues" ADD COLUMN "recommendedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await q.query(
      `ALTER TABLE "venues" ADD COLUMN "recommendedAt" timestamptz`,
    );

    // Дозвіл venue:recommend (ідемпотентно) + грант критику та супер-адміну
    const perm = (
      await q.query(
        `INSERT INTO "permissions"("code") VALUES ('venue:recommend')
         ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
         RETURNING "id"`,
      )
    )[0].id;
    for (const roleCode of ['critic', 'super_admin']) {
      await q.query(
        `INSERT INTO "role_permissions"("roleId","permissionId")
         SELECT r."id", $2 FROM "roles" r WHERE r."code" = $1
         ON CONFLICT DO NOTHING`,
        [roleCode, perm],
      );
    }
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM "role_permissions"
       WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" = 'venue:recommend')`,
    );
    await q.query(`DELETE FROM "permissions" WHERE "code" = 'venue:recommend'`);
    await q.query(`ALTER TABLE "venues" DROP COLUMN IF EXISTS "recommendedAt"`);
    await q.query(`ALTER TABLE "venues" DROP COLUMN IF EXISTS "recommendedBy"`);
  }
}