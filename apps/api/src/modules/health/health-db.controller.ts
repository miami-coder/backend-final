import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { CacheService } from '../../common/services/cache.service';

@Controller('health')
export class HealthDbController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly cache: CacheService,
  ) {}

  @Public()
  @Get('db')
  async db() {
    await this.ds.query('SELECT 1');
    return {
      status: 'ok',
      db: 'up',
      redis: this.cache.isConnected() ? 'up' : 'down',
    };
  }
}
