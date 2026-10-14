import { User } from './user.entity';

describe('User entity', () => {
  it('instantiates with expected fields', () => {
    const user = new User();
    user.email = 'a@b.com';
    user.passwordHash = 'hash';
    user.emailVerified = false;
    expect(user.email).toBe('a@b.com');
    expect(user.passwordHash).toBe('hash');
    expect(user.emailVerified).toBe(false);
  });

  it('allows null passwordHash for OAuth-only users', () => {
    const user = new User();
    user.email = 'oauth@b.com';
    user.passwordHash = null;
    user.emailVerified = true;
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerified).toBe(true);
  });
});
