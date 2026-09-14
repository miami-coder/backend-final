import { bootstrapTestApp } from './helpers/test-app';
import request from 'supertest';

describe('Auth E2E', () => {
  let app: any;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const result = await bootstrapTestApp();
    app = result.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user and issues tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'authuser@x.com',
        password: 'Password1',
        firstname: 'Ав',
        lastname: 'То',
        acceptEula: true,
      })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('authuser@x.com');
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('logs in with credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'authuser@x.com', password: 'Password1' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('returns current user via /me', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.email).toBe('authuser@x.com');
  });

  it('rotates refresh token (old becomes invalid)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    // Old refresh token must now be revoked
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    refreshToken = res.body.refreshToken;
  });

  it('logs out and invalidates the refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('rejects login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'authuser@x.com', password: 'WrongPass1' })
      .expect(401);
  });
});
