import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClaimRecoveryStatus, ClaimStatus } from '../enums/claim.enums';
import { ClaimRecoveryService } from './claim-recovery.service';

const user = { id: 'user-1', companyId: 'company-1' } as any;

function makeRecovery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'recovery-1',
    company_id: 'company-1',
    claim_id: 'claim-1',
    recovery_no: 'RCV-2026-00001',
    recovery_type: 'SALVAGE',
    expected_amount: '1000.00',
    received_amount: '0.00',
    status: ClaimRecoveryStatus.REQUESTED,
    notes: null,
    ...overrides,
  } as any;
}

function makeHarness(params: {
  recovery?: any;
  claim?: any;
  outOfScope?: boolean;
}) {
  const claim = params.claim ?? {
    id: 'claim-1',
    company_id: 'company-1',
    status: ClaimStatus.APPROVED,
    currency_code: 'TZS',
  };

  const recoveryRepo = {
    save: jest.fn().mockImplementation(async (value) => ({
      id: value.id ?? 'recovery-new',
      ...value,
    })),
  };
  const eventRepo = {
    save: jest
      .fn()
      .mockImplementation(async (value) => ({ id: 'event-1', ...value })),
  };

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'ClaimRecovery':
          return recoveryRepo;
        case 'ClaimEvent':
          return eventRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const listRepo = {
    find: jest.fn().mockResolvedValue([]),
  } as any;

  const scopeDenied = () =>
    Promise.reject(new NotFoundException('Claim not found'));
  const claimAccess = {
    getForWrite: jest.fn(() =>
      params.outOfScope ? scopeDenied() : Promise.resolve(claim),
    ),
    getForRead: jest.fn(() =>
      params.outOfScope ? scopeDenied() : Promise.resolve(claim),
    ),
    getRecordForWrite: jest.fn(() =>
      params.outOfScope
        ? scopeDenied()
        : params.recovery
          ? Promise.resolve({ record: params.recovery, claim })
          : Promise.reject(new NotFoundException('Claim recovery not found')),
    ),
  } as any;

  const referenceService = {
    next: jest.fn().mockResolvedValue('RCV-2026-00001'),
  } as any;
  const financeJournalService = {
    postClaimRecoveryReceipt: jest.fn().mockResolvedValue(undefined),
  } as any;
  const financialProjectionService = {
    recalculate: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new ClaimRecoveryService(
    dataSource,
    listRepo,
    referenceService,
    claimAccess,
    financeJournalService,
    financialProjectionService,
  );

  return {
    service,
    claimAccess,
    recoveryRepo,
    eventRepo,
    listRepo,
    financeJournalService,
    financialProjectionService,
  };
}

describe('ClaimRecoveryService', () => {
  describe('create', () => {
    it('creates an EXPECTED recovery through the claim write scope', async () => {
      const h = makeHarness({});

      const recovery = await h.service.create(user, 'claim-1', {
        recovery_type: 'SALVAGE' as any,
        expected_amount: '1500.5',
        notes: '  scrap buyer  ',
      });

      expect(h.claimAccess.getForWrite).toHaveBeenCalledWith(
        user,
        'claim-1',
        expect.anything(),
      );
      expect(recovery).toMatchObject({
        status: ClaimRecoveryStatus.EXPECTED,
        expected_amount: '1500.50',
        received_amount: '0.00',
        notes: 'scrap buyer',
      });
      expect(h.financialProjectionService.recalculate).toHaveBeenCalledWith(
        expect.anything(),
        'claim-1',
      );
    });

    it.each([ClaimStatus.DRAFT, ClaimStatus.REJECTED, ClaimStatus.CANCELLED])(
      'refuses recoveries on a %s claim',
      async (status) => {
        const h = makeHarness({
          claim: { id: 'claim-1', company_id: 'company-1', status },
        });

        await expect(
          h.service.create(user, 'claim-1', {
            recovery_type: 'SALVAGE' as any,
            expected_amount: '100',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(h.recoveryRepo.save).not.toHaveBeenCalled();
      },
    );

    it('allows recoveries on a closed claim (post-settlement salvage)', async () => {
      const h = makeHarness({
        claim: {
          id: 'claim-1',
          company_id: 'company-1',
          status: ClaimStatus.CLOSED,
        },
      });

      await expect(
        h.service.create(user, 'claim-1', {
          recovery_type: 'SUBROGATION' as any,
          expected_amount: '100',
        }),
      ).resolves.toMatchObject({ status: ClaimRecoveryStatus.EXPECTED });
    });

    it('rejects a zero expected amount before touching the database', async () => {
      const h = makeHarness({});

      await expect(
        h.service.create(user, 'claim-1', {
          recovery_type: 'SALVAGE' as any,
          expected_amount: '0',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.claimAccess.getForWrite).not.toHaveBeenCalled();
    });
  });

  describe('recordReceipt', () => {
    it('records a partial receipt, keeps notes and posts a cash journal', async () => {
      const recovery = makeRecovery();
      const h = makeHarness({ recovery });

      const result = await h.service.recordReceipt(
        user,
        'recovery-1',
        '400.10',
        ' EFT 123 ',
      );

      expect(result.status).toBe(ClaimRecoveryStatus.PARTIALLY_RECEIVED);
      expect(result.received_amount).toBe('400.10');
      expect(result.notes).toBe('Receipt 400.10: EFT 123');
      expect(h.eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'RECOVERY_RECEIPT_RECORDED',
          metadata: { received_amount: '400.10', notes: 'EFT 123' },
        }),
      );
      expect(
        h.financeJournalService.postClaimRecoveryReceipt,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          recoveryId: 'recovery-1',
          amount: '400.10',
          currencyCode: 'TZS',
        }),
        'recovery-receipt:event-1',
        'user-1',
      );
    });

    it('moves to RECEIVED once receipts reach the expected amount', async () => {
      const recovery = makeRecovery({
        status: ClaimRecoveryStatus.PARTIALLY_RECEIVED,
        received_amount: '600.00',
      });
      const h = makeHarness({ recovery });

      const result = await h.service.recordReceipt(user, 'recovery-1', '400');

      expect(result.status).toBe(ClaimRecoveryStatus.RECEIVED);
      expect(result.received_amount).toBe('1000.00');
    });

    it('sums cents exactly (0.10 + 0.20 is not 0.30000000000000004)', async () => {
      const recovery = makeRecovery({
        expected_amount: '0.30',
        received_amount: '0.10',
        status: ClaimRecoveryStatus.PARTIALLY_RECEIVED,
      });
      const h = makeHarness({ recovery });

      const result = await h.service.recordReceipt(user, 'recovery-1', '0.20');

      expect(result.received_amount).toBe('0.30');
      expect(result.status).toBe(ClaimRecoveryStatus.RECEIVED);
    });

    it('rejects a receipt above the outstanding amount', async () => {
      const recovery = makeRecovery({ received_amount: '900.00' });
      const h = makeHarness({ recovery });

      await expect(
        h.service.recordReceipt(user, 'recovery-1', '100.01'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        h.financeJournalService.postClaimRecoveryReceipt,
      ).not.toHaveBeenCalled();
    });

    it('rejects a zero receipt', async () => {
      const h = makeHarness({ recovery: makeRecovery() });

      await expect(
        h.service.recordReceipt(user, 'recovery-1', '0'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([
      ClaimRecoveryStatus.EXPECTED,
      ClaimRecoveryStatus.RECEIVED,
      ClaimRecoveryStatus.WRITTEN_OFF,
      ClaimRecoveryStatus.CANCELLED,
    ])('refuses a receipt from %s', async (status) => {
      const h = makeHarness({ recovery: makeRecovery({ status }) });

      await expect(
        h.service.recordReceipt(user, 'recovery-1', '10'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('denies a recovery whose claim is outside the caller scope', async () => {
      const h = makeHarness({ recovery: makeRecovery(), outOfScope: true });

      await expect(
        h.service.recordReceipt(user, 'recovery-1', '10'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.recoveryRepo.save).not.toHaveBeenCalled();
      expect(
        h.financeJournalService.postClaimRecoveryReceipt,
      ).not.toHaveBeenCalled();
    });
  });

  describe('transitions', () => {
    it('requests an EXPECTED recovery', async () => {
      const h = makeHarness({
        recovery: makeRecovery({ status: ClaimRecoveryStatus.EXPECTED }),
      });

      await expect(
        h.service.request(user, 'recovery-1'),
      ).resolves.toMatchObject({ status: ClaimRecoveryStatus.REQUESTED });
    });

    it('refuses to request a recovery twice', async () => {
      const h = makeHarness({ recovery: makeRecovery() });

      await expect(
        h.service.request(user, 'recovery-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('writes off a partially received recovery and records the reason', async () => {
      const h = makeHarness({
        recovery: makeRecovery({
          status: ClaimRecoveryStatus.PARTIALLY_RECEIVED,
          received_amount: '250.00',
          notes: 'initial',
        }),
      });

      const result = await h.service.writeOff(
        user,
        'recovery-1',
        '  debtor insolvent ',
      );

      expect(result.status).toBe(ClaimRecoveryStatus.WRITTEN_OFF);
      expect(result.notes).toBe('initial | Written off: debtor insolvent');
      expect(result.received_amount).toBe('250.00');
      expect(h.financialProjectionService.recalculate).toHaveBeenCalled();
      expect(
        h.financeJournalService.postClaimRecoveryReceipt,
      ).not.toHaveBeenCalled();
    });

    it('requires a write-off reason', async () => {
      const h = makeHarness({ recovery: makeRecovery() });

      await expect(
        h.service.writeOff(user, 'recovery-1', '   '),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to write off an EXPECTED recovery (cancel it instead)', async () => {
      const h = makeHarness({
        recovery: makeRecovery({ status: ClaimRecoveryStatus.EXPECTED }),
      });

      await expect(
        h.service.writeOff(user, 'recovery-1', 'reason'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([ClaimRecoveryStatus.EXPECTED, ClaimRecoveryStatus.REQUESTED])(
      'cancels from %s',
      async (status) => {
        const h = makeHarness({ recovery: makeRecovery({ status }) });

        await expect(
          h.service.cancel(user, 'recovery-1'),
        ).resolves.toMatchObject({ status: ClaimRecoveryStatus.CANCELLED });
      },
    );

    it('refuses to cancel once money has been received', async () => {
      const h = makeHarness({
        recovery: makeRecovery({
          status: ClaimRecoveryStatus.PARTIALLY_RECEIVED,
        }),
      });

      await expect(h.service.cancel(user, 'recovery-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('denies transitions on an out-of-scope claim', async () => {
      const h = makeHarness({ recovery: makeRecovery(), outOfScope: true });

      await expect(h.service.cancel(user, 'recovery-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(h.recoveryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('lists only after the claim passes the read scope', async () => {
      const h = makeHarness({ outOfScope: true });

      await expect(h.service.findAll(user, 'claim-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(h.listRepo.find).not.toHaveBeenCalled();
    });
  });
});
