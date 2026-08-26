import { MigrationInterface, QueryRunner } from 'typeorm';

export class Venues1700000001000 implements MigrationInterface {
  name = 'Venues1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "venues" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(200) NOT NULL,
        "description" text,
        "address" text NOT NULL,
        "latitude" decimal(9,6),
        "longitude" decimal(9,6),
        "contacts" jsonb NOT NULL DEFAULT '{}',
        "workingHours" jsonb NOT NULL DEFAULT '{}',
        "averageCheck" numeric(10,2),
        "mainPhotoUrl" text,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "ratingAvg" numeric(3,2) NOT NULL DEFAULT 0,
        "ratingCount" integer NOT NULL DEFAULT 0,
        "viewCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_venues_status" ON "venues"("status")`);

    // PostGIS location column populated by trigger
    await queryRunner.query(`ALTER TABLE "venues" ADD COLUMN "location" geography(POINT, 4326)`);
    await queryRunner.query(`CREATE INDEX "idx_venues_location" ON "venues" USING GIST ("location")`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION venues_set_location() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
          NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
        ELSE
          NEW.location := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_venues_location
      BEFORE INSERT OR UPDATE OF latitude, longitude ON "venues"
      FOR EACH ROW EXECUTE FUNCTION venues_set_location();
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_photos" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "url" text NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_features" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "icon" varchar(64)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_feature_assignments" (
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "featureId" uuid NOT NULL REFERENCES "venue_features"("id") ON DELETE CASCADE,
        PRIMARY KEY ("venueId", "featureId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(64) NOT NULL UNIQUE,
        "slug" varchar(64) NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_tags" (
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "tagId" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
        PRIMARY KEY ("venueId", "tagId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_types" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(64) NOT NULL UNIQUE,
        "slug" varchar(64) NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_type_assignments" (
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "typeId" uuid NOT NULL REFERENCES "venue_types"("id") ON DELETE CASCADE,
        PRIMARY KEY ("venueId", "typeId")
      )
    `);

    // Seed features, types
    await queryRunner.query(`
      INSERT INTO "venue_features"("code","name","icon") VALUES
      ('wifi','Wi-Fi','wifi'),
      ('parking','Парковка','parking'),
      ('live_music','Жива музика','music'),
      ('terrace','Тераса','terrace'),
      ('kids','Дитяча кімната','kids'),
      ('vip','VIP-зона','vip')
    `);

    await queryRunner.query(`
      INSERT INTO "venue_types"("name","slug") VALUES
      ('Бар','bar'),
      ('Ресторан','restaurant'),
      ('Кафе','cafe'),
      ('Клуб','club'),
      ('Паб','pub')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_venues_location ON "venues"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS venues_set_location()`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "location"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_type_assignments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_types" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_feature_assignments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_features" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_photos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venues" CASCADE`);
  }
}
