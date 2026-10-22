import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { put, del } from '@vercel/blob';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Реальний тип зображення за магічними байтами (тип
 *  визначається перевіреним вмістом, а не заявою клієнта). */
function detectImageType(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  if (isPng) return 'png';
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  if (isJpeg) return 'jpeg';
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  if (isWebp) return 'webp';
  return null;
}

const EXT_FROM_TYPE: Record<'jpeg' | 'png' | 'webp', string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

const MIME_FROM_TYPE: Record<'jpeg' | 'png' | 'webp', string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Зберігання завантажених файлів у двох режимах:
 * - локальний (дефолт): файл у uploads/, URL - /static/folder/file;
 * - blob (коли є BLOB_READ_WRITE_TOKEN, тобто на Vercel): файл у Vercel Blob,
 *   URL — публічне https-посилання з токена; диск серверлеса не використовується.
 */
@Injectable()
export class FileStorageService {
  async save(
    folder: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ): Promise<{ url: string; filename: string; size: number }> {
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Файл завеликий (максимум 5 МБ)');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Некоректний тип файлу');
    }
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('Некоректний вміст файлу');
    }
    // Розширення — тільки від перевіреного типу; originalname не береться
    // взагалі (x.html не має шансів зберегтись як .html).
    const filename = `${randomUUID()}${EXT_FROM_TYPE[detected]}`;
    const contentType = MIME_FROM_TYPE[detected];

    if (this.useBlobMode) {
      const blob = await put(`${folder}/${filename}`, file.buffer, {
        access: 'public',
        contentType,
      });
      return { url: blob.url, filename, size: file.size };
    }

    const dir = join(this.uploadsRoot, folder);
    await fs.mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);
    await fs.writeFile(filepath, file.buffer);
    const url = `/static/${folder}/${filename}`;
    return { url, filename, size: file.size };
  }

  async remove(folder: string, filename: string): Promise<void> {
    if (this.useBlobMode) {
      await del(`${folder}/${filename}`).catch(() => undefined);
      return;
    }
    const filepath = join(this.uploadsRoot, folder, filename);
    await fs.unlink(filepath).catch(() => undefined);
  }

  // Blob-режим активний коли є класичний токен АБО безтокенне підключення
  // (Vercel Marketplace Blob інжектить BLOB_STORE_ID; @vercel/blob 2.8+
  // сам ресолвить OIDC-креденшіали в середовищі Vercel).
  private get useBlobMode(): boolean {
    return Boolean(
      process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN,
    );
  }

  private get uploadsRoot(): string {
    return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  }
}
