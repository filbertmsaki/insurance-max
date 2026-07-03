import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { Policy } from './entities/policy.entity';
import { PolicyRisk } from './entities/policy-risk.entity';
import { PolicyPremiumBreakdown } from './entities/policy-premium-breakdown.entity';
import { PolicyStatusHistory } from './entities/policy-status-history.entity';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationRisk } from '../quotations/entities/quotation-risk.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { SubjectMatter } from '../non-motor/entities/subject-matter.entity';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { NonMotorQuotationDetail } from '../non-motor/entities/non-motor-quotation-detail.entity';
import { NonMotorPolicyDetail } from '../non-motor/entities/non-motor-policy-detail.entity';
import { User } from '../users/entities/user.entity';
import { QuotationStatus } from '../quotations/enums/quotation-status.enum';

function mockRepo(overrides: Record<string, any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => v),
    softDelete: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    })),
    findOneOrFail: jest.fn(),
    ...overrides,
  };
}

describe('PoliciesService â€” atomic quotation conversion', () => {
  let service: PoliciesService;
  let quotationRepoInManager: ReturnType<typeof mockRepo>;
  let quotationHistoryRepoInManager: ReturnType<typeof mockRepo>;
  let policyRepo: ReturnType<typeof mockRepo>;
  let companyRepo: ReturnType<typeof mockRepo>;
  let customerRepo: ReturnType<typeof mockRepo>;
  let categoryRepo: ReturnType<typeof mockRepo>;
  let productRepo: ReturnType<typeof mockRepo>;
  let quotationRepo: ReturnType<typeof mockRepo>;

  const companyId = 'company-1';
  const quotationId = 'quotation-1';

  function buildManagerRepos(quotationStatus: QuotationStatus) {
    quotationRepoInManager = mockRepo({
      findOne: jest.fn().mockResolvedValue({
        id: quotationId,
        company_id: companyId,
        status: quotationStatus,
      }),
    });
    quotationHistoryRepoInManager = mockRepo();

    const policyRepoInManager = mockRepo({
      save: jest.fn((v: any) => ({ ...v, id: 'policy-1', policy_no: 'POL-DIR-2026-00001' })),
    });
    const policyRiskRepoInManager = mockRepo();
    const breakdownRepoInManager = mockRepo();
    const policyHistoryRepoInManager = mockRepo();

    return {
      getRepository: (entity: any) => {
        if (entity === Policy) return policyRepoInManager;
        if (entity === PolicyRisk) return policyRiskRepoInManager;
        if (entity === PolicyPremiumBreakdown) return breakdownRepoInManager;
        if (entity === PolicyStatusHistory) return policyHistoryRepoInManager;
        if (entity === Quotation) return quotationRepoInManager;
        // QuotationStatusHistory falls through here (not imported to avoid an unused-import lint warning)
        return quotationHistoryRepoInManager;
      },
    };
  }

  beforeEach(async () => {
    policyRepo = mockRepo();
    companyRepo = mockRepo({ findOne: jest.fn().mockResolvedValue({ id: companyId }) });
    customerRepo = mockRepo({ findOne: jest.fn().mockResolvedValue({ id: 'customer-1' }) });
    categoryRepo = mockRepo({ findOne: jest.fn().mockResolvedValue({ id: 'category-1' }) });
    productRepo = mockRepo({ findOne: jest.fn().mockResolvedValue({ id: 'product-1' }) });
    quotationRepo = mockRepo({ findOne: jest.fn().mockResolvedValue({ id: quotationId, company_id: companyId }) });

    const dataSourceMock = {
      transaction: jest.fn(async (cb: any) => cb(buildManagerRepos(QuotationStatus.APPROVED))),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: getRepositoryToken(Policy), useValue: policyRepo },
        { provide: getRepositoryToken(PolicyRisk), useValue: mockRepo() },
        { provide: getRepositoryToken(PolicyPremiumBreakdown), useValue: mockRepo() },
        { provide: getRepositoryToken(PolicyStatusHistory), useValue: mockRepo() },
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Branch), useValue: mockRepo() },
        { provide: getRepositoryToken(Department), useValue: mockRepo() },
        { provide: getRepositoryToken(InsuranceCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(InsuranceProduct), useValue: productRepo },
        { provide: getRepositoryToken(InsuranceSubClass), useValue: mockRepo() },
        { provide: getRepositoryToken(Quotation), useValue: quotationRepo },
        { provide: getRepositoryToken(QuotationRisk), useValue: mockRepo() },
        { provide: getRepositoryToken(InsuranceRisk), useValue: mockRepo() },
        { provide: getRepositoryToken(SubjectMatter), useValue: mockRepo() },
        { provide: getRepositoryToken(MotorVehicle), useValue: mockRepo() },
        { provide: getRepositoryToken(NonMotorQuotationDetail), useValue: mockRepo() },
        { provide: getRepositoryToken(NonMotorPolicyDetail), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
      ],
    }).compile();

    service = module.get(PoliciesService);
  });

  const baseDto: any = {
    insurer_company_id: companyId,
    customer_id: 'customer-1',
    category_id: 'category-1',
    product_id: 'product-1',
    quotation_id: quotationId,
    channel_type: 'DIRECT',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    issue_date: '2026-01-01',
    sum_insured: 1000,
    basic_premium: 100,
    total_discount: 0,
    total_tax: 0,
    total_charges: 0,
    total_commission: 0,
    total_premium: 100,
    net_premium: 100,
    retention_amount: 0,
    ceded_sum_insured: 0,
    ceded_premium: 0,
  };

  it('marks the source quotation as CONVERTED when creating a policy from it', async () => {
    await service.create(companyId, baseDto, 'user-1');

    expect(quotationRepoInManager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: QuotationStatus.CONVERTED }),
    );
    expect(quotationHistoryRepoInManager.save).toHaveBeenCalled();
  });

  it('refuses to create a policy from a quotation that is already CONVERTED', async () => {
    const dataSourceMock = {
      transaction: jest.fn(async (cb: any) => cb(buildManagerRepos(QuotationStatus.CONVERTED))),
    };
    (service as any).dataSource = dataSourceMock;

    await expect(service.create(companyId, baseDto, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
