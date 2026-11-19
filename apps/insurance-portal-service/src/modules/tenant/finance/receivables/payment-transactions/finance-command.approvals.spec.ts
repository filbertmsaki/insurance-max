import { ConflictException } from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinanceCommandService } from './finance-command.service';

const admin = {
  id: 'same-person',
  companyId: 'company-1',
  roles: ['COMPANY_ADMIN'],
  permissions: ['refunds:approve', 'commissions:approve'],
} as AuthenticatedUser;

function commandWith(record: Record<string, unknown>) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(record),
  };
  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    save: jest.fn(),
  };
  const manager = { getRepository: jest.fn().mockReturnValue(repo) };
  const dataSource = {
    transaction: jest.fn(
      async (work: (value: typeof manager) => Promise<unknown>) =>
        work(manager),
    ),
  };
  const command = Object.create(
    FinanceCommandService.prototype,
  ) as FinanceCommandService;
  Reflect.set(command, 'dataSource', dataSource);
  return { command, repo };
}

describe('Finance maker-checker separation', () => {
  it('rejects a company administrator approving their own refund', async () => {
    const { command, repo } = commandWith({
      status: 'REQUESTED',
      requested_by: admin.id,
    });
    await expect(
      command.approveRefund(admin, 'refund-1', {} as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects a company administrator approving their own commission accrual', async () => {
    const { command, repo } = commandWith({
      status: 'ACCRUED',
      accrued_by: admin.id,
    });
    await expect(
      command.approveCommissionAccrual(admin, 'accrual-1', {} as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects a company administrator approving their own commission payment', async () => {
    const { command, repo } = commandWith({
      status: 'DRAFT',
      submitted_by: admin.id,
    });
    await expect(
      command.approveCommissionPayment(admin, 'payment-1', {} as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
