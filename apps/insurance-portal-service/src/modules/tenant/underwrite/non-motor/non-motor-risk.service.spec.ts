import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import type { ProductDefinitionService } from '../../insurance-products/product-definition.service';
import type { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';
import type { Quotation } from '../../quotations/entities/quotation.entity';
import type { ProductRiskField } from './entities/product-risk-field.entity';
import type { QuotationNonMotorDetail } from './entities/quotation-non-motor-detail.entity';
import { NonMotorRiskService } from './non-motor-risk.service';

const user = {
  id: 'user-1',
  companyId: 'company-1',
} as unknown as AuthenticatedUser;

const fields = [
  {
    field_key: 'construction',
    label: 'Construction',
    data_type: 'SELECT',
    is_required: true,
    options: [{ value: 'CONCRETE', label: 'Concrete' }],
    validation_rules: null,
  },
  {
    field_key: 'floors',
    label: 'Floors',
    data_type: 'INTEGER',
    is_required: false,
    options: null,
    validation_rules: null,
  },
] as unknown as ProductRiskField[];

function setup(options: {
  flow?: string;
  stored?: Partial<QuotationNonMotorDetail> | null;
  productLine?: string;
  requirements?: Array<{
    code: string;
    name: string;
    appliesTo: string;
    isMandatory: boolean;
  }>;
  attachedTypes?: string[];
  noPublishedDefinition?: boolean;
  definitionError?: Error;
}) {
  const fieldQuery = {
    where: () => fieldQuery,
    andWhere: () => fieldQuery,
    orderBy: () => fieldQuery,
    addOrderBy: () => fieldQuery,
    getMany: () => Promise.resolve(fields),
  };
  const detailRepository = {
    findOne: jest.fn().mockResolvedValue(options.stored ?? null),
    create: (value: object) => value,
    save: jest
      .fn()
      .mockImplementation((value: object) =>
        Promise.resolve({ ...value, id: 'detail-1', updated_at: new Date() }),
      ),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const quotationRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'q-1',
      company_id: 'company-1',
      quotation_flow: options.flow ?? 'NON_MOTOR',
      product_id: 'prod-1',
      sub_class_id: null,
    }),
  };
  const productRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'prod-1',
      business_line: options.productLine ?? 'NON_MOTOR',
    }),
  };

  const dataSource = {
    query: jest.fn().mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('FROM quotations quotation')
          ? [
              {
                insurer_company_id: 'insurer-1',
                cover_note_start_date: new Date('2027-01-15T00:00:00Z'),
              },
            ]
          : (options.attachedTypes ?? []).map((document_type, index) => ({
              id: `doc-${index}`,
              document_type,
              file_name: `${document_type}.pdf`,
              status: 'AVAILABLE',
              uploaded_at: new Date('2026-09-30T00:00:00Z'),
            })),
      ),
    ),
  };
  const productDefinitionService = {
    resolvePublishedDefinition: options.definitionError
      ? jest.fn().mockRejectedValue(options.definitionError)
      : options.noPublishedDefinition
        ? jest.fn().mockRejectedValue(new NotFoundException('none'))
        : jest.fn().mockResolvedValue({
            documentRequirements: options.requirements ?? [],
          }),
  };

  const service = new NonMotorRiskService(
    {
      createQueryBuilder: () => fieldQuery,
    } as unknown as Repository<ProductRiskField>,
    detailRepository as unknown as Repository<QuotationNonMotorDetail>,
    productRepository as unknown as Repository<InsuranceProduct>,
    { findOne: jest.fn() } as unknown as Repository<InsuranceSubClass>,
    quotationRepository as unknown as Repository<Quotation>,
    dataSource as unknown as DataSource,
    productDefinitionService as unknown as ProductDefinitionService,
  );

  return { service, detailRepository, dataSource, productDefinitionService };
}

describe('NonMotorRiskService', () => {
  it('saves draft risk data with a schema snapshot, without enforcing required fields', async () => {
    const { service, detailRepository } = setup({});

    const view = await service.saveQuotationDetails(user, 'q-1', {
      risk_data: { floors: '3', unknown: 'dropped' },
      risk_location: ' Plot 7, Dar es Salaam ',
      limit_of_liability: 250000,
    });

    expect(detailRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation_id: 'q-1',
        risk_data: { floors: 3 },
        risk_location: 'Plot 7, Dar es Salaam',
        limit_of_liability: '250000.00',
        schema_snapshot: expect.arrayContaining([
          expect.objectContaining({ field_key: 'construction' }),
        ]),
      }),
    );
    expect(view.risk_data).toEqual({ floors: 3 });
  });

  it('rejects badly typed draft data', async () => {
    const { service } = setup({});

    await expect(
      service.saveQuotationDetails(user, 'q-1', {
        risk_data: { construction: 'STRAW' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses risk details for quotations outside the non-motor line', async () => {
    const { service } = setup({ flow: 'MOTOR_SINGLE' });

    await expect(
      service.getQuotationDetails('company-1', 'q-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks finalize until required risk fields are captured', async () => {
    const incomplete = setup({
      stored: { id: 'd-1', risk_data: { floors: 2 } },
    });
    await expect(
      incomplete.service.assertCompleteForFinalize(
        'company-1',
        'q-1',
        'prod-1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'NON_MOTOR_RISK_DETAILS_INCOMPLETE',
      }),
    });

    const complete = setup({
      stored: { id: 'd-1', risk_data: { construction: 'CONCRETE' } },
    });
    await expect(
      complete.service.assertCompleteForFinalize('company-1', 'q-1', 'prod-1'),
    ).resolves.toBeUndefined();
    expect(complete.detailRepository.update).toHaveBeenCalled();
  });

  it('blocks finalize while a mandatory quotation document is missing', async () => {
    const requirements = [
      {
        code: 'VALUATION',
        name: 'Valuation report',
        appliesTo: 'QUOTATION',
        isMandatory: true,
      },
      {
        code: 'PHOTOS',
        name: 'Photos',
        appliesTo: 'QUOTATION',
        isMandatory: false,
      },
      {
        code: 'CLAIM_FORM',
        name: 'Claim form',
        appliesTo: 'CLAIM',
        isMandatory: true,
      },
    ];

    await expect(
      setup({ requirements }).service.assertDocumentsCompleteForFinalize(
        'company-1',
        'q-1',
        'prod-1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'NON_MOTOR_DOCUMENTS_INCOMPLETE',
        details: { missing: [{ code: 'VALUATION', name: 'Valuation report' }] },
      }),
    });

    await expect(
      setup({
        requirements,
        attachedTypes: ['VALUATION'],
      }).service.assertDocumentsCompleteForFinalize(
        'company-1',
        'q-1',
        'prod-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('skips the document gate when the product has no published definition', async () => {
    await expect(
      setup({
        noPublishedDefinition: true,
      }).service.assertDocumentsCompleteForFinalize(
        'company-1',
        'q-1',
        'prod-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('skips the document gate when the definition is not available (403 from the resolver)', async () => {
    for (const code of [
      'PRODUCT_DEFINITION_NOT_AVAILABLE',
      'PRODUCT_SUB_CLASS_NOT_AVAILABLE',
    ]) {
      await expect(
        setup({
          definitionError: new ForbiddenException({ code, message: code }),
        }).service.assertDocumentsCompleteForFinalize(
          'company-1',
          'q-1',
          'prod-1',
          'sub-1',
        ),
      ).resolves.toBeUndefined();
    }

    await expect(
      setup({
        definitionError: new ForbiddenException({ code: 'OTHER' }),
      }).service.assertDocumentsCompleteForFinalize(
        'company-1',
        'q-1',
        'prod-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("resolves the insurer's definition effective on the quotation cover start date", async () => {
    const { service, productDefinitionService } = setup({});

    await service.assertDocumentsCompleteForFinalize(
      'company-1',
      'q-1',
      'prod-1',
      'sub-1',
    );

    expect(
      productDefinitionService.resolvePublishedDefinition,
    ).toHaveBeenCalledWith(
      'insurer-1',
      'prod-1',
      'sub-1',
      new Date('2027-01-15T00:00:00Z'),
    );
  });

  it('only counts attached (non-quarantined, non-deleted) documents', async () => {
    const { service, dataSource } = setup({
      requirements: [
        {
          code: 'VALUATION',
          name: 'Valuation report',
          appliesTo: 'QUOTATION',
          isMandatory: true,
        },
      ],
      attachedTypes: ['VALUATION'],
    });

    await service.assertDocumentsCompleteForFinalize(
      'company-1',
      'q-1',
      'prod-1',
    );

    const documentQuery = dataSource.query.mock.calls.find(([sql]) =>
      String(sql).includes('FROM documents'),
    ) as unknown as [string, unknown[]];
    expect(documentQuery[1][3]).toBe('DELETED');
    expect(documentQuery[1][4]).toEqual([
      'UPLOADED',
      'SCAN_PENDING',
      'SCANNING',
      'AVAILABLE',
    ]);

    await service.listQuotationDocuments('company-1', 'q-1');
    const listQuery = dataSource.query.mock.calls.at(-1) as unknown as [
      string,
      unknown[],
    ];
    expect(listQuery[1][4]).toBeNull();
  });

  it('only configures schemas for non-motor products', async () => {
    const { service } = setup({ productLine: 'MOTOR' });

    await expect(
      service.createField(user, {
        product_id: 'prod-1',
        field_key: 'construction',
        label: 'Construction',
        data_type: 'TEXT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires options for select fields', async () => {
    const { service } = setup({});

    await expect(
      service.createField(user, {
        product_id: 'prod-1',
        field_key: 'construction',
        label: 'Construction',
        data_type: 'SELECT',
        options: [],
      }),
    ).rejects.toThrow('Select fields need at least one option');
  });
});
