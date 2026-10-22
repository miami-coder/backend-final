import { sanitizeUser } from './sanitize-user';
import { User } from '../../modules/users/entities/user.entity';

describe('sanitizeUser', () => {
  it('живий юзер → {id, profile-білий-список}, без приватних полів', () => {
    const u = {
      id: 'u1',
      email: 'a@b.com',
      passwordHash: '$2b$10$secret',
      emailVerified: true,
      deletedAt: null,
      profile: {
        firstname: 'Олена',
        lastname: 'К',
        age: 30,
        avatarUrl: null,
        phone: '+38099…',
      },
    } as unknown as User;
    const s = sanitizeUser(u);
    expect(s).toEqual({
      id: 'u1',
      profile: { firstname: 'Олена', lastname: 'К', age: 30, avatarUrl: null },
    });
  });

  it('видалений юзер → isDeleted + псевдо-профіль, без email/passwordHash/телефона', () => {
    const u = {
      id: 'u2',
      email: 'del@b.com',
      passwordHash: '$2b$10$secret',
      deletedAt: new Date(),
      profile: { firstname: 'Тарас', lastname: 'Г', phone: '+380…' },
    } as unknown as User;
    const s = sanitizeUser(u);
    expect(s).toEqual({
      id: 'u2',
      isDeleted: true,
      profile: { firstname: 'Обліковий запис', lastname: 'видалено' },
    });
    expect(JSON.stringify(s)).not.toContain('del@b.com');
    expect(JSON.stringify(s)).not.toContain('passwordHash');
  });
});
