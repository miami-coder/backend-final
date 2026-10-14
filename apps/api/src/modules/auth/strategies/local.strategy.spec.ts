import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let users: any;
  let strategy: LocalStrategy;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      verifyPassword: jest.fn(),
    };
    strategy = new LocalStrategy(users);
  });

  it('returns { id, email } on valid credentials', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    users.verifyPassword.mockResolvedValue(true);

    const result = await strategy.validate('a@b.com', 'secret');

    expect(users.findByEmail).toHaveBeenCalledWith('a@b.com');
    expect(users.verifyPassword).toHaveBeenCalledWith(
      { id: 'u1', email: 'a@b.com' },
      'secret',
    );
    expect(result).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('throws UnauthorizedException when user not found', async () => {
    users.findByEmail.mockResolvedValue(null);

    await expect(strategy.validate('nope@x.com', 'secret')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users.verifyPassword).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when password is wrong', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    users.verifyPassword.mockResolvedValue(false);

    await expect(strategy.validate('a@b.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
