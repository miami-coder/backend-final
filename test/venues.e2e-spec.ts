import { bootstrapTestApp } from './helpers/test-app';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestUser } from './helpers/seed';

describe('Venues E2E', () => {
  let app: any;
  let ds: DataSource;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const result = await bootstrapTestApp();
    app = result.app;
    ds = result.module.get(DataSource);

    const owner = await createTestUser(ds, { email: 'owner@x.com', password: 'Password1', firstname: 'О', lastname: 'В' });
    const admin = await createTestUser(ds, { email: 'admin@x.com', password: 'Password1', firstname: 'A', lastname: 'S', roles: ['user', 'super_admin'] });

    // Login owner
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@x.com', password: 'Password1' });
    userToken = ownerLogin.body.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@x.com', password: 'Password1' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('user creates a pending venue', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Тестовий заклад', address: 'вул. Хрещатик, 1', latitude: 50.45, longitude: 30.52, averageCheck: 500 })
      .expect(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.id).toBeDefined();
  });

  it('public list does not include pending venues', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/venues')
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('admin approves pending venue', async () => {
    const pending = await request(app.getHttpServer())
      .get('/api/v1/admin/venues/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const id = pending.body.data[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/venues/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const list = await request(app.getHttpServer()).get('/api/v1/venues').expect(200);
    expect(list.body.data.some((v: any) => v.id === id)).toBe(true);
  });

  it('unauthenticated cannot create venue', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/venues')
      .send({ name: 'X', address: 'Y' })
      .expect(401);
  });

  it('non-owner non-admin cannot update venue', async () => {
    const stranger = await createTestUser(ds, { email: 'stranger@x.com', password: 'Password1', firstname: 'S', lastname: 'T' });
    const sLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'stranger@x.com', password: 'Password1' });
    const sToken = sLogin.body.accessToken;

    const list = await request(app.getHttpServer()).get('/api/v1/venues').expect(200);
    const venueId = list.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/api/v1/venues/${venueId}`)
      .set('Authorization', `Bearer ${sToken}`)
      .send({ name: 'hijack' })
      .expect(403);
  });
});
