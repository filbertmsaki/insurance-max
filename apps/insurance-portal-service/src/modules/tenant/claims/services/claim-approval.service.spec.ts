import { ForbiddenException } from '@nestjs/common';

import { ClaimApprovalStatus, ClaimApprovalType } from '../enums/claim.enums';
import { ClaimApprovalService } from './claim-approval.service';

const MANAGER_ROLE = 'role-manager';
const SENIOR_ROLE = 'role-senior';

function limit(level: number, roleId: string, min: string, max: string | null) {
  return {
    id: `limit-${level}`,
    company_id: 'company-1',
    approval_type: ClaimApprovalType.ASSESSMENT,
    level,
    role_id: roleId,
    user_id: null,
    insurance_category_id: null,
    product_id: null,
    branch_id: null,
    min_amount: min,
    max_amount: max,
    currency_code: 'TZS',
    is_active: true,
  };
}

function harness(limits: any[], roleIds: string[]) {
  const approvals: any[] = [];
  const approvalRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ round: 0 }),
      getOne: jest
        .fn()
        .mockImplementation(
          async () =>
            approvals
              .filter((row) => row.status === ClaimApprovalStatus.PENDING)
              .sort((a, b) => a.level - b.level)[0],
        ),
    })),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      if (Array.isArray(value)) {
        approvals.push(...value);
        return value;
      }
      return value;
    }),
    find: jest.fn(async () => approvals),
  };
  const manager = {
    getRepository: jest.fn((entity: any) => {
      if (entity.name === 'ClaimApproval') return approvalRepo;
      if (entity.name === 'ClaimApprovalLimit')
        return { find: jest.fn(async () => limits) };
      return {
        findOne: jest.fn(async () => ({
          id: 'policy-1',
          product_id: 'p',
          category_id: 'c',
        })),
      };
    }),
    query: jest.fn(async (sql: string) =>
      sql.includes('FROM roles')
        ? roleIds.map((id) => ({ id }))
        : [
            {
              first_name: 'Neema',
              last_name: 'Mushi',
              officer_title: 'Claims Manager',
            },
          ],
    ),
  } as any;
  const stateMachine = { recordEvent: jest.fn() };
  const audit = { logCritical: jest.fn(), log: jest.fn() };
  const service = new ClaimApprovalService(
    approvalRepo as any,
    {} as any,
    stateMachine as any,
    audit as any,
  );

  return { service, manager, approvals, audit };
}

const claim = {
  id: 'claim-1',
  company_id: 'company-1',
  policy_id: 'policy-1',
  branch_id: 'branch-1',
  exchange_rate: '1',
} as any;

function subject(amount: string) {
  return {
    claim,
    subjectType: 'ASSESSMENT',
    subjectId: 'assessment-1',
    approvalType: ClaimApprovalType.ASSESSMENT,
    amount,
    currencyCode: 'TZS',
  };
}

const user = (id: string, roles: string[] = ['CLAIMS_MANAGER']) =>
  ({
    id,
    companyId: 'company-1',
    email: `${id}@x.tz`,
    roles,
    permissions: [],
  }) as any;

describe('ClaimApprovalService', () => {
  const matrix = [
    limit(1, MANAGER_ROLE, '0', '5000000'),
    limit(2, SENIOR_ROLE, '5000000.01', null),
  ];

  it('requires one level when nothing is configured', async () => {
    const { service, manager } = harness([], []);
    const rows = await service.submit(manager, subject('100.00'), 'maker');

    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe(1);
  });

  it('escalates amounts above a band to every level up to it', async () => {
    const { service, manager } = harness(matrix, [MANAGER_ROLE]);

    const small = await service.submit(manager, subject('1000000.00'), 'maker');
    expect(small.map((row) => row.level)).toEqual([1]);

    const { service: second, manager: secondManager } = harness(matrix, [
      MANAGER_ROLE,
    ]);
    const large = await second.submit(
      secondManager,
      subject('9000000.00'),
      'maker',
    );
    expect(large.map((row) => row.level)).toEqual([1, 2]);
  });

  it('blocks the maker from approving their own item', async () => {
    const { service, manager } = harness(matrix, [MANAGER_ROLE]);
    await service.submit(manager, subject('1000000.00'), 'maker');

    await expect(
      service.approve(manager, user('maker'), subject('1000000.00')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks an approver whose authority does not cover the amount', async () => {
    const { service, manager } = harness(matrix, [MANAGER_ROLE]);
    await service.submit(manager, subject('9000000.00'), 'maker');

    // Level 1 is fine for the manager...
    const first = await service.approve(
      manager,
      user('manager'),
      subject('9000000.00'),
    );
    expect(first.completed).toBe(false);

    // ...but level 2 needs the senior role.
    await expect(
      service.approve(manager, user('manager-2'), subject('9000000.00')),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CLAIM_APPROVAL_LIMIT_EXCEEDED',
      }),
    });
  });

  it('completes when the final level approves and names the authority', async () => {
    const { service, manager } = harness(matrix, [MANAGER_ROLE]);
    await service.submit(manager, subject('1000000.00'), 'maker');

    const outcome = await service.approve(
      manager,
      user('manager'),
      subject('1000000.00'),
    );

    expect(outcome.completed).toBe(true);
    expect(outcome.authority).toBe('Claims Manager - Neema Mushi');
  });

  it('lets a company administrator override and audits it', async () => {
    const { service, manager, audit } = harness(matrix, []);
    await service.submit(manager, subject('1000000.00'), 'admin');

    const outcome = await service.approve(
      manager,
      user('admin', ['INSURANCE_ADMIN']),
      subject('1000000.00'),
    );

    expect(outcome.approval.admin_override).toBe(true);
    expect(audit.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'claim.approval.admin_override' }),
      manager,
    );
  });
});
