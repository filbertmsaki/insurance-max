import { ClaimStatus } from '../enums/claim.enums';
import { ClaimSettlementService } from './claim-settlement.service';

function harness(params: {
  status: ClaimStatus;
  approved: string;
  paid: string;
  openPayments: number;
  paidPayments: number;
  acceptedByTira: number;
}) {
  const claim = {
    id: 'claim-1',
    status: params.status,
    approved_amount: params.approved,
    paid_amount: params.paid,
    state_version: 3,
  };
  let paymentCountCall = 0;
  const manager = {
    getRepository: jest.fn((entity: any) => {
      switch (entity.name) {
        case 'InsuranceClaim':
          return {
            createQueryBuilder: () => ({
              setLock: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOneOrFail: jest.fn(async () => claim),
            }),
            update: jest.fn(),
          };
        case 'ClaimPayment':
          return {
            count: jest.fn(async () =>
              paymentCountCall++ === 0 ? params.openPayments : 0,
            ),
            find: jest.fn(async () =>
              Array.from({ length: params.paidPayments }, (_, i) => ({
                id: `p${i}`,
              })),
            ),
          };
        default:
          return { count: jest.fn(async () => params.acceptedByTira) };
      }
    }),
  };
  const stateMachine = { transition: jest.fn() };
  const service = new ClaimSettlementService(
    { transaction: jest.fn(async (fn: any) => fn(manager)) } as any,
    stateMachine as any,
  );

  return { service, stateMachine };
}

describe('ClaimSettlementService', () => {
  const base = {
    status: ClaimStatus.PAID,
    approved: '1000.00',
    paid: '1000.00',
    openPayments: 0,
    paidPayments: 2,
    acceptedByTira: 2,
  };

  it('settles a fully paid claim once TIRA accepted every payment', async () => {
    const { service, stateMachine } = harness(base);

    await expect(service.settleIfComplete('claim-1')).resolves.toBe(true);
    expect(stateMachine.transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ClaimStatus.SETTLED,
      expect.anything(),
    );
  });

  it('waits for TIRA to accept every payment', async () => {
    const { service, stateMachine } = harness({ ...base, acceptedByTira: 1 });

    await expect(service.settleIfComplete('claim-1')).resolves.toBe(false);
    expect(stateMachine.transition).not.toHaveBeenCalled();
  });

  it('does not settle a partially paid claim', async () => {
    const { service } = harness({
      ...base,
      status: ClaimStatus.PARTIALLY_PAID,
      paid: '500.00',
    });

    await expect(service.settleIfComplete('claim-1')).resolves.toBe(false);
  });

  it('does not settle while a payment is still in flight', async () => {
    const { service } = harness({ ...base, openPayments: 1 });

    await expect(service.settleIfComplete('claim-1')).resolves.toBe(false);
  });
});
