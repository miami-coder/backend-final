import { User } from '../../modules/users/entities/user.entity';

/**
 * Публічне подання користувача:
 * жодних passwordHash / email / emailVerified / deletedAt у відповідях,
 * куди анонім не має права зазирати. Телефон — теж приватний (PII),
 * фронт у owner-профілі читає лише імʼя/аватар. Профіль — білим списком.
 */
export function sanitizeUser(
  user: User | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!user) return user;
  // Видалений автор — «як у телеграмі»: позначка замість персональних даних.
  if (user.deletedAt) {
    return {
      id: user.id,
      isDeleted: true,
      profile: { firstname: 'Обліковий запис', lastname: 'видалено' },
    };
  }
  const p = user.profile;
  return {
    id: user.id,
    profile: p
      ? {
          firstname: p.firstname,
          lastname: p.lastname,
          age: p.age,
          avatarUrl: p.avatarUrl,
        }
      : null,
  };
}
