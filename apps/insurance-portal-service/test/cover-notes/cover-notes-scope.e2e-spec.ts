import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { CoverNotesService } from '../../src/modules/tenant/cover-notes/cover-notes.service';

jest.setTimeout(180_000);

/** Runs the scoped cover-note query (join + quotation scope) for real. */
describe('Cover notes scoped reads (real database)', () => {
  let app: INestApplication;
  let coverNotes: CoverNotesService;

  const user = (overrides: Record<string, unknown>) =>
    ({
      id: randomUUID(),
      scope: 'company',
      companyId: randomUUID(),
      companyType: 'INSURANCE_COMPANY',
      companyMembershipId: randomUUID(),
      roles: [],
      permissions: [],
      userType: 'STAFF',
      quotationPolicyDataScope: 'COMPANY',
      assignedBranchIds: [],
      activeBranchId: null,
      ...overrides,
    }) as any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    coverNotes = app.get(CoverNotesService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['company-wide', {}],
    [
      'branch-scoped',
      {
        quotationPolicyDataScope: 'BRANCH',
        assignedBranchIds: [randomUUID()],
      },
    ],
    ['own-records', { quotationPolicyDataScope: 'USER' }],
  ])('executes the %s list and detail queries', async (_label, overrides) => {
    const viewer = user(overrides);

    await expect(
      coverNotes.findAll(viewer, {
        policyId: randomUUID(),
        quotationId: randomUUID(),
      }),
    ).resolves.toEqual([]);
    await expect(
      coverNotes.findOne(viewer, randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
