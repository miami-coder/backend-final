// Сід демо-даних «Пиячок» для локального запуску при здачі проєкту:
// docker compose вгору → pnpm seed:demo → каталог заповнений 15 закладами.
//
// Створює одним прогоном:
//   1) 3 демо-юзери (user1/user2/user3@gmail.com, спільний пароль User1234);
//   2) теги-довідник (у міграціях його немає — див. seed-demo-data.ts);
//   3) 15 закладів одразу у статусі approved з повною інфою
//      (опис, адреса, координати, контакти, графік, тип/фічі/теги);
//   4) до 4-5 webp-фото кожний: файли з seed-assets/venues/venue-NN копіюються
//      в uploads/venues/<venueId>/ (локальний режим FileStorageService),
//      у БД пишуться VenuePhoto з URL /static/venues/<venueId>/photo-K.webp.
//
// Ідемпотентність: юзер/заклад перевіряються на існування перед вставкою —
// повторний прогін пропускає все, що вже є, дублів не робить.
//
// Флаги: --pending — створювати заклади у статусі pending (для тесту флоу
// апруву з адмінки: апрув → авто-грант venue_admin власнику).
//
// Нативний запуск: pnpm seed:demo (ts-node). У docker compose сід НЕ включено
// у сервіс `migrate` (там только seed:superadmin) — демо-дані створює той,
// хто ганяє проєкт локально: docker compose run --rm migrate pnpm seed:demo.

import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import defaultDataSource from '../config/data-source';
import { User } from '../modules/users/entities/user.entity';
import { Profile } from '../modules/users/entities/profile.entity';
import { Tag } from '../modules/venues/entities/tag.entity';
import { VenueTag } from '../modules/venues/entities/venue-tag.entity';
import { Venue } from '../modules/venues/entities/venue.entity';
import { VenuePhoto } from '../modules/venues/entities/venue-photo.entity';
import { VenueType } from '../modules/venues/entities/venue-type.entity';
import { VenueTypeAssignment } from '../modules/venues/entities/venue-type-assignment.entity';
import { VenueFeature } from '../modules/venues/entities/venue-feature.entity';
import { VenueFeatureAssignment } from '../modules/venues/entities/venue-feature-assignment.entity';
import { VenueStatus } from '../modules/venues/entities/venue.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { News, NewsCategory, NewsStatus } from '../modules/news/entities/news.entity';
import { SEED_TAGS, SEED_VENUES, SEED_REVIEWS, SEED_NEWS } from './seed-demo-data';

const PASSWORD = 'User1234';
const BCRYPT_COST = 12; // синхронно з users.service.register()
const USERS = [
  { key: 'user1', email: 'user1@gmail.com', firstname: 'Андрій', lastname: 'Мельник', phone: '+380674512309', age: 27 },
  { key: 'user2', email: 'user2@gmail.com', firstname: 'Олег', lastname: 'Савчук', phone: '+380638922411', age: 31 },
  { key: 'user3', email: 'user3@gmail.com', firstname: 'Тарас', lastname: 'Гнатюк', phone: '+380937115642', age: 29 },
];

// Корінь, звідки копіюємо webp: SEED_ASSETS_DIR у .env / docker, дефолт — cwd (repo корінь backend)
const assetsRoot = process.env.SEED_ASSETS_DIR ?? process.cwd();
function uploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
}

async function main() {
  const pending = process.argv.includes('--pending');
  const status = pending ? VenueStatus.Pending : VenueStatus.Approved;
  const ds = defaultDataSource;
  if (!ds.isInitialized) await ds.initialize();

  // --- 1. Юзери ---
  const users = new Map<string, string>(); // key -> id
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_COST);
  for (const u of USERS) {
    const repo = ds.getRepository(User);
    let user = await repo.findOne({ where: { email: u.email } });
    if (user && !user.deletedAt) {
      console.log(`Юзер ${u.email} існує — пропущено.`);
    } else if (user) {
      await repo.update(user.id, { deletedAt: null, passwordHash, emailVerified: true });
      console.log(`Юзер ${u.email} був soft-deleted — відновлено.`);
    } else {
      user = await repo.save({ email: u.email, passwordHash, emailVerified: true });
      await ds.getRepository(Profile).save({
        userId: user.id, firstname: u.firstname, lastname: u.lastname,
        phone: u.phone, age: u.age,
      });
      console.log(`Юзер створено: ${u.email} (${u.firstname} ${u.lastname}).`);
    }
    users.set(u.key, user.id);
  }

  // --- 2. Теги-довідник ---
  for (const t of SEED_TAGS) {
    const known = await ds.getRepository(Tag).findOne({ where: { slug: t.slug } });
    if (!known) {
      await ds.getRepository(Tag).insert(t);
      console.log(`Тег додано: #${t.slug} (${t.name}).`);
    }
  }

  const types = await ds.getRepository(VenueType).find();
  const features = await ds.getRepository(VenueFeature).find();

  // --- 3. Заклади ---
  let created = 0;
  for (const seed of SEED_VENUES) {
    const ownerId = users.get(seed.owner);
    if (!ownerId) throw new Error(`Юзер ${seed.owner} не створився — припиняємо.`);
    const exists = await ds.getRepository(Venue).findOne({
      where: { ownerId, name: seed.name, address: seed.address },
    });
    if (exists) {
      console.log(`Заклад «${seed.name}» існує — пропущено.`);
      continue;
    }

    const venue = await ds.getRepository(Venue).save({
      ownerId,
      name: seed.name,
      description: seed.description,
      address: seed.address,
      latitude: Number(seed.latitude),
      longitude: Number(seed.longitude),
      contacts: seed.contacts,
      workingHours: seed.workingHours,
      averageCheck: seed.averageCheck != null ? Number(seed.averageCheck) : null,
      status,
    });

    // Фото: копіюємо seed-assets → uploads/venues/<venueId>/, пишемо VenuePhoto-рядки.
    // Імена файлів детерміновані (photo-K.webp) — повторний прогін не плодить копій.
    for (let i = 0; i < seed.photos.length; i++) {
      const src = join(assetsRoot, seed.photos[i]);
      const dstDir = join(uploadsRoot(), 'venues', venue.id);
      const dst = join(dstDir, `photo-${i + 1}.webp`);
      try {
        await fs.mkdir(dstDir, { recursive: true });
        await fs.copyFile(src, dst);
      } catch (e) {
        console.warn(`⚠ Фото ${seed.photos[i]} не скопіювалося (${e instanceof Error ? e.message : e}) — URL все одно записано в БД.`);
      }
      const url = `/static/venues/${venue.id}/photo-${i + 1}.webp`;
      await ds.getRepository(VenuePhoto).insert({ venueId: venue.id, url, sortOrder: i });
      if (i === seed.mainPhotoIdx) {
        await ds.getRepository(Venue).update(venue.id, { mainPhotoUrl: url });
      }
    }

    // Тип/фічі/теги — прив'язки з довідників
    const type = types.find((t) => t.slug === seed.type);
    if (type) {
      await ds.getRepository(VenueTypeAssignment).insert({ venueId: venue.id, typeId: type.id });
    }
    for (const code of seed.features) {
      const f = features.find((x) => x.code === code);
      if (f) await ds.getRepository(VenueFeatureAssignment).insert({ venueId: venue.id, featureId: f.id });
    }
    for (const slug of seed.tags) {
      const t = await ds.getRepository(Tag).findOne({ where: { slug } });
      if (t) await ds.getRepository(VenueTag).insert({ venueId: venue.id, tagId: t.id });
    }
    created++;
    console.log(`Заклад створено: «${seed.name}» (${seed.type}, статус ${status}, фото ${seed.photos.length}).`);
  }

  // --- 4. Відгуки: по одному на заклад, рецензент ≠ власник (см. seed-demo-data.ts) ---
  let reviewsCreated = 0;
  for (const r of SEED_REVIEWS) {
    const userId = users.get(r.user);
    const venue = await ds.getRepository(Venue).findOne({ where: { name: r.venue } });
    if (!userId || !venue) {
      console.warn(`⚠ Відгук для «${r.venue}» пропущено — немає юзера/закладу.`);
      continue;
    }
    const exists = await ds.getRepository(Review).findOne({ where: { venueId: venue.id, userId } });
    if (exists) {
      console.log(`Відгук ${r.user} → «${r.venue}» існує — пропущено.`);
      continue;
    }
    await ds.getRepository(Review).insert({
      venueId: venue.id, userId, rating: r.rating, text: r.text, checkPhotoUrl: null,
    });
    reviewsCreated++;
    console.log(`Відгук додано: ${r.user} → «${r.venue}» (${r.rating}/5).`);
  }

  // Перерахунок ratingAvg/ratingCount по всіх закладах, що мають відгуки
  // (та сама логіка, що ReviewsService.recalc — сід вставляє напряму в БД)
  const aggregates = await ds.getRepository(Review)
    .createQueryBuilder('r')
    .select('r."venueId"', 'venueId')
    .addSelect('AVG(r.rating)', 'avg')
    .addSelect('COUNT(r.id)', 'count')
    .groupBy('r."venueId"')
    .getRawMany<{ venueId: string; avg: string; count: string }>();
  for (const row of aggregates) {
    await ds.getRepository(Venue).update(row.venueId, {
      ratingAvg: Number(row.avg),
      ratingCount: Number(row.count),
    });
  }
  if (aggregates.length) console.log(`Рейтинг перераховано для ${aggregates.length} закладів.`);

  // --- 5. Новини: по одній published на заклад, фото — реюзна webp з seed-assets ---
  let newsCreated = 0;
  for (const n of SEED_NEWS) {
    const venue = await ds.getRepository(Venue).findOne({ where: { name: n.venue } });
    if (!venue) {
      console.warn(`⚠ Новину для «${n.venue}» пропущено — закладу немає.`);
      continue;
    }
    const exists = await ds.getRepository(News).findOne({ where: { venueId: venue.id, title: n.title } });
    if (exists) {
      console.log(`Новина «${n.title}» (${n.venue}) існує — пропущено.`);
      continue;
    }
    let imageUrl: string | null = null;
    const venueSeed = SEED_VENUES.find((v) => v.name === n.venue)!;
    const photoPath = venueSeed.photos[n.photoIdx];
    const newsId = randomUUID();
    if (photoPath) {
      const dstDir = join(uploadsRoot(), 'news', newsId);
      try {
        await fs.mkdir(dstDir, { recursive: true });
        await fs.copyFile(join(assetsRoot, photoPath), join(dstDir, 'photo.webp'));
        imageUrl = `/static/news/${newsId}/photo.webp`;
      } catch (e) {
        console.warn(`⚠ Фото новини «${n.title}» не скопіювалося (${e instanceof Error ? e.message : e}) — новина без картинки.`);
      }
    }
    await ds.getRepository(News).insert({
      id: newsId,
      venueId: venue.id,
      category: n.category as NewsCategory,
      title: n.title,
      content: n.content,
      imageUrl,
      status: NewsStatus.Published,
      publishedAt: new Date(),
    });
    newsCreated++;
    console.log(`Новину додано: «${n.title}» → «${n.venue}»${imageUrl ? ' (з фото)' : ''}.`);
  }

  console.log(`\nГотово: створено ${created} закладів (статус ${status}), ${reviewsCreated} відгуків, ${newsCreated} новин.`);
  console.log(`Юзери: ${USERS.map((u) => `${u.email}/User1234`).join(', ')}.`);
}

main()
  .catch((e) => {
    console.error('Сід демо-даних впав:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const ds = defaultDataSource;
    if (ds.isInitialized) await ds.destroy();
  });