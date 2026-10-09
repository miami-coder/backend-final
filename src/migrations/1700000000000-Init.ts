import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" citext NOT NULL UNIQUE,
        "passwordHash" text,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "userId" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "firstname" varchar(64) NOT NULL,
        "lastname" varchar(64) NOT NULL,
        "phone" varchar(32),
        "age" integer,
        "avatarUrl" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "oauth_accounts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" varchar(32) NOT NULL,
        "providerUserId" varchar(255) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE("provider", "providerUserId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_oauth_userId" ON "oauth_accounts" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(32) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "description" text,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL UNIQUE,
        "description" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permissionId" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        "grantedAt" timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("roleId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "assignedAt" timestamptz NOT NULL DEFAULT NOW(),
        "assignedBy" uuid,
        PRIMARY KEY ("userId", "roleId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_roles_userId" ON "user_roles" ("userId")`,
    );

    // Сід: 4 ролі
    const userRoleId = (
      await queryRunner.query(
        `INSERT INTO "roles"("code","name","description") VALUES ('user','Користувач','Базовий акаунт') RETURNING "id"`,
      )
    )[0].id;
    const venueAdminId = (
      await queryRunner.query(
        `INSERT INTO "roles"("code","name","description") VALUES ('venue_admin','Адмін закладу','Представник закладу') RETURNING "id"`,
      )
    )[0].id;
    const superAdminId = (
      await queryRunner.query(
        `INSERT INTO "roles"("code","name","description") VALUES ('super_admin','Супер-адмін','Повний доступ') RETURNING "id"`,
      )
    )[0].id;
    const criticId = (
      await queryRunner.query(
        `INSERT INTO "roles"("code","name","description") VALUES ('critic','Критик','Позначений критик') RETURNING "id"`,
      )
    )[0].id;

    // Сід: 15 дозволів
    const permCodes = [
      'venue:create',
      'venue:edit:own',
      'venue:edit:any',
      'venue:moderate',
      'review:create',
      'review:edit:own',
      'review:edit:any',
      'review:feature',
      'hangout:create',
      'news:manage:own',
      'news:manage:any',
      'complaint:manage',
      'user:manage',
      'analytics:view:own',
      'analytics:view:all',
    ];
    const permIds: Record<string, string> = {};
    for (const code of permCodes) {
      const r = await queryRunner.query(
        `INSERT INTO "permissions"("code") VALUES ($1) RETURNING "id"`,
        [code],
      );
      permIds[code] = r[0].id;
    }

    // Мапа ролі -> дозволи
    const userPerms = [
      'venue:create',
      'review:create',
      'review:edit:own',
      'hangout:create',
      'news:manage:own',
    ];
    const venueAdminPerms = [
      ...userPerms,
      'venue:edit:own',
      'analytics:view:own',
    ];
    const superAdminPerms = permCodes;
    const criticPerms = [...userPerms, 'review:feature'];

    for (const p of userPerms) {
      await queryRunner.query(
        `INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`,
        [userRoleId, permIds[p]],
      );
    }
    for (const p of venueAdminPerms) {
      await queryRunner.query(
        `INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`,
        [venueAdminId, permIds[p]],
      );
    }
    for (const p of superAdminPerms) {
      await queryRunner.query(
        `INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`,
        [superAdminId, permIds[p]],
      );
    }
    for (const p of criticPerms) {
      await queryRunner.query(
        `INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`,
        [criticId, permIds[p]],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_accounts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}
