import { BillingCommissionService } from './billing-commission.service';

describe('Quotation payment transaction scope', () => {
  function setup() {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const service: BillingCommissionService = Object.create(
      BillingCommissionService.prototype,
    );
    Reflect.set(service, 'paymentTransactionRepository', {
      createQueryBuilder: () => qb,
    });
    return { service, qb };
  }

  it('combines quotation and tenant scope before pagination and filtering', async () => {
    const { service, qb } = setup();
    const result = await service.findPaymentTransactions('tenant-a', {
      quotation_id: 'quotation-a',
      status: 'SETTLED',
      page: 2,
      limit: 10,
    });
    expect(qb.where).toHaveBeenCalledWith('payment.company_id = :companyId', {
      companyId: 'tenant-a',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'invoice.quotation_id = :quotationId',
      { quotationId: 'quotation-a' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'UPPER(payment.status) = :status',
      { status: 'SETTLED' },
    );
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(result.pagination.total).toBe(0);
  });

  it('retains the unfiltered finance list when no quotation is selected', async () => {
    const { service, qb } = setup();
    await service.findPaymentTransactions('tenant-a', {});
    expect(qb.where).toHaveBeenCalledWith('payment.company_id = :companyId', {
      companyId: 'tenant-a',
    });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});
