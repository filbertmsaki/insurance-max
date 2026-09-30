import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { RenewalQuotationFactoryService } from './renewal-quotation-factory.service';

describe('RenewalQuotationFactoryService', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;
  const policy = {
    id: 'policy-1',
    quotation_id: 'quotation-1',
  } as any;
  const params = {
    policy,
    version: { id: 'version-1' } as any,
    renewalStartDate: '2027-01-01',
    renewalEndDate: '2027-12-31',
    previousCoverNoteReference: 'CN-OLD',
  };

  function build(quotationFlow: QuotationFlow, query = jest.fn()) {
    const dataSource = { manager: { query } };
    const quotationsService = {
      createDraft: jest.fn(async () => ({ id: 'quotation-2' })),
    };
    const contextService = {
      buildDraftContext: jest.fn(() => ({
        quotationFlow,
        dto: { quotation_flow: quotationFlow },
      })),
    };
    const service = new RenewalQuotationFactoryService(
      dataSource as any,
      quotationsService as any,
      contextService as any,
    );

    return { service, query, quotationsService };
  }

  it('copies the non-motor risk details onto the renewal quotation', async () => {
    const { service, query } = build(QuotationFlow.NON_MOTOR);

    const quotation = await service.create(user, params);

    expect(quotation).toEqual({ id: 'quotation-2' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain(
      'INSERT INTO quotation_non_motor_details',
    );
    expect(query.mock.calls[0][1]).toEqual([
      'company-1',
      'policy-1',
      'quotation-1',
      'quotation-2',
      'user-1',
    ]);
  });

  it('does not copy risk details for motor renewals', async () => {
    const { service, query } = build(QuotationFlow.MOTOR_SINGLE);

    await service.create(user, params);

    expect(query).not.toHaveBeenCalled();
  });

  it('still returns the renewal quotation when copying fails', async () => {
    const { service } = build(
      QuotationFlow.NON_MOTOR,
      jest.fn(() => Promise.reject(new Error('boom'))),
    );

    await expect(service.create(user, params)).resolves.toEqual({
      id: 'quotation-2',
    });
  });
});
