import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { NotificationsService } from '../../src/modules/tenant/work-items/notifications.service';

jest.setTimeout(180_000);

/**
 * Notifications are read and acted on through one visibility rule. These
 * run the real query against PostgreSQL, so the Brackets/OR precedence is
 * what is actually tested.
 */
describe('Notification visibility (real database)', () => {
  let app: INestApplication;
  let notifications: NotificationsService;

  // Notifications carry no foreign keys, so a fresh company id isolates
  // this run from everything else in the database.
  const companyId = randomUUID();
  const branchA = randomUUID();
  const branchB = randomUUID();

  const user = (overrides: Record<string, unknown>) =>
    ({
      id: randomUUID(),
      scope: 'company',
      companyId,
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

  const alice = user({ roles: ['UNDERWRITER'] });
  const bob = user({ roles: ['CLAIMS_MANAGER'] });
  const branchUser = user({
    quotationPolicyDataScope: 'BRANCH',
    assignedBranchIds: [branchA],
    activeBranchId: branchA,
  });

  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    notifications = app.get(NotificationsService);

    const make = async (key: string, params: Record<string, unknown>) => {
      const row = await notifications.create({
        companyId,
        type: 'E2E',
        title: key,
        message: key,
        ...params,
      });
      ids[key] = row.id;
    };

    await make('forAlice', { recipientUserId: alice.id });
    await make('forBob', { recipientUserId: bob.id });
    await make('broadcast', {});
    await make('claimsManagers', { recipientRole: 'CLAIMS_MANAGER' });
    await make('branchA', { branchId: branchA });
    await make('branchB', { branchId: branchB });
  });

  afterAll(async () => {
    await app?.close();
  });

  const titles = async (viewer: any) =>
    (await notifications.listForUser(viewer)).map((n) => n.title).sort();

  it('shows a user their own, broadcast and role-matching notifications only', async () => {
    expect(await titles(alice)).toEqual(
      ['branchA', 'branchB', 'broadcast', 'forAlice'].sort(),
    );
    expect(await titles(bob)).toEqual(
      ['branchA', 'branchB', 'broadcast', 'claimsManagers', 'forBob'].sort(),
    );
  });

  it('keeps branch notifications inside the branch scope', async () => {
    const visible = await titles(branchUser);

    expect(visible).toContain('branchA');
    expect(visible).not.toContain('branchB');
  });

  it("refuses to mark or dismiss another user's notification", async () => {
    await expect(
      notifications.markRead(alice, ids.forBob),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      notifications.dismiss(alice, ids.forBob),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses role-targeted notifications to users without the role', async () => {
    await expect(
      notifications.markRead(alice, ids.claimsManagers),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      notifications.markRead(bob, ids.claimsManagers),
    ).resolves.toMatchObject({ id: ids.claimsManagers });
  });

  it('refuses another branch notification to a branch-scoped user', async () => {
    await expect(
      notifications.dismiss(branchUser, ids.branchB),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses notifications from another company', async () => {
    const outsider = user({ companyId: randomUUID() });

    await expect(
      notifications.markRead(outsider, ids.broadcast),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the recipient mark their own notification read', async () => {
    const updated = await notifications.markRead(alice, ids.forAlice);

    expect(updated.read_at).toBeInstanceOf(Date);
  });
});
