import { User } from '../../modules/users/entities/user.entity';

/**
 * Публічне подання користувача (рев'ю викладача 2026-10-20):
 * жодних passwordHash / email / emailVerified / deletedAt у відповідях,
 * куди анонім не має права зазирати. Профіль вже публічний.
 */
export function sanitizeUser(
  user: User | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!user) return user;
  return {
    id: user.id,
    profile: user.profile ?? null,
  };
}