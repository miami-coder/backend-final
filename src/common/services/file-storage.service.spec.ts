import { promises as fs } from 'fs';
import { join } from 'path';
import { FileStorageService } from './file-storage.service';

const TMP = join(process.cwd(), 'uploads-test');

describe('FileStorageService', () => {
  let service: FileStorageService;
  const origDir = process.env.UPLOADS_DIR;

  beforeAll(() => {
    process.env.UPLOADS_DIR = TMP;
  });

  afterAll(async () => {
    if (origDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = origDir;
    await fs.rm(TMP, { recursive: true, force: true });
  });

  beforeEach(() => {
    service = new FileStorageService();
  });

  it('saves a jpeg file and returns url', async () => {
    const result = await service.save('test', {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 100,
      buffer: Buffer.from('fake-jpeg-content'),
    });
    expect(result.url).toMatch(/^\/static\/test\/[a-f0-9-]+\.jpg$/);
    expect(result.size).toBe(100);
  });

  it('rejects unsupported mime type', async () => {
    await expect(
      service.save('test', {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('pdf'),
      }),
    ).rejects.toThrow(/Unsupported mime type/);
  });

  it('rejects too large file', async () => {
    await expect(
      service.save('test', {
        originalname: 'big.jpg',
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow(/too large/);
  });
});
