import { MigrationInterface, QueryRunner } from 'typeorm';

export class News1700000004000 implements MigrationInterface {
  name = 'News1700000004000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "news" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid REFERENCES "venues"("id") ON DELETE CASCADE,
        "category" varchar(16) NOT NULL,
        "title" varchar(200) NOT NULL,
        "content" text NOT NULL,
        "imageUrl" text,
        "status" varchar(16) NOT NULL DEFAULT 'published',
        "isPromoted" boolean NOT NULL DEFAULT false,
        "promotedUntil" date,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_news_category_publishedAt" ON "news"("category","publishedAt" DESC)`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "news" CASCADE`);
  }
}
