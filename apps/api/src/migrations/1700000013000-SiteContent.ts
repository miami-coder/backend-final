import { MigrationInterface, QueryRunner } from 'typeorm';

/** Супер-адмін має редагувати загальні тексти
 *  («Про нас», контакти). Зберігаємо у key/value. */
export class SiteContent1700000013000 implements MigrationInterface {
  name = 'SiteContent1700000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content" (
        "key" varchar(64) NOT NULL,
        "value" text NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_site_content" PRIMARY KEY ("key")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "site_content"("key","value") VALUES
        ('about', 'Пиячок — український каталог барів, пабів і гастропабів Хмельницького з відгуками від відвідувачів, спільнотними зустрічами «пиячок» і добірками «Топ» від редакції.'),
        ('contacts', 'Хмельницький, Україна. Email: hello@piyachok.ua')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content"`);
  }
}