import { bootstrapTestApp } from './helpers/test-app';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestUser } from './helpers/seed';

describe('Reviews E2E', () => {
  let app: any;
  let ds: DataSource;
  let ownerToken: string;
  let adminToken: string;
  let venueId: string;

  beforeAll(async () => {
    const result = await bootstrapTestApp();
    app = result.app;
    ds = result.module.get(DataSource);

    await createTestUser(ds, {
      email: 'rvowner@x.com',
      password: 'Password1',
      firstname: 'В',
      lastname: 'О',
    });
    await createTestUser(ds, {
      email: 'rvadmin@x.com',
      password: 'Password1',
      firstname: 'А',
      lastname: 'Д',
      roles: ['user', 'super_admin'],
    });
    await createTestUser(ds, {
      email: 'reviewer1@x.com',
      password: 'Password1',
      firstname: 'Р',
      lastname: '1',
    });
    await createTestUser(ds, {
      email: 'reviewer2@x.com',
      password: 'Password1',
      firstname: 'Р',
      lastname: '2',
    });

    ownerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'rvowner@x.com', password: 'Password1' })
    ).body.accessToken;
    adminToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'rvadmin@x.com', password: 'Password1' })
    ).body.accessToken;

    const venue = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Заклад з відгуками',
        address: 'вул. Відгукова, 9',
        latitude: 50.45,
        longitude: 30.52,
        averageCheck: 400,
      })
      .expect(201);
    venueId = venue.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/venues/${venueId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function reviewerToken(email: string) {
    return (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1' })
    ).body.accessToken;
  }

  async function venueRating() {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/venues/${venueId}`)
      .expect(200);
    return { avg: res.body.data.ratingAvg, count: res.body.data.ratingCount };
  }

  it('first review updates venue rating', async () => {
    const token = await reviewerToken('reviewer1@x.com');
    await request(app.getHttpServer())
      .post(`/api/v1/venues/${venueId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, text: 'Чудовий заклад, дуже сподобалось!' })
      .expect(201);

    const { avg, count } = await venueRating();
    expect(Number(avg)).toBe(5);
    expect(count).toBe(1);
  });

  it('second review averages the rating', async () => {
    const token = await reviewerToken('reviewer2@x.com');
    await request(app.getHttpServer())
      .post(`/api/v1/venues/${venueId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3, text: 'Нормально, але є що покращити.' })
      .expect(201);

    const { avg, count } = await venueRating();
    expect(Number(avg)).toBe(4);
    expect(count).toBe(2);
  });

  it('prevents duplicate review from the same user', async () => {
    const token = await reviewerToken('reviewer1@x.com');
    await request(app.getHttpServer())
      .post(`/api/v1/venues/${venueId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, text: 'Ще один відгук від мене тут.' })
      .expect(409);
  });
});
