import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { put, del } from '@vercel/blob';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new Error(`Unsupported mime type: ${file.mimetype}`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`File too large: ${file.size} bytes (max ${MAX_BYTES})`);
    }
    const ext =
      extname(file.originalname).toLowerCase() ||
      this.extFromMime(file.mimetype);
    const filename = `${randomUUID()}${ext}`;

    if (this.useBlobMode) {
      const blob = await put(`${folder}/${filename}`, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
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
    return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
  }

  private get uploadsRoot(): string {
    return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.bin';
  }
}