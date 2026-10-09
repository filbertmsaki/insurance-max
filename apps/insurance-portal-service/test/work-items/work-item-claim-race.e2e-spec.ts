import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { WorkItemsService } from '../../src/modules/tenant/work-items/work-items.service';

jest.setTimeout(180_000);

/** Two users claiming one work item at the same moment: exactly one wins. */
describe('Work item claim race (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let workItems: WorkItemsService;

  const companyId = randomUUID();

  const user = () =>
    ({
      id: randomUUID(),
      scope: 'company',
      companyId,
      companyType: 'INSURANCE_COMPANY',
      companyMembershipId: randomUUID(),
      roles: ['CLAIMS_OFFICER'],
      permissions: [],
      userType: 'STAFF',
      quotationPolicyDataScope: 'COMPANY',
      assignedBranchIds: [],
      activeBranchId: null,
    }) as any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    workItems = app.get(WorkItemsService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lets exactly one of two concurrent claims win', async () => {
    for (let round = 0; round < 5; round += 1) {
      const item = await workItems.create({
        companyId,
        domain: 'claims',
        resourceType: 'claim',
        resourceId: randomUUID(),
        title: `Claim race ${round}`,
        assignedRole: 'CLAIMS_OFFICER',
      });
      const [alice, bob] = [user(), user()];

      const results = await Promise.allSettled([
        workItems.claim(alice, item.id),
        workItems.claim(bob, item.id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      const [stored] = await dataSource.query(
        `SELECT assigned_user_id FROM work_items WHERE id = $1`,
        [item.id],
      );
      const winner = (fulfilled[0] as PromiseFulfilledResult<any>).value;
      expect(stored.assigned_user_id).toBe(winner.assigned_user_id);

      const [{ count }] = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM work_item_events
         WHERE work_item_id = $1 AND event_type = 'CLAIMED'`,
        [item.id],
      );
      expect(count).toBe(1);
    }
  });
});
