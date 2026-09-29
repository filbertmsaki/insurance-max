import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
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

  const service = new NonMotorRiskService(
    {
      createQueryBuilder: () => fieldQuery,
    } as unknown as Repository<ProductRiskField>,
    detailRepository as unknown as Repository<QuotationNonMotorDetail>,
    productRepository as unknown as Repository<InsuranceProduct>,
    { findOne: jest.fn() } as unknown as Repository<InsuranceSubClass>,
    quotationRepository as unknown as Repository<Quotation>,
    {} as DataSource,
  );

  return { service, detailRepository };
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
