import { BadRequestException } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';

// PNG-магія (89 50 4E 47 0D 0A 1A 0A)
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(128),
]);
// JPEG-магія (FF D8 FF)
const JPEG_BUFFER = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(128),
]);
// HTML-вміст (не зображення)
const HTML_BUFFER = Buffer.from('<html><script>alert("x")</script></html>');
// WEBP-магія (RIFF....WEBP)
const WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8'),
  Buffer.alloc(64),
]);

describe('FileStorageService — тип файлу за magic bytes (ревʼю викладача)', () => {
  let service: FileStorageService;
  let writeFileMock: jest.Mock;

  beforeEach(() => {
    service = new FileStorageService();
    writeFileMock = jest.fn();
    jest.spyOn(service as any, 'useBlobMode', 'get').mockReturnValue(false);
    jest
      .spyOn(service as any, 'uploadsRoot', 'get')
      .mockReturnValue('/tmp/test-uploads');
    jest
      .spyOn(require('fs').promises, 'writeFile')
      .mockImplementation(writeFileMock);
    jest.spyOn(require('fs').promises, 'mkdir').mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('HTML-байти при заявленому image/png → 400, нічого не зберігається', async () => {
    await expect(
      service.save('venues', {
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: 100,
        buffer: HTML_BUFFER,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('PNG-магія при заявленому text/html → зберігає як .png з image/png', async () => {
    const res = await service.save('venues', {
      originalname: 'x.html',
      mimetype: 'image/png',
      size: 100,
      buffer: PNG_BUFFER,
    });
    expect(res.filename.endsWith('.png')).toBe(true);
    expect(res.filename.endsWith('.html')).toBe(false);
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/test-uploads/venues/' + res.filename,
      PNG_BUFFER,
    );
  });

  it('розширення завжди від реального типу (originalname .html + PNG-магія → .png)', async () => {
    const res = await service.save('venues', {
      originalname: 'image.html',
      mimetype: 'image/png',
      size: 100,
      buffer: PNG_BUFFER,
    });
    expect(res.url.startsWith('/static/venues/')).toBe(true);
    expect(res.filename.endsWith('.png')).toBe(true);
  });

  it('JPEG-магія → .jpg', async () => {
    const res = await service.save('venues', {
      originalname: 'Без назви 2 (3)',
      mimetype: 'image/jpeg',
      size: 100,
      buffer: JPEG_BUFFER,
    });
    expect(res.filename.endsWith('.jpg')).toBe(true);
  });

  it('WEBP-магія → .webp', async () => {
    const res = await service.save('venues', {
      originalname: 'img',
      mimetype: 'image/webp',
      size: 100,
      buffer: WEBP_BUFFER,
    });
    expect(res.filename.endsWith('.webp')).toBe(true);
  });

  it('mime поза whitelist навіть з валідною магією → 400', async () => {
    await expect(
      service.save('venues', {
        originalname: 'a.png',
        mimetype: 'application/pdf',
        size: 100,
        buffer: PNG_BUFFER,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('файл завеликий → 400 (не гол Error)', async () => {
    await expect(
      service.save('venues', {
        originalname: 'a.png',
        mimetype: 'image/png',
        size: 6 * 1024 * 1024,
        buffer: PNG_BUFFER,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('порожній/короткий буфер (визначити тип неможливо) → 400', async () => {
    await expect(
      service.save('venues', {
        originalname: 'a.png',
        mimetype: 'image/png',
        size: 3,
        buffer: Buffer.from([0x89, 0x50, 0x4e]),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
