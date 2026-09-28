import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';

import { CompanyConfigsService } from '../../../platform/company-configs/company-configs.service';
import { ProductDefinitionService } from '../../insurance-products/product-definition.service';
import { CoverNote } from '../../cover-notes/entities/cover-note.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyCoverNote } from '../../policies/entities/policy-cover-note.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyRenewal } from '../entities/policy-renewal.entity';
import { RenewalEligibilityService } from './renewal-eligibility.service';

describe('RenewalEligibilityService', () => {
  const productDefinitionService = {
    resolvePublishedDefinition: jest.fn(),
  } as unknown as jest.Mocked<ProductDefinitionService>;
  const companyConfigsService = {
    getValue: jest.fn(),
  } as unknown as jest.Mocked<CompanyConfigsService>;
  const configService = {
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;

  let service: RenewalEligibilityService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T10:00:00Z'));
    jest.clearAllMocks();

    productDefinitionService.resolvePublishedDefinition.mockResolvedValue({
      productVersionId: 'version-renewal',
      definitionHash: 'hash-renewal',
      defaultCoverDurationDays: 365,
    } as any);
    configService.get.mockImplementation((key: string) => {
      if (key === 'RENEWAL_WINDOW_BEFORE_DAYS') {
        return 7;
      }

      if (key === 'RENEWAL_WINDOW_AFTER_DAYS') {
        return 7;
      }

      return undefined;
    });
    companyConfigsService.getValue.mockImplementation(
      async (_companyId, _key, fallback) => fallback,
    );

    service = new RenewalEligibilityService(
      productDefinitionService,
      companyConfigsService,
      configService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows renewal when cover note end date is within 7 days from today', async () => {
    const result = await service.validate(
      managerWith({
        coverNoteEndDate: '2026-10-03',
      }),
      policy({ end_date: '2026-10-03' }),
    );

    expect(result.eligible).toBe(true);
    expect(result.renewalStartDate).toBe('2026-10-04');
    expect(result.previousCoverNoteReferenceNumber).toBe('CN-REF-001');
    expect(result.renewalSequence).toBe(1);
  });

  it('blocks renewal when cover note end date is too far in the future', async () => {
    const result = await service.validate(
      managerWith({
        coverNoteEndDate: '2026-10-08',
      }),
      policy({ end_date: '2026-10-08' }),
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RENEWAL_NOT_YET_AVAILABLE',
          message: 'Renewal is not yet available.',
        }),
      ]),
    );
  });

  it('blocks renewal when the renewal window has expired', async () => {
    const result = await service.validate(
      managerWith({
        coverNoteEndDate: '2026-09-18',
      }),
      policy({ end_date: '2026-09-18' }),
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RENEWAL_WINDOW_EXPIRED',
          message: 'The renewal window has expired.',
        }),
      ]),
    );
  });

  it('blocks renewal when the issued cover note is not stored in the system', async () => {
    const result = await service.validate(
      managerWith({
        coverNote: null,
      }),
      policy(),
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ISSUED_COVER_NOTE_MISSING',
        }),
        expect.objectContaining({
          code: 'COVER_NOTE_END_DATE_MISSING',
        }),
      ]),
    );
  });

  function policy(overrides: Partial<Policy> = {}): Policy {
    return {
      id: 'policy-1',
      company_id: 'company-1',
      insurer_company_id: 'company-1',
      product_id: 'product-1',
      sub_class_id: 'sub-class-1',
      quotation_id: 'quotation-1',
      cover_note_no: 'CN-REF-001',
      policy_status: 'ACTIVE',
      issued_by_system: true,
      tira_status: 'SUCCESS',
      regulatory_sync_status: 'IN_SYNC',
      renewed_to_policy_id: null,
      renewed_from_policy_id: null,
      renewal_of_policy_id: null,
      renewal_sequence: 0,
      pending_transaction_id: null,
      active_version_id: 'version-1',
      end_date: '2026-10-03',
      ...overrides,
    } as Policy;
  }

  function currentVersion(): PolicyVersion {
    return {
      id: 'version-1',
      company_id: 'company-1',
      policy_id: 'policy-1',
      version_number: 1,
      policy_snapshot: {
        schemaVersion: 2,
      },
      policy_snapshot_hash: 'hash',
      regulatory_reference: 'CN-REF-001',
    } as PolicyVersion;
  }

  function coverNote(endDate = '2026-10-03'): CoverNote {
    return {
      id: 'cover-note-1',
      company_id: 'company-1',
      policy_id: 'policy-1',
      status: 'ISSUED',
      cover_note_reference_number: 'CN-REF-001',
      end_date: endDate,
    } as CoverNote;
  }

  function managerWith(options: {
    coverNoteEndDate?: string;
    coverNote?: CoverNote | null;
    existingRenewal?: PolicyRenewal | null;
  }): EntityManager {
    const issuedCoverNote =
      options.coverNote === undefined
        ? coverNote(options.coverNoteEndDate)
        : options.coverNote;
    const policyCoverNoteQuery = chainableQueryBuilder({
      getOne: jest.fn().mockResolvedValue(
        issuedCoverNote
          ? ({
              cover_note: issuedCoverNote,
            } as PolicyCoverNote)
          : null,
      ),
    });
    const renewalQuery = chainableQueryBuilder({
      getOne: jest.fn().mockResolvedValue(options.existingRenewal ?? null),
    });

    return {
      getRepository: jest.fn((entity) => {
        if (entity === PolicyTransaction) {
          return {
            findOne: jest.fn().mockResolvedValue(null),
          };
        }

        if (entity === PolicyVersion) {
          return {
            findOne: jest.fn().mockResolvedValue(currentVersion()),
          };
        }

        if (entity === PolicyCoverNote) {
          return {
            createQueryBuilder: jest.fn(() => policyCoverNoteQuery),
          };
        }

        if (entity === PolicyRenewal) {
          return {
            createQueryBuilder: jest.fn(() => renewalQuery),
          };
        }

        throw new Error(`Unexpected repository: ${String(entity)}`);
      }),
    } as unknown as EntityManager;
  }

  function chainableQueryBuilder(methods: Record<string, jest.Mock>) {
    const builder: Record<string, unknown> = { ...methods };
    const chain = [
      'innerJoin',
      'innerJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
    ];

    for (const method of chain) {
      builder[method] = jest.fn(() => builder);
    }

    return builder;
  }
});
