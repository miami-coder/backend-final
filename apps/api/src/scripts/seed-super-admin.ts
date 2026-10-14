// Сід супер-адміна для локального запуску: docker compose запускає його
// разом із міграціями (див. сервіс `migrate` у docker-compose.yml), тому
// скрипт ідемпотентний — повторний прогін нічого не ламає.
//
// Логіка: якщо користувач SUPER_ADMIN_EMAIL уже є в базі (не видалений) —
// нічого не створюємо; якщо користувач існує, але soft-deleted —
// відновлюємо й гарантуємо роль super_admin; якщо немає — створюємо
// користувача + профіль + роль super_admin.
//
// Креді за замовчуванням (локальний запуск): admin@gmail.com / Admin1234.
// Можна перекрити через SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD у .env.
//
// ВАЖЛИВО: це сід для локального середовища — на проді (Vercel/Neon)
// він не запускається сервером, супер-адміна там створено керовано.

import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import defaultDataSource from '../config/data-source';
import { User } from '../modules/users/entities/user.entity';
import { Profile } from '../modules/users/entities/profile.entity';
import { Role } from '../modules/rbac/entities/role.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';

const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'admin@gmail.com';
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin1234';
const BCRYPT_COST = 12; // синхронно з users.service.register()

async function main() {
  const ds = defaultDataSource;
  if (!ds.isInitialized) await ds.initialize();

  const role = await ds.getRepository(Role).findOne({ where: { code: 'super_admin' } });
  if (!role) {
    throw new Error(
      'Ролі super_admin немає в базі — спершу прогоніть міграції (pnpm migration:run або сервіс `migrate`).',
    );
  }

  const existing = await ds
    .getRepository(User)
    .findOne({ where: { email: EMAIL }, relations: { userRoles: true } });

  if (existing && !existing.deletedAt) {
    // Гарантуємо роль, якщо її раптом зняли (ідемпотентність)
    const hasRole = (existing.userRoles ?? []).some((ur) => ur.roleId === role.id);
    if (hasRole) {
      console.log(`Супер-адмін ${EMAIL} вже існує — створення пропущено.`);
      return;
    }
    await ds.getRepository(UserRole).insert({
      userId: existing.id,
      roleId: role.id,
      assignedBy: null,
    });
    console.log(`Супер-адмін ${EMAIL} існує — додано відсутню роль super_admin.`);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_COST);

  if (existing) {
    // Soft-deleted: відновлюємо, оновлюємо хеш і роль
    await ds.getRepository(User).update(existing.id, {
      deletedAt: null,
      passwordHash,
      emailVerified: true,
    });
    await ds
      .getRepository(UserRole)
      .insert({ userId: existing.id, roleId: role.id, assignedBy: null });
    console.log(`Супер-адмін ${EMAIL} було soft-deleted — відновлено з роллю super_admin.`);
    return;
  }

  await ds.transaction(async (em) => {
    const user = await em.getRepository(User).save({
      email: EMAIL,
      passwordHash,
      emailVerified: true,
    });
    await em.getRepository(Profile).save({
      userId: user.id,
      firstname: 'Супер',
      lastname: 'Адмін',
    });
    await em.getRepository(UserRole).save({
      userId: user.id,
      roleId: role.id,
      assignedBy: null,
    });
  });
  console.log(
    `Супер-адміна створено: ${EMAIL} (ролі super_admin; профіль «Супер Адмін»).`,
  );
}

main()
  .catch((e) => {
    console.error('Сід супер-адміна впав:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const ds = defaultDataSource;
    if (ds.isInitialized) await ds.destroy();
  });