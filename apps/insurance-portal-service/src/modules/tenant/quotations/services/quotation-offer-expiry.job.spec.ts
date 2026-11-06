import { QuotationOfferExpiryJob } from './quotation-offer-expiry.job';

describe('quotation offer expiry job', () => {
  it('requests locked due-only transitions for scoped candidates and continues on errors', async () => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 'q1', company_id: 'c1' },
        { id: 'q2', company_id: 'c2' },
      ]),
    };
    const lifecycle = {
      expireQuotation: jest
        .fn()
        .mockRejectedValueOnce(new Error('conflict'))
        .mockResolvedValueOnce(undefined),
    };
    const job = new QuotationOfferExpiryJob(
      { createQueryBuilder: () => builder } as any,
      lifecycle as any,
    );
    await job.expireDueOffers();
    expect(lifecycle.expireQuotation).toHaveBeenCalledTimes(2);
    expect(lifecycle.expireQuotation).toHaveBeenLastCalledWith(
      'c2',
      'q2',
      expect.objectContaining({ source: 'SYSTEM' }),
      { onlyWhenDue: true },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'quotation.tira_status = :tira',
      { tira: 'NOT_SUBMITTED' },
    );
  });
});
