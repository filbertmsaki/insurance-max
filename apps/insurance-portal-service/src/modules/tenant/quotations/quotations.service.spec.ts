import { DataSource } from 'typeorm';

import { Quotation } from './entities/quotation.entity';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { QuotationsService } from './quotations.service';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { createMotorSingleQuotationPayload } from './testing/quotation-payload.fixture';

describe('QuotationsService submit payload mapping', () => {
  it('submits the final outbound payload to TIRAMIS using camelCase fields', async () => {
    const authoritativePayload = createMotorSingleQuotationPayload();
    const quotation = {
      id: 'quotation-1',
      quotation_no: 'QTN-MTR-2026-000001',
      quotation_flow: authoritativePayload.internal_quotation.quotation_flow,
      status: QuotationStatus.DRAFT,
      submitted_at: null,
      cover_note: {
        payment_mode: 1,
      },
    } as any;

    const lockedQuotation = {
      id: quotation.id,
      company_id: 'company-1',
      status: quotation.status,
      submitted_at: null,
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

    const dataSource = {
      transaction: jest.fn(async (callback: any) =>
        callback({
          getRepository: (entity: unknown) => {
            expect(entity).toBe(Quotation);
            return quotationRepoInManager;
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
    } as unknown as QuotationPayloadMapper;

    const payloadValidator = {
      assertValid: jest.fn(),
    } as unknown as QuotationPayloadValidator;

    const tiramisBusinessSubmitService = {
      submitAnyBusinessRecord: jest.fn().mockResolvedValue({
        tracking_id: 'tracking-1',
      }),
    } as unknown as TiramisBusinessSubmitService;

    const service = new QuotationsService(
      dataSource,
      quotationsRepository,
      payloadMapper,
      new QuotationTiramisPayloadMapper(),
      payloadValidator,
      tiramisBusinessSubmitService,
    );

    await service.submit(
      'company-1',
      quotation.id,
      undefined,
      {
        id: 'user-1',
      } as any,
    );

    expect(
      (
        tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
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
        tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('cover_note_dtl');
    expect(
      (
        tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('internal_quotation');
  });
});
