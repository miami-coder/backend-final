import { FacebookStrategy } from './facebook.strategy';

describe('FacebookStrategy', () => {
  let users: any;
  let strategy: FacebookStrategy;

  beforeAll(() => {
    process.env.FACEBOOK_APP_ID = 'fb-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
    process.env.FACEBOOK_CALLBACK_URL = 'http://cb';
  });

  afterAll(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    delete process.env.FACEBOOK_CALLBACK_URL;
  });

  beforeEach(() => {
    users = { findOrCreateOAuthUser: jest.fn() };
    strategy = new FacebookStrategy(users);
  });

  it('creates user from profile email and calls done(null, user)', async () => {
    users.findOrCreateOAuthUser.mockResolvedValue({
      id: 'u1',
      email: 'e@x.com',
    });

    const profile = {
      id: 'fb-1',
      emails: [{ value: 'e@x.com' }],
      name: { givenName: 'John', familyName: 'Doe' },
      displayName: 'John Doe',
    } as any;

    let doneErr: any;
    let doneUser: any;
    await strategy.validate('tok', 'ref', profile, (err, user) => {
      doneErr = err;
      doneUser = user;
    });

    expect(users.findOrCreateOAuthUser).toHaveBeenCalledWith(
      'e@x.com',
      'facebook',
      'fb-1',
      { firstname: 'John', lastname: 'Doe' },
    );
    expect(doneErr).toBeNull();
    expect(doneUser).toEqual({ id: 'u1', email: 'e@x.com' });
  });

  it('falls back to placeholder facebook email when none provided', async () => {
    users.findOrCreateOAuthUser.mockResolvedValue({
      id: 'u2',
      email: 'fb-1@facebook.placeholder',
    });

    const profile = {
      id: 'fb-1',
      displayName: 'Jane',
    } as any;

    let doneUser: any;
    await strategy.validate('tok', 'ref', profile, (_e, user) => {
      doneUser = user;
    });

    expect(users.findOrCreateOAuthUser).toHaveBeenCalledWith(
      'fb-1@facebook.placeholder',
      'facebook',
      'fb-1',
      { firstname: 'Jane', lastname: '' },
    );
    expect(doneUser).toEqual({ id: 'u2', email: 'fb-1@facebook.placeholder' });
  });
});
