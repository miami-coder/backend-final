import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(
    @InjectRepository(AuditLog)
    private readonly audit: Repository<AuditLog>,
  ) {}

  async log(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    before: object | null = null,
    after: object | null = null,
  ): Promise<AuditLog> {
    const entry = await this.audit.save({
      actorId,
      action,
      entityType,
      entityId,
      before,
      after,
    });
    this.logger.log(
      `audit:${action} on ${entityType}:${entityId ?? '*'} by ${actorId ?? 'system'}`,
    );
    return entry;
  }
}
