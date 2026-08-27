import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let audit: any;

  beforeEach(async () => {
    audit = {
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: audit },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  it('log persists an audit entry', async () => {
    const r = await service.log('u1', 'soft_delete', 'user', 'u2', null, {
      deletedAt: '2026-08-27',
    });
    expect(audit.save).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'soft_delete',
      entityType: 'user',
      entityId: 'u2',
      before: null,
      after: { deletedAt: '2026-08-27' },
    });
    expect(r.action).toBe('soft_delete');
  });

  it('log defaults before/after to null', async () => {
    await service.log('u1', 'assign_role', 'user', 'u2');
    expect(audit.save).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'assign_role',
      entityType: 'user',
      entityId: 'u2',
      before: null,
      after: null,
    });
  });
});
