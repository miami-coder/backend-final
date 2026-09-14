import { bootstrapTestApp } from './helpers/test-app';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestUser } from './helpers/seed';

describe('Hangouts E2E', () => {
  let app: any;
  let ds: DataSource;
  let creatorToken: string;
  let hangoutId: string;
  const futureDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  beforeAll(async () => {
    const result = await bootstrapTestApp();
    app = result.app;
    ds = result.module.get(DataSource);

    await createTestUser(ds, {
      email: 'hcreator@x.com',
      password: 'Password1',
      firstname: 'Г',
      lastname: 'К',
    });
    creatorToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'hcreator@x.com', password: 'Password1' })
    ).body.accessToken;

    // Creator needs a venue to attach the hangout to
    const venue = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'Заклад для пиячка',
        address: 'вул. Зустрічна, 12',
        latitude: 50.45,
        longitude: 30.52,
        averageCheck: 250,
      });
    const venueId = venue.body.data.id;

    const hangout = await request(app.getHttpServer())
      .post(`/api/v1/venues/${venueId}/hangouts`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        date: futureDate,
        time: '19:30',
        purpose: 'Зустріч для обговорення нових ідей проєкту',
        groupSize: 4,
      })
      .expect(201);
    hangoutId = hangout.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function joinAs(email: string, expected: number) {
    const token = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1' })
    ).body.accessToken;
    return request(app.getHttpServer())
      .post(`/api/v1/hangouts/${hangoutId}/join`)
      .set('Authorization', `Bearer ${token}`)
      .expect(expected);
  }

  it('creator is a participant and hangout is open', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/hangouts/${hangoutId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.participants.length).toBe(1);
  });

  it('two joins keep the hangout open', async () => {
    await createTestUser(ds, {
      email: 'hjoin1@x.com',
      password: 'Password1',
      firstname: 'Д',
      lastname: '1',
    });
    await createTestUser(ds, {
      email: 'hjoin2@x.com',
      password: 'Password1',
      firstname: 'Д',
      lastname: '2',
    });

    const r1 = await joinAs('hjoin1@x.com', 201);
    expect(r1.body.data.status).toBe('open');
    const r2 = await joinAs('hjoin2@x.com', 201);
    expect(r2.body.data.status).toBe('open');
  });

  it('third join fills the hangout', async () => {
    await createTestUser(ds, {
      email: 'hjoin3@x.com',
      password: 'Password1',
      firstname: 'Д',
      lastname: '3',
    });
    const r = await joinAs('hjoin3@x.com', 201);
    expect(r.body.data.status).toBe('filled');
  });

  it('further join is rejected with 409', async () => {
    await createTestUser(ds, {
      email: 'hjoin4@x.com',
      password: 'Password1',
      firstname: 'Д',
      lastname: '4',
    });
    await joinAs('hjoin4@x.com', 409);
  });

  it('creator can cancel the hangout', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/hangouts/${hangoutId}/cancel`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(201);
    expect(res.body.data.status).toBe('cancelled');
  });
});
