import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { CommissionTransaction } from '../../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { Receipt } from '../../billing-commission/entities/receipt.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { SaveQuotationDraftDto } from '../../quotations/dto/quotation-draft.dto';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationsService } from '../../quotations/quotations.service';

import { PortalAccount } from '../entities/portal-account.entity';
import { PortalAccountStatus, PortalActorType } from '../enums/portal.enums';
import { PortalBusinessAccessService } from './portal-business-access.service';

function mockQueryBuilder(overrides: Record<string, any> = {}) {
  const qb: Record<string, any> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };

  return qb;
}

function mockRepo(overrides: Record<string, any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => v),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
    ...overrides,
  };
}

describe('PortalBusinessAccessService', () => {
  let service: PortalBusinessAccessService;
  let quotationRepository: ReturnType<typeof mockRepo>;
  let policyRepository: ReturnType<typeof mockRepo>;
  let invoiceRepository: ReturnType<typeof mockRepo>;
  let receiptRepository: ReturnType<typeof mockRepo>;
  let commissionRepository: ReturnType<typeof mockRepo>;
  let customerRepository: ReturnType<typeof mockRepo>;
  let companyRepository: ReturnType<typeof mockRepo>;
  let quotationsService: {
    createDraft: jest.Mock;
    updateDraft: jest.Mock;
    finalize: jest.Mock;
  };

  const customerAccount: PortalAccount = {
    id: 'account-customer-1',
    company_id: 'company-1',
    user_id: 'user-customer-1',
    actor_type: PortalActorType.CUSTOMER,
    customer_id: 'customer-1',
    intermediary_company_id: null,
    status: PortalAccountStatus.ACTIVE,
  } as PortalAccount;

  const intermediaryAccount: PortalAccount = {
    id: 'account-intermediary-1',
    company_id: 'insurer-1',
    user_id: 'user-intermediary-1',
    actor_type: PortalActorType.INTERMEDIARY,
    customer_id: null,
    intermediary_company_id: 'broker-1',
    intermediary_company: { id: 'broker-1', company_type: 'BROKER' } as Company,
    status: PortalAccountStatus.ACTIVE,
  } as PortalAccount;

  beforeEach(async () => {
    quotationRepository = mockRepo();
    policyRepository = mockRepo();
    invoiceRepository = mockRepo();
    receiptRepository = mockRepo();
    commissionRepository = mockRepo();
    customerRepository = mockRepo();
    companyRepository = mockRepo();

    quotationsService = {
      createDraft: jest.fn().mockResolvedValue({ id: 'quotation-1' }),
      updateDraft: jest.fn().mockResolvedValue({ id: 'quotation-1' }),
      finalize: jest.fn().mockResolvedValue({ id: 'quotation-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalBusinessAccessService,
        { provide: getRepositoryToken(Quotation), useValue: quotationRepository },
        { provide: getRepositoryToken(Policy), useValue: policyRepository },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepository },
        { provide: getRepositoryToken(Receipt), useValue: receiptRepository },
        {
          provide: getRepositoryToken(CommissionTransaction),
          useValue: commissionRepository,
        },
        { provide: getRepositoryToken(Customer), useValue: customerRepository },
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: QuotationsService, useValue: quotationsService },
      ],
    }).compile();

    service = module.get(PortalBusinessAccessService);
  });

  it('prevents a customer from reading another customer quotation', async () => {
    quotationRepository.createQueryBuilder = jest.fn(() =>
      mockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }),
    );

    await expect(
      service.assertQuotation(customerAccount, 'company-b-quotation'),
    ).rejects.toThrow(NotFoundException);
  });

  it('forces a customer quotation to direct channel', async () => {
    await service.createQuotationDraft(
      customerAccount,
      {
        insurer_company_id: 'another-company',
        intermediary_company_id: 'broker-company',
        customer_id: 'another-customer',
        channel_type: ProductChannelType.BROKER,
        current_wizard_step: 'STEP_1',
        draft_payload: {},
      } as SaveQuotationDraftDto,
      'customer-user-1',
    );

    expect(quotationsService.createDraft).toHaveBeenCalledWith(
      customerAccount.company_id,
      expect.objectContaining({
        insurer_company_id: customerAccount.company_id,
        intermediary_company_id: null,
        customer_id: customerAccount.customer_id,
        channel_type: ProductChannelType.DIRECT,
      }),
      'customer-user-1',
    );
  });

  it('prevents an intermediary from using another intermediary customer', async () => {
    jest
      .spyOn(service, 'assertPortfolioCustomer')
      .mockRejectedValue(
        new NotFoundException(
          'Customer not found in intermediary portfolio',
        ),
      );

    companyRepository.findOne = jest.fn().mockResolvedValue({
      id: 'insurer-1',
      company_type: 'INSURANCE_COMPANY',
      status: 'active',
    });

    await expect(
      service.createQuotationDraft(
        intermediaryAccount,
        {
          insurer_company_id: 'insurer-1',
          customer_id: 'unrelated-customer',
          current_wizard_step: 'STEP_1',
          draft_payload: {},
        } as SaveQuotationDraftDto,
        'intermediary-user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('forces the intermediary company from the portal account', async () => {
    const customer = { id: 'customer-2' } as Customer;

    jest.spyOn(service, 'assertPortfolioCustomer').mockResolvedValue(customer);

    companyRepository.findOne = jest.fn().mockResolvedValue({
      id: 'insurer-1',
      company_type: 'INSURANCE_COMPANY',
      status: 'active',
    });

    await service.createQuotationDraft(
      intermediaryAccount,
      {
        insurer_company_id: 'insurer-1',
        intermediary_company_id: 'another-broker',
        customer_id: customer.id,
        channel_type: ProductChannelType.DIRECT,
        current_wizard_step: 'STEP_1',
        draft_payload: {},
      } as SaveQuotationDraftDto,
      'intermediary-user-1',
    );

    expect(quotationsService.createDraft).toHaveBeenCalledWith(
      intermediaryAccount.company_id,
      expect.objectContaining({
        intermediary_company_id: intermediaryAccount.intermediary_company_id,
        channel_type: ProductChannelType.BROKER,
      }),
      'intermediary-user-1',
    );
  });

  it('does not allow submitted quotations to be changed', async () => {
    jest.spyOn(service, 'assertQuotation').mockResolvedValue({
      id: 'quotation-1',
      status: 'SUBMITTED',
    } as Quotation);

    await expect(
      service.updateQuotationDraft(
        customerAccount,
        'quotation-1',
        { expected_updated_at: new Date().toISOString() } as any,
        { id: 'customer-user-1', permissions: [] } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 for a policy outside portal scope', async () => {
    policyRepository.createQueryBuilder = jest.fn(() =>
      mockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }),
    );

    await expect(
      service.assertPolicy(customerAccount, 'another-policy'),
    ).rejects.toThrow(NotFoundException);
  });

  it('scopes commissions to the intermediary company', async () => {
    const commissionQueryBuilder = mockQueryBuilder();
    commissionRepository.createQueryBuilder = jest.fn(
      () => commissionQueryBuilder,
    );

    await service.findCommissions(intermediaryAccount, { page: 1, limit: 20 });

    expect(commissionQueryBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('commission.intermediary_company_id'),
      expect.objectContaining({
        intermediaryCompanyId: intermediaryAccount.intermediary_company_id,
      }),
    );
  });

  it('prevents a customer actor from reading commissions', async () => {
    await expect(
      service.findCommissions(customerAccount, { page: 1, limit: 20 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not expose an invoice from another customer', async () => {
    invoiceRepository.createQueryBuilder = jest.fn(() =>
      mockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }),
    );

    await expect(
      service.findInvoice(customerAccount, 'another-invoice'),
    ).rejects.toThrow(NotFoundException);
  });
});
