import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ProductLifecycleStatus,
  ProductReviewStatus,
  ProductVersionStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { AuditService } from '../../shared/audit/audit.service';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';
import { ProductDefinitionService } from './product-definition.service';
import { InsuranceProduct } from './entities/insurance-product.entity';
import { InsuranceProductVersion } from './entities/insurance-product-version.entity';

function makeVersion(
  overrides: Partial<InsuranceProductVersion> = {},
): InsuranceProductVersion {
  const product = {
    id: 'product-1',
    company_id: 'company-1',
    product_code: 'MOTOR-COMP',
    business_line: 'MOTOR',
    lifecycle_status: ProductLifecycleStatus.DRAFT,
    category: { id: 'cat-1', code: 'MOTOR', name: 'Motor' },
  } as unknown as InsuranceProduct;

  return {
    id: 'version-1',
    company_id: 'company-1',
    product_id: 'product-1',
    version_number: 1,
    status: ProductVersionStatus.DRAFT,
    review_status: ProductReviewStatus.IN_REVIEW,
    product_name: 'Motor Comprehensive',
    description: null,
    business_line: 'MOTOR',
    supports_fleet: false,
    tiramis_product_code: 'MOTOR-COMP',
    cover_note_type: 1,
    default_cover_duration_days: 365,
    currency_code: 'TZS',
    cover_note_description: 'Comprehensive motor cover',
    operative_clause: 'Fire and Allied Perils',
    policy_operative_clause: 'Fire and Allied Perils',
    special_conditions: '',
    exclusions: '',
    allows_cover_text_override: false,
    effective_from: '2026-01-01',
    effective_to: null,
    is_submission_ready: false,
    definition_hash: null,
    review_comments: null,
    definition_items: [],
    addons: [],
    document_requirements: [],
    sub_classes: [],
    product,
    ...overrides,
  } as unknown as InsuranceProductVersion;
}

describe('ProductDefinitionService', () => {
  let service: ProductDefinitionService;
  let versionRepository: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    versionRepository = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductDefinitionService,
        {
          provide: getRepositoryToken(InsuranceProduct),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(InsuranceProductVersion),
          useValue: versionRepository,
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: ProductDefinitionHashService,
          useValue: new ProductDefinitionHashService(),
        },
        {
          provide: AuditService,
          useValue: { logCritical: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PricingRuntimeCacheService,
          useValue: {
            invalidateProductConfiguration: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(ProductDefinitionService);
  });

  describe('submitForReview', () => {
    it('rejects an incomplete definition', async () => {
      const draft = makeVersion({
        status: ProductVersionStatus.DRAFT,
        review_status: ProductReviewStatus.DRAFT,
        operative_clause: '',
      });
      versionRepository.findOne.mockResolvedValue(draft);

      await expect(
        service.submitForReview(
          'company-1',
          'product-1',
          'version-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('moves a complete draft into review', async () => {
      const draft = makeVersion({
        status: ProductVersionStatus.DRAFT,
        review_status: ProductReviewStatus.DRAFT,
      });
      versionRepository.findOne.mockResolvedValue(draft);

      const result = await service.submitForReview(
        'company-1',
        'product-1',
        'version-1',
        'user-1',
      );

      expect(result.review_status).toBe(ProductReviewStatus.IN_REVIEW);
      expect(result.submitted_for_review_by).toBe('user-1');
    });

    it('rejects a version that is not a draft', async () => {
      const published = makeVersion({ status: ProductVersionStatus.PUBLISHED });
      versionRepository.findOne.mockResolvedValue(published);

      await expect(
        service.submitForReview(
          'company-1',
          'product-1',
          'version-1',
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectReview', () => {
    it('rejects when the version is not in review', async () => {
      const draft = makeVersion({
        status: ProductVersionStatus.DRAFT,
        review_status: ProductReviewStatus.DRAFT,
      });
      versionRepository.findOne.mockResolvedValue(draft);

      await expect(
        service.rejectReview(
          'company-1',
          'product-1',
          'version-1',
          'Missing wording',
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('records reviewer and comments when in review', async () => {
      const inReview = makeVersion({
        status: ProductVersionStatus.DRAFT,
        review_status: ProductReviewStatus.IN_REVIEW,
      });
      versionRepository.findOne.mockResolvedValue(inReview);

      const result = await service.rejectReview(
        'company-1',
        'product-1',
        'version-1',
        'Missing wording',
        'reviewer-1',
      );

      expect(result.review_status).toBe(ProductReviewStatus.REJECTED);
      expect(result.review_comments).toBe('Missing wording');
      expect(result.reviewed_by).toBe('reviewer-1');
    });
  });

  describe('returnToDraft', () => {
    it('rejects a published version', async () => {
      const published = makeVersion({ status: ProductVersionStatus.PUBLISHED });
      versionRepository.findOne.mockResolvedValue(published);

      await expect(
        service.returnToDraft('company-1', 'product-1', 'version-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('resets a rejected draft back to DRAFT review status', async () => {
      const rejected = makeVersion({
        status: ProductVersionStatus.DRAFT,
        review_status: ProductReviewStatus.REJECTED,
      });
      versionRepository.findOne.mockResolvedValue(rejected);

      const result = await service.returnToDraft(
        'company-1',
        'product-1',
        'version-1',
        'user-1',
      );

      expect(result.review_status).toBe(ProductReviewStatus.DRAFT);
    });
  });

  describe('resolvePublishedDefinition', () => {
    it('throws PRODUCT_DEFINITION_NOT_AVAILABLE when no version matches', async () => {
      const queryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      (versionRepository as any).createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      await expect(
        service.resolvePublishedDefinition('company-1', 'product-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a subclass that is not part of the published version', async () => {
      const publishedVersion = makeVersion({
        status: ProductVersionStatus.PUBLISHED,
        review_status: ProductReviewStatus.APPROVED,
        is_submission_ready: true,
        sub_classes: [{ sub_class_id: 'sub-1', code_snapshot: 'COMP' } as any],
      });
      const queryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(publishedVersion),
      };
      (versionRepository as any).createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      await expect(
        service.resolvePublishedDefinition('company-1', 'product-1', 'sub-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
