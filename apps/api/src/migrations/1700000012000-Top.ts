import { MigrationInterface, QueryRunner } from 'typeorm';

/** Розділ «Топ»: список закладів, який
 *  редагує супер-адмін, обʼєднаних у топ-категорії («Найкращий заклад
 *  для весілля» тощо). «Рекомендації критика» — інша функція. */
export class Top1700000012000 implements MigrationInterface {
  name = 'Top1700000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "top_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(120) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_top_categories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "top_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "categoryId" uuid NOT NULL REFERENCES "top_categories"("id") ON DELETE CASCADE,
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "position" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_top_entries" PRIMARY KEY ("id"),
        CONSTRAINT "uq_top_entries_category_venue" UNIQUE ("categoryId", "venueId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_top_entries_category" ON "top_entries"("categoryId","position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "top_entries" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "top_categories" CASCADE`);
  }
}