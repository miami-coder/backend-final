import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteContent } from './site-content.entity';

const ALLOWED_KEYS = ['about', 'contacts'] as const;
export type ContentKey = (typeof ALLOWED_KEYS)[number];

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(SiteContent)
    private readonly repo: Repository<SiteContent>,
  ) {}

  async getAll(): Promise<Record<string, string | null>> {
    const rows = await this.repo.find();
    const map: Record<string, string | null> = {};
    for (const k of ALLOWED_KEYS) map[k] = null;
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  async update(key: string, value: string | null): Promise<SiteContent> {
    if (!this.isKey(key)) {
      throw new NotFoundException(`Невідомий розділ: ${key}`);
    }
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.repo.save(existing);
    }
    return this.repo.save({ key, value });
  }

  isKey(key: string): key is ContentKey {
    return (ALLOWED_KEYS as readonly string[]).includes(key);
  }
}