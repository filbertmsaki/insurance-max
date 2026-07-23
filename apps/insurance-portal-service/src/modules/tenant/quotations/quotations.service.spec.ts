import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Quotation } from './entities/quotation.entity';
import { QuotationStatusHistory } from './entities/quotation-status-history.entity';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from './enums/quotation-status-transition-action.enum';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationPreviewMapper } from './mappers/quotation-preview.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { QuotationsService } from './quotations.service';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { createMotorSingleQuotationPayload } from './testing/quotation-payload.fixture';

describe('QuotationsService', () => {
  function createServiceFixture(status = QuotationStatus.DRAFT) {
    const authoritativePayload = createMotorSingleQuotationPayload();
    const quotation = {
      id: 'quotation-1',
      quotation_no: 'QTN-MTR-2026-000001',
      quotation_flow: authoritativePayload.internal_quotation.quotation_flow,
      status,
      submitted_at: null,
      submitted_by: null,
      company_id: 'company-1',
      cover_note: {
        payment_mode: 1,
      },
    } as any;

    const lockedQuotation = {
      id: quotation.id,
      company_id: 'company-1',
      status,
      submitted_at: null,
      submitted_by: null,
      rejection_reason: null,
    };

    const quotationRepoInManager = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(lockedQuotation),
      })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const quotationStatusHistoryRepoInManager = {
      save: jest.fn().mockResolvedValue({}),
    };

    const dataSource = {
      transaction: jest.fn(async (callback: any) =>
        callback({
          getRepository: (entity: unknown) => {
            if (entity === Quotation) {
              return quotationRepoInManager;
            }

            if (entity === QuotationStatusHistory) {
              return quotationStatusHistoryRepoInManager;
            }

            throw new Error(`Unexpected repository: ${String(entity)}`);
          },
        }),
      ),
    } as unknown as DataSource;

    const quotationsRepository = {
      findOneAggregate: jest.fn().mockResolvedValue(quotation),
    } as unknown as QuotationsRepository;

    const payloadMapper = {
      toAuthoritativePayload: jest.fn().mockReturnValue(authoritativePayload),
      businessReference: jest.fn().mockReturnValue('AICL-MTR-2026-000001'),
      toResponse: jest.fn().mockImplementation((value: any) => value),
    } as unknown as QuotationPayloadMapper;

    const previewMapper = {} as QuotationPreviewMapper;

    const payloadValidator = {
      assertValid: jest.fn(),
    } as unknown as QuotationPayloadValidator;

    const tiramisBusinessSubmitService = {
      submitAnyBusinessRecord: jest.fn().mockResolvedValue({
        tracking_id: 'tracking-1',
      }),
    } as unknown as TiramisBusinessSubmitService;

    const tiramisTrackingRepository = {} as TiramisSubmissionTrackingRepository;
    const identifierGeneratorService = {} as IdentifierGeneratorService;

    const service = new QuotationsService(
      dataSource,
      quotationsRepository,
      payloadMapper,
      previewMapper,
      new QuotationTiramisPayloadMapper(),
      payloadValidator,
      tiramisBusinessSubmitService,
      tiramisTrackingRepository,
      identifierGeneratorService,
    );

    return {
      authoritativePayload,
      quotation,
      quotationRepoInManager,
      quotationStatusHistoryRepoInManager,
      tiramisBusinessSubmitService,
      service,
    };
  }

  it('submits the final outbound payload to TIRAMIS using camelCase fields', async () => {
    const fixture = createServiceFixture(QuotationStatus.DRAFT);

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      undefined,
      {
        id: 'user-1',
      } as any,
    );

    expect(
      (
        fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).toMatchObject({
      coverNoteNumber: 'AICL-MTR-2026-000001',
      salePointCode: 'SP502',
      productCode: 'SP005001000000',
      risks: [
        {
          riskCode: 'SP005001000001',
          taxes: [
            {
              taxCode: 'VAT-MAINLAND',
            },
          ],
        },
      ],
      policyHolders: [
        {
          policyHolderName: 'Filbert Elisaia Msaki',
          phoneNumber: '255762650393',
        },
      ],
      motorDetail: {
        registrationNumber: 'T123ABC',
        chassisNumber: 'MOCKCHASSIS123456',
      },
      isFleet: false,
    });

    expect(
      (
        fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('cover_note_dtl');
    expect(
      (
        fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('internal_quotation');

    expect(fixture.quotationRepoInManager.update).toHaveBeenCalledWith(
      {
        id: fixture.quotation.id,
        company_id: 'company-1',
      },
      expect.objectContaining({
        status: QuotationStatus.PENDING_APPROVAL,
        submitted_by: 'user-1',
        updated_by: 'user-1',
      }),
    );

    expect(
      fixture.quotationStatusHistoryRepoInManager.save,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation_id: fixture.quotation.id,
        old_status: QuotationStatus.DRAFT,
        new_status: QuotationStatus.PENDING_APPROVAL,
        reason: 'Quotation submitted to TIRAMIS',
        changed_by: 'user-1',
      }),
    );
  });

  it('keeps APPROVED quotations approved when submitting to TIRAMIS', async () => {
    const fixture = createServiceFixture(QuotationStatus.APPROVED);

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      undefined,
      {
        id: 'user-1',
      } as any,
    );

    expect(fixture.quotationRepoInManager.update).toHaveBeenCalledWith(
      {
        id: fixture.quotation.id,
        company_id: 'company-1',
      },
      expect.objectContaining({
        status: QuotationStatus.APPROVED,
      }),
    );

    expect(
      fixture.quotationStatusHistoryRepoInManager.save,
    ).not.toHaveBeenCalled();
  });

  it('requires a reason when rejecting a quotation', async () => {
    const fixture = createServiceFixture(QuotationStatus.PENDING_APPROVAL);

    await expect(
      fixture.service.transitionStatus(
        'company-1',
        fixture.quotation.id,
        {
          action: QuotationStatusTransitionAction.REJECT,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
