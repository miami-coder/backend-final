import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let users: {
    findById: jest.Mock;
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
  };

  beforeEach(async () => {
    users = {
      findById: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: users }],
    }).compile();
    controller = module.get(UsersController);
  });

  it('returns current user with profile', async () => {
    users.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerified: false,
    });
    users.getProfile.mockResolvedValue({
      firstname: 'Іван',
      lastname: 'Петренко',
      age: 25,
      phone: null,
      avatarUrl: null,
    });
    const res = await controller.me({
      sub: 'u1',
      email: 'a@b.com',
      roles: ['user'],
    });
    expect(res.data.id).toBe('u1');
    expect(res.data.profile.firstname).toBe('Іван');
  });

  it('updates profile', async () => {
    users.updateProfile.mockResolvedValue({
      userId: 'u1',
      firstname: 'Петро',
      lastname: 'Петренко',
      age: 26,
      phone: null,
      avatarUrl: null,
    });
    const res = await controller.updateProfile(
      { sub: 'u1', email: 'a@b.com', roles: ['user'] },
      { firstname: 'Петро', age: 26 },
    );
    expect(res.data.firstname).toBe('Петро');
    expect(users.updateProfile).toHaveBeenCalledWith('u1', {
      firstname: 'Петро',
      age: 26,
    });
  });
});
