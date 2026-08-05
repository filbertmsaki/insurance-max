import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { PortalReferenceService } from './portal-reference.service';

describe('PortalReferenceService', () => {
  let service: PortalReferenceService;
  const query = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalReferenceService,
        { provide: DataSource, useValue: { manager: { query } } },
      ],
    }).compile();

    service = module.get(PortalReferenceService);
    query.mockReset();
  });

  it('creates a padded request reference', async () => {
    query.mockResolvedValue([{ current_value: '15' }]);

    const currentYear = new Date().getFullYear();

    await expect(
      service.next('company-id', 'PORTAL_REQUEST', 'PRQ'),
    ).resolves.toBe(`PRQ-${currentYear}-000015`);
  });

  it('uses the supplied transactional manager', async () => {
    const managerQuery = jest.fn().mockResolvedValue([{ current_value: '2' }]);

    const manager = { query: managerQuery } as never;

    await service.next('company-id', 'PORTAL_REQUEST', 'PRQ', manager);

    expect(managerQuery).toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
