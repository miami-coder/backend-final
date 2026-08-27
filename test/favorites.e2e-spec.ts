import { bootstrapTestApp } from './helpers/test-app';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestUser } from './helpers/seed';

describe('Favorites E2E', () => {
  let app: any;
  let ds: DataSource;
  let userToken: string;
  let venueId: string;

  beforeAll(async () => {
    const result = await bootstrapTestApp();
    app = result.app;
    ds = result.module.get(DataSource);

    await createTestUser(ds, {
      email: 'favuser@x.com',
      password: 'Password1',
      firstname: 'Ф',
      lastname: 'В',
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'favuser@x.com', password: 'Password1' });
    userToken = login.body.accessToken;

    // Create a venue to favorite
    const venue = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Улюблений заклад',
        address: 'вул. Любая, 5',
        latitude: 50.45,
        longitude: 30.52,
        averageCheck: 300,
      });
    venueId = venue.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('adds a venue to favorites', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/me/favorites/${venueId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);
    expect(res.body.data.venueId).toBe(venueId);
  });

  it('adding again is idempotent', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/me/favorites/${venueId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);
  });

  it('lists favorites', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(venueId);
  });

  it('removes a venue from favorites', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/me/favorites/${venueId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/me/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(res.body.data.length).toBe(0);
  });
});