import { BadRequestException, ConflictException } from '@nestjs/common';

import { ClaimDischargeStatus } from '../enums/claim.enums';
import { ClaimDischargeService } from './claim-discharge.service';

function harness(voucher: Record<string, unknown>) {
  const claim = {
    id: 'claim-1',
    currency_code: 'TZS',
    approved_amount: '900000.00',
    paid_amount: '100000.00',
  };
  const manager = {
    getRepository: jest.fn(() => ({
      save: jest.fn(async (value: unknown) => value),
    })),
  };
  const dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) };
  const access = {
    getRecordForWrite: jest.fn(async () => ({ record: voucher, claim })),
  };
  const claims = {
    activeClaimants: jest.fn(async () => [
      {
        id: 'claimant-1',
        full_name: 'Asha Juma',
        claimant_category: 1,
        party_type: 1,
        id_type: 1,
        identification_number: 'NIN-1',
      },
      {
        id: 'claimant-2',
        full_name: 'Juma Hassan',
        claimant_category: 2,
        party_type: 1,
        id_type: 3,
        identification_number: 'P-2',
      },
    ]),
  };
  const stateMachine = { recordEvent: jest.fn() };
  const payload = {
    identityClaimant: jest.fn((claimant: any) => ({
      claimantIdNumber: claimant.identification_number,
    })),
  };
  const service = new ClaimDischargeService(
    dataSource as any,
    access as any,
    claims as any,
    {} as any,
    stateMachine as any,
    {} as any,
    payload as any,
    {} as any,
    {} as any,
  );

  return { service, stateMachine };
}

const draft = () => ({
  id: 'voucher-1',
  discharge_voucher_number: 'DV-2026-00001',
  status: ClaimDischargeStatus.DRAFT,
  claim_offer_amount: '800000.00',
  currency_code: 'TZS',
  claimant_id: null,
  claimants: [],
});

describe('ClaimDischargeService.update', () => {
  it('changes the offer and claimant of a draft voucher', async () => {
    const voucher = draft();
    const { service, stateMachine } = harness(voucher);

    const saved = await service.update({ id: 'user-1' } as any, 'voucher-1', {
      claim_offer_amount: '750000.00',
      claimant_id: 'claimant-2',
    });

    expect(saved).toMatchObject({
      claim_offer_amount: '750000.00',
      claimant_id: 'claimant-2',
      claimants: [{ claimantIdNumber: 'P-2' }],
    });
    expect(stateMachine.recordEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ eventType: 'DISCHARGE_UPDATED' }),
    );
  });

  it('keeps the offer within the outstanding approved amount', async () => {
    const { service } = harness(draft());

    await expect(
      service.update({ id: 'user-1' } as any, 'voucher-1', {
        claim_offer_amount: '850000.00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses to edit an issued voucher', async () => {
    const { service } = harness({
      ...draft(),
      status: ClaimDischargeStatus.SENT_TO_CLAIMANT,
    });

    await expect(
      service.update({ id: 'user-1' } as any, 'voucher-1', {
        claim_offer_amount: '700000.00',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
