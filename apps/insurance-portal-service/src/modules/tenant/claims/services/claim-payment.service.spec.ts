import { BadRequestException, ConflictException } from '@nestjs/common';

import { ClaimDischargeStatus, ClaimStatus } from '../enums/claim.enums';
import { ClaimPaymentService } from './claim-payment.service';

function harness(params: { claim: any; voucher: any; committed: string }) {
  const saved: any[] = [];
  const manager = {
    getRepository: jest.fn((entity: any) => {
      switch (entity.name) {
        case 'ClaimDischargeVoucher':
          return { findOne: jest.fn(async () => params.voucher) };
        case 'ClaimPayment':
          return {
            createQueryBuilder: () => ({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn(async () => ({ total: params.committed })),
            }),
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => {
              saved.push(value);
              return { ...value, id: 'payment-1' };
            }),
          };
        case 'ClaimIntimation':
          return { findOne: jest.fn(async () => ({ claim_intimation_number: 'INT-1' })) };
        case 'Policy':
          return {
            findOne: jest.fn(async () => ({
              net_premium: '100000',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
            })),
          };
        default:
          return {};
      }
    }),
  };
  const dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) };
  const access = { getForWrite: jest.fn(async () => params.claim) };
  const claims = {
    activeClaimants: jest.fn(async () => [
      {
        id: 'claimant-1',
        is_primary: true,
        full_name: 'Asha Juma',
        claimant_category: 1,
        party_type: 1,
        id_type: 1,
        identification_number: 'NIN-1',
      },
    ]),
  };
  const reference = { next: jest.fn(async () => 'CP-2026-00001') };
  const stateMachine = { transition: jest.fn(), recordEvent: jest.fn() };
  const payload = {
    identityClaimant: jest.fn((claimant: any) => ({ claimantIdNumber: claimant.identification_number })),
  };
  const service = new ClaimPaymentService(
    dataSource as any,
    access as any,
    claims as any,
    reference as any,
    stateMachine as any,
    {} as any,
    payload as any,
    {} as any,
  );

  return { service, saved, stateMachine };
}

const claim = (status: ClaimStatus) =>
  ({
    id: 'claim-1',
    company_id: 'company-1',
    policy_id: 'policy-1',
    status,
    approved_amount: '1000000.00',
    paid_amount: '0.00',
    currency_code: 'TZS',
    exchange_rate: '1',
  }) as any;

const voucher = (amount: string, reconciled: string | null = null) => ({
  id: 'voucher-1',
  status: ClaimDischargeStatus.ACCEPTED,
  claim_offer_amount: amount,
  reconciled_amount: reconciled,
});

const user = { id: 'officer', companyId: 'company-1' } as any;

describe('ClaimPaymentService.create', () => {
  it('refuses payments before the claimant accepted a voucher', async () => {
    const { service } = harness({
      claim: claim(ClaimStatus.APPROVED),
      voucher: voucher('1000000'),
      committed: '0',
    });

    await expect(
      service.create(user, 'claim-1', { paid_amount: '10.00', payment_mode: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents overpaying the accepted offer', async () => {
    const { service } = harness({
      claim: claim(ClaimStatus.DISCHARGE_ACCEPTED),
      voucher: voucher('800000.00'),
      committed: '0',
    });

    await expect(
      service.create(user, 'claim-1', { paid_amount: '800000.01', payment_mode: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts payments already in flight, so partial payments cannot add up to more', async () => {
    const { service } = harness({
      claim: claim(ClaimStatus.PARTIALLY_PAID),
      voucher: voucher('1000000.00'),
      committed: '700000.00',
    });

    await expect(
      service.create(user, 'claim-1', { paid_amount: '300000.01', payment_mode: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(user, 'claim-1', { paid_amount: '300000.00', payment_mode: 1 }),
    ).resolves.toMatchObject({ paid_amount: '300000.00' });
  });

  it('uses the reconciled amount when the voucher was reconciled', async () => {
    const { service } = harness({
      claim: claim(ClaimStatus.DISCHARGE_ACCEPTED),
      voucher: voucher('1000000.00', '600000.00'),
      committed: '0',
    });

    await expect(
      service.create(user, 'claim-1', { paid_amount: '600000.01', payment_mode: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('snapshots the payee as TIRA identity claimant and moves to PAYMENT_PENDING', async () => {
    const { service, saved, stateMachine } = harness({
      claim: claim(ClaimStatus.DISCHARGE_ACCEPTED),
      voucher: voucher('1000000.00'),
      committed: '0',
    });

    await service.create(user, 'claim-1', { paid_amount: '500000.00', payment_mode: 3 });

    expect(saved[0].claimants).toEqual([{ claimantIdNumber: 'NIN-1' }]);
    expect(saved[0].claim_intimation_number).toBe('INT-1');
    expect(stateMachine.transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ClaimStatus.PAYMENT_PENDING,
      expect.anything(),
    );
  });

  it('requires a reason when the claim went to litigation', async () => {
    const { service } = harness({
      claim: claim(ClaimStatus.DISCHARGE_ACCEPTED),
      voucher: voucher('1000000.00'),
      committed: '0',
    });

    await expect(
      service.create(user, 'claim-1', {
        paid_amount: '10.00',
        payment_mode: 3,
        claim_resulted_litigation: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
