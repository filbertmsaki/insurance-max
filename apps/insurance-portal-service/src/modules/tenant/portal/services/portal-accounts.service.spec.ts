import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import { PortalInvitationDeliveryService } from './portal-invitation-delivery.service';
import { Company } from '../../../platform/companies/entities/company.entity';
import { CompanyUser } from '../../../platform/companies/entities/company-user.entity';
import { CompanyUserRole } from '../../../platform/companies/entities/company-user-role.entity';
import { Role } from '../../../platform/roles/entities/role.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { BranchUser } from '../../branches/entities/branch-user.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

import { PortalAccount } from '../entities/portal-account.entity';
import { PortalInvitation } from '../entities/portal-invitation.entity';
import {
  PortalAccountStatus,
  PortalActorType,
  PortalInvitationDeliveryStatus,
  PortalInvitationStatus,
} from '../enums/portal.enums';
import { PortalAccountsService } from './portal-accounts.service';

function mockRepo(overrides: Record<string, any> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => v),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    })),
    ...overrides,
  };
}

describe('PortalAccountsService', () => {
  let service: PortalAccountsService;
  let accountRepository: ReturnType<typeof mockRepo>;
  let invitationRepository: ReturnType<typeof mockRepo>;
  let customerRepository: ReturnType<typeof mockRepo>;
  let companyRepository: ReturnType<typeof mockRepo>;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };

  function buildManager(repos: Record<string, any>) {
    const map = new Map<any, any>([
      [PortalInvitation, repos.invitation ?? mockRepo()],
      [User, repos.user ?? mockRepo()],
      [CompanyUser, repos.companyUser ?? mockRepo()],
      [CompanyUserRole, repos.companyUserRole ?? mockRepo()],
      [Role, repos.role ?? mockRepo()],
      [Branch, repos.branch ?? mockRepo()],
      [BranchUser, repos.branchUser ?? mockRepo()],
      [Customer, repos.customer ?? mockRepo()],
      [PortalAccount, repos.portalAccount ?? mockRepo()],
    ]);

    return {
      getRepository: jest.fn((entity: any) => map.get(entity)),
      query: jest.fn().mockResolvedValue([]),
    };
  }

  beforeEach(async () => {
    accountRepository = mockRepo();
    invitationRepository = mockRepo();
    customerRepository = mockRepo();
    companyRepository = mockRepo();

    dataSource = {
      transaction: jest.fn((cb: any) => cb(buildManager({}))),
      getRepository: jest.fn(() => mockRepo()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalAccountsService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(() => 'http://localhost'),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: PortalInvitationDeliveryService,
          useValue: {
            sealToken: jest.fn((token: string) => `sealed:${token}`),
          },
        },
        {
          provide: getRepositoryToken(PortalAccount),
          useValue: accountRepository,
        },
        {
          provide: getRepositoryToken(PortalInvitation),
          useValue: invitationRepository,
        },
        { provide: getRepositoryToken(Customer), useValue: customerRepository },
        { provide: getRepositoryToken(Company), useValue: companyRepository },
      ],
    }).compile();

    service = module.get(PortalAccountsService);
  });

  describe('findActiveForUser', () => {
    it('rejects when no actor types are supplied', async () => {
      await expect(
        service.findActiveForUser({ id: 'user-id' } as any, undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('loads an active standalone customer portal account without company context', async () => {
      accountRepository.findOne.mockResolvedValue({
        id: 'account-id',
        user_id: 'user-id',
        actor_type: PortalActorType.CUSTOMER,
        status: PortalAccountStatus.ACTIVE,
      });

      const result = await service.findActiveForUser(
        {
          id: 'user-id',
          scope: 'customer',
          permissions: [],
        } as any,
        [PortalActorType.CUSTOMER],
      );

      expect(result).toMatchObject({
        id: 'account-id',
        actor_type: PortalActorType.CUSTOMER,
      });
    });

    it('rejects intermediary-only access without an active company-scoped account', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findActiveForUser(
          {
            id: 'user-id',
            scope: 'customer',
            permissions: [],
          } as any,
          [PortalActorType.INTERMEDIARY],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does not auto-provision a customer under a default insurer', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findActiveForUser(
          { id: 'user-id', scope: 'customer', permissions: [] } as any,
          [PortalActorType.CUSTOMER],
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('inspectInvitation', () => {
    it('rejects an already-accepted (reused) token', async () => {
      invitationRepository.findOne.mockResolvedValue({
        status: PortalInvitationStatus.ACCEPTED,
        expires_at: new Date(Date.now() + 60_000),
      });

      await expect(
        service.inspectInvitation('already-used-token'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an expired invitation', async () => {
      invitationRepository.findOne.mockResolvedValue({
        status: PortalInvitationStatus.PENDING,
        expires_at: new Date(Date.now() - 60_000),
      });

      await expect(service.inspectInvitation('expired-token')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('invitation acceptance', () => {
    it('requires an existing user to authenticate before linking', async () => {
      const invitationEntity = {
        id: 'invitation-id',
        status: PortalInvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 60_000),
        email: 'existing@example.com',
        phone: '255700000000',
        actor_type: PortalActorType.CUSTOMER,
        company_id: 'company-id',
        company: { id: 'company-id', slug: 'acme' },
      };

      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
      };

      dataSource.transaction = jest.fn((cb: any) =>
        cb(
          buildManager({
            invitation: mockRepo({
              createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(invitationEntity),
              })),
            }),
            user: mockRepo({
              createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(existingUser),
              })),
              findOne: jest.fn().mockResolvedValue(null),
            }),
          }),
        ),
      );

      await expect(
        service.acceptInvitation({
          token: 'valid-token',
          password: 'StrongPassword@2026',
          accept_terms: true,
          accept_privacy: true,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('suspend / activate', () => {
    it('does not reactivate a closed portal account', async () => {
      accountRepository.findOne.mockResolvedValue({
        id: 'account-id',
        company_id: 'company-id',
        status: PortalAccountStatus.CLOSED,
      });

      await expect(
        service.activate('company-id', 'account-id', 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('activates a suspended account only through the administration action', async () => {
      const account = {
        id: 'account-id',
        company_id: 'company-id',
        status: PortalAccountStatus.SUSPENDED,
        suspended_by: 'admin-id',
        suspended_at: new Date(),
        suspension_reason: 'Security review',
      };

      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockImplementation(async (value: any) => value);

      const result = await service.activate(
        'company-id',
        'account-id',
        'admin-id',
      );

      expect(result.status).toBe(PortalAccountStatus.ACTIVE);
      expect(result.suspended_by).toBeNull();
      expect(result.suspension_reason).toBeNull();
    });

    it('does not suspend an already-closed portal account', async () => {
      accountRepository.findOne.mockResolvedValue({
        id: 'account-id',
        company_id: 'company-id',
        status: PortalAccountStatus.CLOSED,
      });

      await expect(
        service.suspend('company-id', 'account-id', 'admin-id', 'Fraud review'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('invitation administration', () => {
    function withLockedInvitation(invitation: any) {
      const repo = mockRepo({
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(invitation),
        })),
        save: jest.fn(async (value: any) => value),
      });
      dataSource.transaction.mockImplementation((cb: any) =>
        cb(buildManager({ invitation: repo })),
      );
      return repo;
    }

    const pending = () => ({
      id: 'inv-1',
      company_id: 'company-id',
      email: 'customer@example.com',
      status: PortalInvitationStatus.PENDING,
      token_hash: 'old-hash',
      resend_count: 0,
      delivery_status: PortalInvitationDeliveryStatus.SENT,
      delivery_token_ciphertext: null,
    });

    it('resend issues a new token and queues the email again', async () => {
      const invitation = pending();
      withLockedInvitation(invitation);

      const result = await service.resendInvitation(
        'company-id',
        'inv-1',
        'admin-id',
      );

      expect(invitation.token_hash).not.toBe('old-hash');
      expect(result).toMatchObject({
        status: PortalInvitationStatus.PENDING,
        delivery_status: PortalInvitationDeliveryStatus.QUEUED,
        resend_count: 1,
      });
      expect(invitation.delivery_token_ciphertext).toMatch(/^sealed:/);
    });

    it('resend reactivates an expired invitation', async () => {
      const invitation = {
        ...pending(),
        status: PortalInvitationStatus.EXPIRED,
      };
      withLockedInvitation(invitation);

      await service.resendInvitation('company-id', 'inv-1', 'admin-id');

      expect(invitation.status).toBe(PortalInvitationStatus.PENDING);
    });

    it.each([PortalInvitationStatus.ACCEPTED, PortalInvitationStatus.REVOKED])(
      'refuses to resend a %s invitation',
      async (status) => {
        withLockedInvitation({ ...pending(), status });

        await expect(
          service.resendInvitation('company-id', 'inv-1', 'admin-id'),
        ).rejects.toThrow(ConflictException);
      },
    );

    it("returns 404 for another company's invitation", async () => {
      withLockedInvitation(null);

      await expect(
        service.resendInvitation('company-id', 'inv-1', 'admin-id'),
      ).rejects.toThrow('Portal invitation not found');
    });

    it('revoking an undelivered invitation cancels its delivery and token', async () => {
      const invitation = {
        ...pending(),
        delivery_status: PortalInvitationDeliveryStatus.QUEUED,
        delivery_token_ciphertext: 'sealed:abc',
      };
      withLockedInvitation(invitation);

      const result = await service.revokeInvitation(
        'company-id',
        'inv-1',
        'admin-id',
        '  wrong email ',
      );

      expect(result).toMatchObject({
        status: PortalInvitationStatus.REVOKED,
        delivery_status: PortalInvitationDeliveryStatus.CANCELLED,
        revocation_reason: 'wrong email',
      });
      expect(invitation.delivery_token_ciphertext).toBeNull();
    });

    it('revoking keeps SENT as the delivery record', async () => {
      withLockedInvitation(pending());

      const result = await service.revokeInvitation(
        'company-id',
        'inv-1',
        'admin-id',
      );

      expect(result.delivery_status).toBe(PortalInvitationDeliveryStatus.SENT);
    });

    it('refuses to revoke an accepted invitation', async () => {
      withLockedInvitation({
        ...pending(),
        status: PortalInvitationStatus.ACCEPTED,
      });

      await expect(
        service.revokeInvitation('company-id', 'inv-1', 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
