import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalPaymentProof } from '../entities/portal-payment-proof.entity';
import { PortalRequestAttachment } from '../entities/portal-request-attachment.entity';
import { PortalServiceRequest } from '../entities/portal-service-request.entity';
import { PortalServiceRequestEvent } from '../entities/portal-service-request-event.entity';
import {
  PortalAccountStatus,
  PortalActorType,
  PortalPaymentProofStatus,
  PortalRequestStatus,
  PortalRequestType,
} from '../enums/portal.enums';

import { PortalBusinessAccessService } from './portal-business-access.service';
import { PortalFileStorageService } from './portal-file-storage.service';
import { PortalNotificationService } from './portal-notification.service';
import { PortalReferenceService } from './portal-reference.service';
import { PortalRequestsService } from './portal-requests.service';

function mockQueryBuilder(overrides: Record<string, any> = {}) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
}

function mockRepo(overrides: Record<string, any> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => v),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
    ...overrides,
  };
}

describe('PortalRequestsService', () => {
  let service: PortalRequestsService;
  let requestRepository: ReturnType<typeof mockRepo>;
  let eventRepository: ReturnType<typeof mockRepo>;
  let paymentProofRepository: ReturnType<typeof mockRepo>;
  let attachmentRepository: ReturnType<typeof mockRepo>;
  let invoiceRepository: ReturnType<typeof mockRepo>;
  let accessService: {
    assertPolicy: jest.Mock;
    assertQuotation: jest.Mock;
    assertInvoice: jest.Mock;
  };
  let referenceService: { next: jest.Mock };
  let notificationService: { create: jest.Mock };
  let fileStorageService: { store: jest.Mock; remove: jest.Mock; read: jest.Mock };
  let auditService: { log: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };

  const companyId = 'company-1';
  const requestId = 'request-1';
  const financeUserId = 'finance-user-1';
  const claimsUserId = 'claims-user-1';
  const userId = 'portal-user-1';
  const policyId = 'policy-1';
  const invoiceId = 'invoice-1';
  const claimRequestId = 'claim-request-1';
  const claimId = 'claim-1';

  const account: PortalAccount = {
    id: 'account-1',
    company_id: companyId,
    user_id: userId,
    actor_type: PortalActorType.CUSTOMER,
    customer_id: 'customer-1',
    intermediary_company_id: null,
    status: PortalAccountStatus.ACTIVE,
  } as PortalAccount;

  const accountA = { ...account, id: 'account-a' } as PortalAccount;

  const endorsementDto = {
    policy_id: policyId,
    request_type: PortalRequestType.ENDORSEMENT,
    subject: 'Update vehicle details',
    description: 'Please update chassis number',
  };

  const file = {
    originalname: 'proof.pdf',
    mimetype: 'application/pdf',
    size: 10,
    buffer: Buffer.from('%PDF-1.4'),
  };

  function buildManager(repos: Record<string, any>, queryResult: any[] = []) {
    const map = new Map<any, any>([
      [PortalServiceRequest, repos.request ?? requestRepository],
      [PortalServiceRequestEvent, repos.event ?? eventRepository],
      [PortalPaymentProof, repos.paymentProof ?? paymentProofRepository],
      [PortalRequestAttachment, repos.attachment ?? attachmentRepository],
      [Invoice, repos.invoice ?? invoiceRepository],
    ]);

    return {
      getRepository: jest.fn((entity: any) => map.get(entity)),
      query: jest.fn().mockResolvedValue(queryResult),
    };
  }

  beforeEach(async () => {
    requestRepository = mockRepo();
    eventRepository = mockRepo();
    paymentProofRepository = mockRepo();
    attachmentRepository = mockRepo();
    invoiceRepository = mockRepo();

    accessService = {
      assertPolicy: jest.fn(),
      assertQuotation: jest.fn(),
      assertInvoice: jest.fn(),
    };

    referenceService = { next: jest.fn().mockResolvedValue('PRQ-2026-000001') };
    notificationService = { create: jest.fn() };
    fileStorageService = {
      store: jest.fn().mockResolvedValue({
        originalFileName: 'proof.pdf',
        storedFileName: 'stored.pdf',
        storageKey: 'portal/company-1/request-1/stored.pdf',
        mimeType: 'application/pdf',
        fileSize: '10',
        checksum: 'abc123',
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      read: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    dataSource = {
      transaction: jest.fn((cb: any) => cb(buildManager({}))),
      getRepository: jest.fn(() => mockRepo()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalRequestsService,
        { provide: DataSource, useValue: dataSource },
        { provide: PortalBusinessAccessService, useValue: accessService },
        { provide: PortalReferenceService, useValue: referenceService },
        { provide: PortalNotificationService, useValue: notificationService },
        { provide: PortalFileStorageService, useValue: fileStorageService },
        { provide: AuditService, useValue: auditService },
        {
          provide: getRepositoryToken(PortalServiceRequest),
          useValue: requestRepository,
        },
        {
          provide: getRepositoryToken(PortalServiceRequestEvent),
          useValue: eventRepository,
        },
        {
          provide: getRepositoryToken(PortalPaymentProof),
          useValue: paymentProofRepository,
        },
        {
          provide: getRepositoryToken(PortalRequestAttachment),
          useValue: attachmentRepository,
        },
      ],
    }).compile();

    service = module.get(PortalRequestsService);
  });

  it('rejects an endorsement request for a policy outside portal scope', async () => {
    accessService.assertPolicy.mockRejectedValue(new NotFoundException());

    await expect(
      service.createPolicyRequest(account, userId, endorsementDto),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents a duplicate open endorsement request', async () => {
    accessService.assertPolicy.mockResolvedValue({
      id: policyId,
      policy_no: 'POL-001',
      policy_status: 'ACTIVE',
    });

    requestRepository.createQueryBuilder = jest.fn(() =>
      mockQueryBuilder({ getCount: jest.fn().mockResolvedValue(1) }),
    );

    await expect(
      service.createPolicyRequest(account, userId, endorsementDto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a claim loss date outside the policy period', async () => {
    accessService.assertPolicy.mockResolvedValue({
      id: policyId,
      policy_no: 'POL-001',
      policy_status: 'ACTIVE',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });

    await expect(
      service.createClaimNotification(account, userId, {
        policy_id: policyId,
        loss_date: '2027-01-01',
        loss_location: 'Dar es Salaam',
        loss_description: 'Accident',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not allow payment proof above invoice balance', async () => {
    accessService.assertInvoice.mockResolvedValue({
      id: invoiceId,
      balance_amount: '100000.00',
    });

    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          invoice: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({
                getOne: jest.fn().mockResolvedValue({
                  id: invoiceId,
                  status: 'UNPAID',
                  balance_amount: '100000.00',
                  currency: 'TZS',
                  policy_id: null,
                  quotation_id: null,
                  invoice_no: 'INV-001',
                }),
              }),
            ),
          }),
        }),
      ),
    );

    await expect(
      service.createPaymentProof(account, userId, {
        invoice_id: invoiceId,
        amount: 150000,
        payment_date: '2026-08-04',
        description: 'Bank payment',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a PAYMENT_PROOF attachment before verification', async () => {
    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          request: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({
                getOne: jest.fn().mockResolvedValue({
                  id: requestId,
                  company_id: companyId,
                  request_type: PortalRequestType.PAYMENT_PROOF,
                  status: PortalRequestStatus.SUBMITTED,
                }),
              }),
            ),
          }),
          paymentProof: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({
                getOne: jest.fn().mockResolvedValue({
                  id: 'proof-1',
                  status: PortalPaymentProofStatus.PENDING_REVIEW,
                  invoice_id: invoiceId,
                  amount: '50000.00',
                }),
              }),
            ),
          }),
          attachment: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) }),
            ),
          }),
        }),
      ),
    );

    await expect(
      service.reviewPaymentProof(companyId, requestId, financeUserId, {
        status: PortalPaymentProofStatus.VERIFIED,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('does not mark the invoice paid when proof is verified', async () => {
    const requestEntity = {
      id: requestId,
      company_id: companyId,
      request_type: PortalRequestType.PAYMENT_PROOF,
      status: PortalRequestStatus.SUBMITTED,
      portal_account_id: account.id,
    };

    const managerInvoiceRepo = mockRepo({
      createQueryBuilder: jest.fn(() =>
        mockQueryBuilder({
          getOne: jest.fn().mockResolvedValue({
            id: invoiceId,
            status: 'UNPAID',
            balance_amount: '100000.00',
          }),
        }),
      ),
    });

    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          request: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({ getOne: jest.fn().mockResolvedValue(requestEntity) }),
            ),
          }),
          paymentProof: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({
                getOne: jest.fn().mockResolvedValue({
                  id: 'proof-1',
                  status: PortalPaymentProofStatus.PENDING_REVIEW,
                  invoice_id: invoiceId,
                  amount: '50000.00',
                }),
              }),
            ),
          }),
          attachment: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({ getCount: jest.fn().mockResolvedValue(1) }),
            ),
          }),
          invoice: managerInvoiceRepo,
        }),
      ),
    );

    dataSource.getRepository = jest.fn(() =>
      mockRepo({ findOne: jest.fn().mockResolvedValue(account) }),
    );

    await service.reviewPaymentProof(companyId, requestId, financeUserId, {
      status: PortalPaymentProofStatus.VERIFIED,
    });

    expect(managerInvoiceRepo.save).not.toHaveBeenCalled();
  });

  it.todo(
    'prevents two finance officers from reviewing the same proof (requires a real PostgreSQL integration run against the pessimistic lock)',
  );

  it('requires a rejection reason', async () => {
    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          request: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({
                getOne: jest.fn().mockResolvedValue({
                  id: requestId,
                  company_id: companyId,
                  request_type: PortalRequestType.ENDORSEMENT,
                  status: PortalRequestStatus.SUBMITTED,
                }),
              }),
            ),
          }),
        }),
      ),
    );

    await expect(
      service.transitionCompanyRequest(companyId, requestId, financeUserId, {
        status: PortalRequestStatus.REJECTED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents a portal user from cancelling another portal account request', async () => {
    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          request: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }),
            ),
          }),
        }),
      ),
    );

    await expect(
      service.cancelMine(accountA, userId, 'account-b-request'),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not allow attachment upload after request completion', async () => {
    requestRepository.findOne = jest.fn().mockResolvedValue({
      id: requestId,
      portal_account_id: account.id,
      status: PortalRequestStatus.COMPLETED,
    });

    await expect(
      service.uploadAttachment(account, userId, requestId, 'OTHER', file),
    ).rejects.toThrow(ConflictException);
  });

  it('removes the stored file when attachment metadata save fails', async () => {
    requestRepository.findOne = jest.fn().mockResolvedValue({
      id: requestId,
      portal_account_id: account.id,
      status: PortalRequestStatus.SUBMITTED,
    });

    attachmentRepository.save = jest
      .fn()
      .mockRejectedValue(new Error('Database error'));

    await expect(
      service.uploadAttachment(account, userId, requestId, 'OTHER', file),
    ).rejects.toThrow('Database error');

    expect(fileStorageService.remove).toHaveBeenCalled();
  });

  it('requires a claim reference before completing a claim notification', async () => {
    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          request: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({
                getOne: jest.fn().mockResolvedValue({
                  id: claimRequestId,
                  company_id: companyId,
                  request_type: PortalRequestType.CLAIM_NOTIFICATION,
                  status: PortalRequestStatus.APPROVED,
                  payload: {},
                }),
              }),
            ),
          }),
        }),
      ),
    );

    await expect(
      service.completeCompanyRequest(companyId, claimRequestId, claimsUserId, {
        reason: 'Completed',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('records the operational result when completing a request', async () => {
    const requestEntity = {
      id: claimRequestId,
      company_id: companyId,
      request_type: PortalRequestType.CLAIM_NOTIFICATION,
      status: PortalRequestStatus.APPROVED,
      payload: {},
      portal_account_id: account.id,
    };

    dataSource.transaction = jest.fn((cb: any) =>
      cb(
        buildManager({
          request: mockRepo({
            createQueryBuilder: jest.fn(() =>
              mockQueryBuilder({ getOne: jest.fn().mockResolvedValue(requestEntity) }),
            ),
          }),
        }),
      ),
    );

    dataSource.getRepository = jest.fn(() =>
      mockRepo({ findOne: jest.fn().mockResolvedValue(account) }),
    );

    const result = await service.completeCompanyRequest(
      companyId,
      claimRequestId,
      claimsUserId,
      {
        result_type: 'CLAIM',
        result_id: claimId,
        result_reference: 'CLM-2026-001',
        reason: 'Claim created',
      },
    );

    expect(result.status).toBe(PortalRequestStatus.COMPLETED);
  });
});
