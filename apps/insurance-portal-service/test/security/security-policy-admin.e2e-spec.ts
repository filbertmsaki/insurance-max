import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { SecurityPoliciesService } from '../../src/modules/shared/security-policies/security-policies.service';
import { SecurityPolicyAdminService } from '../../src/modules/shared/security-policies/security-policy-admin.service';

jest.setTimeout(180_000);

/** Company security policy versions: draft, second-person activation, retire. */
describe('Security policy administration (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: SecurityPolicyAdminService;
  let policies: SecurityPoliciesService;
  let companyId: string;

  const user = (overrides: Record<string, unknown> = {}) =>
    ({ id: randomUUID(), companyId, ...overrides }) as any;
  const drafter = user();
  const approver = user();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    admin = app.get(SecurityPolicyAdminService);
    policies = app.get(SecurityPoliciesService);

    const [company] = await dataSource.query(
      `INSERT INTO companies (name, slug, company_type, status)
       VALUES ($1, $2, 'INSURANCE_COMPANY', 'active') RETURNING id`,
      [`Policy Co ${randomUUID()}`, `policy-co-${randomUUID()}`],
    );
    companyId = company.id;
    drafter.companyId = companyId;
    approver.companyId = companyId;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('starts on the platform baseline with no company versions', async () => {
    const overview = await admin.overview(drafter);

    expect(overview.active_version_id).toBeNull();
    expect(overview.versions).toEqual([]);
    expect(overview.effective).toEqual(overview.baseline);
    expect(overview.effective).not.toHaveProperty('stepUpMaxAgeMinutes');
  });

  it('refuses activation by the author of the draft', async () => {
    const draft = await admin.createDraft(drafter, {
      two_factor: { require_for_roles: ['CLAIMS_MANAGER'] },
    });

    expect(draft).toMatchObject({ status: 'DRAFT', version_number: 1 });
    await expect(admin.activate(drafter, draft.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('activates a draft from another user and tightens the effective policy', async () => {
    const [draft] = (await admin.overview(drafter)).versions;

    const active = await admin.activate(approver, draft.id);

    expect(active).toMatchObject({
      status: 'ACTIVE',
      approved_by: approver.id,
    });
    const effective = await policies.getEffectivePolicy(companyId);
    expect(effective.requireTwoFactorForRoles).toContain('CLAIMS_MANAGER');
    expect(effective.requireTwoFactorForRoles).toContain('ADMINISTRATOR');
  });

  it('supersedes the previous active version on the next activation', async () => {
    const first = (await admin.overview(drafter)).active_version_id!;
    const second = await admin.createDraft(drafter, {
      two_factor: { require_for_all_users: true },
    });

    await admin.activate(approver, second.id);

    const overview = await admin.overview(drafter);
    expect(overview.active_version_id).toBe(second.id);
    const statuses = Object.fromEntries(
      overview.versions.map((version) => [version.id, version.status]),
    );
    expect(statuses[first]).toBe('SUPERSEDED');
    expect(statuses[second.id]).toBe('ACTIVE');
    expect(overview.effective.requireTwoFactorForAllUsers).toBe(true);
  });

  it('refuses to activate a draft twice', async () => {
    const active = (await admin.overview(drafter)).active_version_id!;

    await expect(admin.activate(approver, active)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('retires the active version so the baseline applies again', async () => {
    const active = (await admin.overview(drafter)).active_version_id!;

    await admin.retire(approver, active);

    const overview = await admin.overview(drafter);
    expect(overview.active_version_id).toBeNull();
    expect(overview.effective).toEqual(overview.baseline);
  });

  it('numbers concurrent drafts without collisions', async () => {
    const drafts = await Promise.all(
      [1, 2, 3].map(() => admin.createDraft(drafter, { two_factor: {} })),
    );

    const numbers = drafts.map((draft) => draft.version_number).sort();
    expect(new Set(numbers).size).toBe(3);
  });

  it("does not let one company act on another company's policy", async () => {
    const [draft] = (await admin.overview(drafter)).versions;
    const outsider = { id: randomUUID(), companyId: randomUUID() } as any;

    await expect(admin.activate(outsider, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
