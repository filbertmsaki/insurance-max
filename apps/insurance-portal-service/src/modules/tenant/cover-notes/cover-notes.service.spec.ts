import { ConflictException, NotFoundException } from '@nestjs/common';
import { PortalTiraSubmissionStatus } from '../tiramis-integration/enums/portal-tira-submission-status.enum';
import { CoverNotesService } from './cover-notes.service';

const user = { id: 'user-1', companyId: 'company-1' } as any;

function makeHarness(params: {
  quotation?: any;
  tracking?: any;
  alreadyIssued?: any;
  submission?: any;
  issued?: any;
  scopedRows?: any[];
}) {
  const builder: any = {
    innerJoin: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    getMany: jest.fn().mockResolvedValue(params.scopedRows ?? []),
    getOne: jest.fn().mockResolvedValue(params.scopedRows?.[0] ?? null),
  };
  const coverNoteRepository = {
    createQueryBuilder: jest.fn(() => builder),
    findOne: jest.fn().mockResolvedValue(params.alreadyIssued ?? null),
  };
  const trackingRepository = {
    findOne: jest.fn().mockResolvedValue(
      params.tracking === undefined
        ? {
            id: 'tracking-1',
            tiramisTransactionId: 'txn-1',
            tiramisRequestId: 'req-1',
            requestType: 'COVER_NOTE',
          }
        : params.tracking,
    ),
  };
  const portalSubmissionRepository = {
    findOne: jest.fn().mockResolvedValue(
      params.submission === undefined
        ? {
            id: 'submission-1',
            status: PortalTiraSubmissionStatus.FINAL_SUCCESS,
          }
        : params.submission,
    ),
  };
  const quotationsService = {
    findOneForUser: jest
      .fn()
      .mockResolvedValue(params.quotation ?? { tira_status: 'SUCCESS' }),
  };
  const issuanceService = {
    applyNotification: jest
      .fn()
      .mockResolvedValue(
        params.issued === undefined
          ? { coverNotes: [{ id: 'cn-1' }] }
          : params.issued,
      ),
  };
  const scope = { companyId: 'company-1' };
  const scopeService = {
    resolve: jest.fn().mockReturnValue(scope),
    applyQuotationReadScope: jest.fn(),
  };

  const service = new CoverNotesService(
    coverNoteRepository as any,
    trackingRepository as any,
    portalSubmissionRepository as any,
    quotationsService as any,
    issuanceService as any,
    scopeService as any,
  );

  return { service, builder, scopeService, issuanceService, scope };
}

describe('CoverNotesService', () => {
  describe('reads', () => {
    it('applies the quotation read scope to the joined quotation', async () => {
      const h = makeHarness({ scopedRows: [{ id: 'cn-1' }] });

      await h.service.findAll(user, { policyId: 'policy-1' });

      expect(h.builder.innerJoin).toHaveBeenCalledWith(
        'cover_note.quotation',
        'quotation',
      );
      expect(h.builder.where).toHaveBeenCalledWith(
        'cover_note.company_id = :coverNoteCompanyId',
        { coverNoteCompanyId: 'company-1' },
      );
      expect(h.scopeService.applyQuotationReadScope).toHaveBeenCalledWith(
        h.builder,
        'quotation',
        h.scope,
      );
      expect(h.builder.andWhere).toHaveBeenCalledWith(
        'cover_note.policy_id = :policyId',
        { policyId: 'policy-1' },
      );
    });

    it('returns 404 for a cover note outside the caller scope', async () => {
      const h = makeHarness({ scopedRows: [] });

      await expect(h.service.findOne(user, 'cn-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(h.scopeService.applyQuotationReadScope).toHaveBeenCalled();
    });
  });

  describe('issueForQuotation (re-sync)', () => {
    it('refuses a quotation TIRA has not accepted with a conflict', async () => {
      const h = makeHarness({ quotation: { tira_status: 'PENDING' } });

      await expect(
        h.service.issueForQuotation(user, 'quotation-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.issuanceService.applyNotification).not.toHaveBeenCalled();
    });

    it('returns 404 when no accepted TIRA tracking exists', async () => {
      const h = makeHarness({ tracking: null });

      await expect(
        h.service.issueForQuotation(user, 'quotation-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 when the completed portal submission is missing', async () => {
      const h = makeHarness({ submission: null });

      await expect(
        h.service.issueForQuotation(user, 'quotation-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is idempotent: an existing cover note is returned, not re-issued', async () => {
      const h = makeHarness({
        alreadyIssued: { id: 'cn-1' },
        scopedRows: [{ id: 'cn-1' }],
      });

      await expect(
        h.service.issueForQuotation(user, 'quotation-1'),
      ).resolves.toEqual([{ id: 'cn-1' }]);
      expect(h.issuanceService.applyNotification).not.toHaveBeenCalled();
    });

    it('replays the accepted outcome through issuance', async () => {
      const h = makeHarness({});

      await expect(
        h.service.issueForQuotation(user, 'quotation-1'),
      ).resolves.toEqual([{ id: 'cn-1' }]);
      expect(h.issuanceService.applyNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'submission-1' }),
        expect.objectContaining({
          eventType: 'TIRAMIS_FINAL_SUCCESS',
          requestId: 'req-1',
        }),
      );
    });

    it('says so when the accepted submission issues no cover notes', async () => {
      const h = makeHarness({ issued: null });

      await expect(
        h.service.issueForQuotation(user, 'quotation-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
