import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

describe('claim document download access', () => {
  const user = {
    companyId: 'company-1',
    id: 'user-1',
    permissions: ['claims:read', 'policies:read'],
  } as any;
  const actor = {
    actorId: 'user-1',
    actorType: 'USER',
    accessChannel: 'INTERNAL_API',
  };
  function setup(document: any, allowed: string[], policyAllowed = false) {
    const repository = { findOne: jest.fn().mockResolvedValue(document) };
    const accessEvents = { create: jest.fn((value) => value), save: jest.fn() };
    const policyQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValue(policyAllowed ? { id: 'policy-1' } : null),
    };
    const access = {
      getForRead: jest.fn(async (_user, id) => {
        if (!allowed.includes(id)) throw new NotFoundException();
        return { id };
      }),
    };
    const service = new DocumentsService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      accessEvents as any,
      {} as any,
      {} as any,
      access as any,
      { createQueryBuilder: () => policyQuery } as any,
      { resolve: jest.fn(), applyPolicyReadScope: jest.fn() } as any,
    );
    const download = jest.spyOn(service, 'download').mockResolvedValue({
      buffer: Buffer.from('test'),
      fileName: 'test',
      mimeType: 'text/plain',
    });
    return { service, download, accessEvents };
  }
  it.each(['CLAIM', 'POLICY'])(
    'denies an orphaned %s document',
    async (ownerType) => {
      const { service, download, accessEvents } = setup(
        {
          id: 'document-1',
          company_id: 'company-1',
          owner_type: ownerType,
          owner_id: null,
          links: [],
        },
        [],
      );
      await expect(
        service.downloadForUser(user, 'document-1', actor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(download).not.toHaveBeenCalled();
      expect(accessEvents.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'FAILED',
          failure_reason: 'RESOURCE_SCOPE_DENIED',
        }),
      );
    },
  );
  it('denies a user outside the claim scope', async () => {
    const { service, download } = setup(
      {
        id: 'document-1',
        company_id: 'company-1',
        owner_type: 'CLAIM',
        owner_id: 'claim-1',
        links: [],
      },
      [],
    );
    await expect(
      service.downloadForUser(user, 'document-1', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(download).not.toHaveBeenCalled();
  });
  it('denies a document outside the user company', async () => {
    const { service, download } = setup(null, []);
    await expect(
      service.downloadForUser(user, 'document-1', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(download).not.toHaveBeenCalled();
  });
  it('allows a document shared with an accessible claim', async () => {
    const { service, download } = setup(
      {
        owner_type: 'CLAIM',
        owner_id: 'claim-1',
        links: [{ linked_record_type: 'CLAIM', linked_record_id: 'claim-2' }],
      },
      ['claim-2'],
    );
    await service.downloadForUser(user, 'document-1', actor);
    expect(download).toHaveBeenCalledWith('company-1', 'document-1', actor);
  });
  it('permits an authorized policy owner', async () => {
    const { service, download } = setup(
      { owner_type: 'POLICY', owner_id: 'policy-1', links: [] },
      [],
      true,
    );
    await service.downloadForUser(user, 'document-1', actor);
    expect(download).toHaveBeenCalled();
  });
  it('allows a policy-authorized user to read a shared document even when claim scope denies it', async () => {
    const { service, download } = setup(
      {
        owner_type: 'POLICY',
        owner_id: 'policy-1',
        links: [{ linked_record_type: 'CLAIM', linked_record_id: 'claim-1' }],
      },
      [],
      true,
    );
    await service.downloadForUser(user, 'document-1', actor);
    expect(download).toHaveBeenCalled();
  });
  it('denies a policy document outside policy scope', async () => {
    const { service, download, accessEvents } = setup(
      {
        id: 'document-1',
        company_id: 'company-1',
        owner_type: 'POLICY',
        owner_id: 'policy-1',
        links: [],
      },
      [],
    );
    await expect(
      service.downloadForUser(user, 'document-1', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(download).not.toHaveBeenCalled();
    expect(accessEvents.save).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'FAILED',
        failure_reason: 'RESOURCE_SCOPE_DENIED',
      }),
    );
  });
});
