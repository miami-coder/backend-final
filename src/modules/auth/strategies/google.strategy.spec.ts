import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let users: any;
  let strategy: GoogleStrategy;

  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'g-id';
    process.env.GOOGLE_CLIENT_SECRET = 'g-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://cb';
  });

  afterAll(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;
  });

  beforeEach(() => {
    users = { findOrCreateOAuthUser: jest.fn() };
    strategy = new GoogleStrategy(users);
  });

  it('creates user from profile email and calls done(null, user)', async () => {
    users.findOrCreateOAuthUser.mockResolvedValue({
      id: 'u1',
      email: 'e@x.com',
    });

    const profile = {
      id: 'g-1',
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
      'google',
      'g-1',
      { firstname: 'John', lastname: 'Doe' },
    );
    expect(doneErr).toBeNull();
    expect(doneUser).toEqual({ id: 'u1', email: 'e@x.com' });
  });

  it('calls done with Error when email is missing', async () => {
    const profile = { id: 'g-2', displayName: 'No Email' } as any;

    let doneErr: any;
    let doneUser: any;
    await strategy.validate('tok', 'ref', profile, (err, user) => {
      doneErr = err;
      doneUser = user;
    });

    expect(users.findOrCreateOAuthUser).not.toHaveBeenCalled();
    expect(doneErr).toBeInstanceOf(Error);
    expect(doneUser).toBeUndefined();
  });
});
