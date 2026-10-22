import { MigrationInterface, QueryRunner } from 'typeorm';

/** У відгуку є сума чека відвідувача (рейтинг, текст і
 *  фото чека вже є, а суми не було). */
export class ReviewBillAmount1700000011000 implements MigrationInterface {
  name = 'ReviewBillAmount1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD IF NOT EXISTS "billAmount" integer NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "reviews"."billAmount" IS 'Сума чека відвідувача, грн (опційно)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "billAmount"`);
  }
}