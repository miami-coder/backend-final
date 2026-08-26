import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_ROOT = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class FileStorageService {
  async save(
    folder: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<{ url: string; filename: string; size: number }> {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new Error(`Unsupported mime type: ${file.mimetype}`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`File too large: ${file.size} bytes (max ${MAX_BYTES})`);
    }
    const ext = extname(file.originalname).toLowerCase() || this.extFromMime(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const dir = join(UPLOADS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);
    await fs.writeFile(filepath, file.buffer);
    const url = `/static/${folder}/${filename}`;
    return { url, filename, size: file.size };
  }

  async remove(folder: string, filename: string): Promise<void> {
    const filepath = join(UPLOADS_ROOT, folder, filename);
    await fs.unlink(filepath).catch(() => undefined);
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.bin';
  }
}
