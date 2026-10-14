import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthDbController } from './health-db.controller';

@Module({ controllers: [HealthController, HealthDbController] })
export class HealthModule {}
