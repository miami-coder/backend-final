import { User } from '../../modules/users/entities/user.entity';

/**
 * Публічне подання користувача (рев'ю викладача 2026-10-20):
 * жодних passwordHash / email / emailVerified / deletedAt у відповідях,
 * куди анонім не має права зазирати. Телефон — теж приватний (PII),
 * фронт у owner-профілі читає лише імʼя/аватар. Профіль — білим списком.
 */
export function sanitizeUser(
  user: User | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!user) return user;
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
