import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

import { buildUrl } from '@insurance-max/shared-config';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';

import { AuditService } from '../../../shared/audit/audit.service';
import { MailService } from '../../../shared/mail/mail.service';

import { CompanyUserRole } from '../../../platform/companies/entities/company-user-role.entity';
import { CompanyUser } from '../../../platform/companies/entities/company-user.entity';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Role } from '../../../platform/roles/entities/role.entity';

import { BranchUser } from '../../branches/entities/branch-user.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { CustomerKycStatus } from '../../customers/enums/customer-kyc-status.enum';
import { CustomerStatus } from '../../customers/enums/customer-status.enum';
import { CustomerType } from '../../customers/enums/customer-type.enum';
import { User, UserStatus, UserType } from '../../users/entities/user.entity';

import {
  AcceptPortalInvitationDto,
  InviteCustomerPortalDto,
  InviteIntermediaryPortalDto,
} from '../dto/portal-invitation.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalInvitation } from '../entities/portal-invitation.entity';
import {
  PortalAccountStatus,
  PortalActorType,
  PortalInvitationStatus,
} from '../enums/portal.enums';

@Injectable()
export class PortalAccountsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    @InjectRepository(PortalAccount)
    private readonly accountRepository: Repository<PortalAccount>,
    @InjectRepository(PortalInvitation)
    private readonly invitationRepository: Repository<PortalInvitation>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Resolve the current authenticated user's active customer or
   * intermediary portal account. PortalGuard calls this for every
   * protected customer/intermediary request.
   */
  async findActiveForUser(
    user: AuthenticatedUser,
    actors?: PortalActorType[],
  ): Promise<PortalAccount> {
    if (!actors || actors.length === 0) {
      throw new ForbiddenException(
        'Portal access requires an explicit actor type',
      );
    }

    if (actors.includes(PortalActorType.INTERMEDIARY) && user.companyId) {
      const intermediaryAccount = await this.accountRepository.findOne({
        where: {
          user_id: user.id,
          company_id: user.companyId,
          status: PortalAccountStatus.ACTIVE,
          actor_type: In(actors),
        },
        relations: {
          customer: true,
          intermediary_company: true,
        },
      });

      if (intermediaryAccount) {
        return this.touchLastAccess(intermediaryAccount);
      }
    }

    if (!actors.includes(PortalActorType.CUSTOMER)) {
      throw new ForbiddenException('Active portal access is required');
    }

    const account = await this.ensureCustomerPortalAccess(user);

    return this.touchLastAccess(account);
  }

  /** Invite an existing customer belonging to the authenticated company. */
  async inviteCustomer(
    companyId: string,
    invitedBy: string,
    dto: InviteCustomerPortalDto,
  ) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId, status: 'active' },
    });

    if (!company || company.company_type !== CompanyType.INSURANCE_COMPANY) {
      throw new BadRequestException(
        'Customer portal invitations must be created by an insurance company',
      );
    }

    const customer = await this.customerRepository.findOne({
      where: { id: dto.customer_id, company_id: companyId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const customerEmail = customer.email?.trim().toLowerCase();
    const requestedEmail = dto.email?.trim().toLowerCase();

    // Don't let an administrator silently link an arbitrary email to an
    // existing customer; the customer record must be updated first through
    // the normal customer-management workflow.
    if (requestedEmail && customerEmail && requestedEmail !== customerEmail) {
      throw new ConflictException(
        'Invitation email must match the customer email address',
      );
    }

    const email = requestedEmail ?? customerEmail;

    if (!email) {
      throw new BadRequestException(
        'Customer must have an email address before portal invitation',
      );
    }

    const phone = customer.phone?.trim();

    if (!phone) {
      throw new BadRequestException(
        'Customer must have a phone number before portal invitation',
      );
    }

    const existingAccount = await this.accountRepository.findOne({
      where: {
        company_id: companyId,
        customer_id: customer.id,
        actor_type: PortalActorType.CUSTOMER,
        status: In([
          PortalAccountStatus.INVITED,
          PortalAccountStatus.ACTIVE,
          PortalAccountStatus.SUSPENDED,
        ]),
      },
    });

    if (existingAccount) {
      throw new ConflictException('Customer already has a portal account');
    }

    return this.createInvitation({
      company,
      actorType: PortalActorType.CUSTOMER,
      customerId: customer.id,
      intermediaryCompanyId: null,
      email,
      phone,
      firstName: customer.first_name,
      lastName: customer.last_name,
      invitedBy,
    });
  }

  private async touchLastAccess(
    account: PortalAccount,
  ): Promise<PortalAccount> {
    // last_accessed_at is informational; don't block the request if it fails.
    account.last_accessed_at = new Date();
    await this.accountRepository.update(account.id, {
      last_accessed_at: account.last_accessed_at,
    });

    return account;
  }

  /**
   * Invite a portal user who will represent a broker, agency, or
   * bancassurance company. The authenticated active company is the
   * intermediary company the portal account belongs to.
   */
  async inviteIntermediary(
    companyId: string,
    invitedBy: string,
    dto: InviteIntermediaryPortalDto,
  ) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId, status: 'active' },
    });

    if (
      !company ||
      ![
        CompanyType.BROKER,
        CompanyType.AGENCY,
        CompanyType.BANCASSURANCE,
      ].includes(company.company_type)
    ) {
      throw new BadRequestException(
        'Intermediary portal accounts require a broker, agency, or bancassurance company',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = dto.phone.trim();

    const existingAccount = await this.accountRepository
      .createQueryBuilder('portalAccount')
      .innerJoin('portalAccount.user', 'user')
      .where('portalAccount.company_id = :companyId', { companyId })
      .andWhere('portalAccount.actor_type = :actorType', {
        actorType: PortalActorType.INTERMEDIARY,
      })
      .andWhere('portalAccount.status IN (:...statuses)', {
        statuses: [
          PortalAccountStatus.INVITED,
          PortalAccountStatus.ACTIVE,
          PortalAccountStatus.SUSPENDED,
        ],
      })
      .andWhere('(LOWER(user.email) = :email OR user.phone = :phone)', {
        email: normalizedEmail,
        phone: normalizedPhone,
      })
      .getOne();

    if (existingAccount) {
      throw new ConflictException(
        'This intermediary user already has a portal account',
      );
    }

    return this.createInvitation({
      company,
      actorType: PortalActorType.INTERMEDIARY,
      customerId: null,
      intermediaryCompanyId: company.id,
      email: normalizedEmail,
      phone: normalizedPhone,
      firstName: dto.first_name.trim(),
      lastName: dto.last_name.trim(),
      invitedBy,
    });
  }

  /** Public invitation inspection. Exposes only masked, non-sensitive data. */
  async inspectInvitation(token: string) {
    const invitation = await this.findPendingInvitation(token);
    const existingUser = await this.findInvitationUser(invitation);

    return {
      actor_type: invitation.actor_type,
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
        slug: invitation.company.slug,
        logo_url: invitation.company.logo_url,
      },
      email: this.maskEmail(invitation.email),
      phone: this.maskPhone(invitation.phone),
      expires_at: invitation.expires_at,
      // For a safer flow, an existing account must sign in before accepting.
      requires_password: !existingUser,
      requires_existing_user_login: Boolean(existingUser),
    };
  }

  /**
   * Accept an invitation for a brand-new external user. Existing users must
   * use the authenticated acceptance endpoint instead.
   */
  async acceptInvitation(dto: AcceptPortalInvitationDto) {
    if (!dto.accept_terms || !dto.accept_privacy) {
      throw new BadRequestException(
        'Terms and privacy policy must be accepted',
      );
    }

    const tokenHash = this.hashToken(dto.token);

    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await manager
        .getRepository(PortalInvitation)
        .createQueryBuilder('invitation')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('invitation.company', 'company')
        .where('invitation.token_hash = :tokenHash', { tokenHash })
        .getOne();

      if (!invitation) {
        throw new NotFoundException('Portal invitation not found');
      }

      this.assertInvitationUsable(invitation);

      const userRepository = manager.getRepository(User);

      const normalizedEmail = invitation.email.trim().toLowerCase();
      const normalizedPhone = invitation.phone?.trim() ?? null;

      if (!normalizedPhone) {
        throw new BadRequestException(
          'A verified phone number is required before accepting a portal invitation',
        );
      }

      const { emailUser, phoneUser } = await this.findMatchingUsers(
        manager,
        normalizedEmail,
        normalizedPhone,
      );

      if (emailUser && phoneUser && emailUser.id !== phoneUser.id) {
        throw new ConflictException(
          'Invitation email and phone belong to different user accounts',
        );
      }

      const existingUser = emailUser ?? phoneUser;

      // Don't attach company memberships to an existing user using only a
      // bearer invitation token; existing users must authenticate first.
      if (existingUser) {
        throw new ConflictException(
          'An account already exists for this invitation. Sign in and accept the invitation from your authenticated account.',
        );
      }

      if (!dto.password) {
        throw new BadRequestException(
          'A password is required for a new portal user',
        );
      }

      const userNo = await this.generateUserNo(manager);

      const user = await userRepository.save(
        userRepository.create({
          user_no: userNo,
          first_name: invitation.first_name?.trim() || 'Portal',
          last_name: invitation.last_name?.trim() || 'User',
          phone: normalizedPhone,
          email: normalizedEmail,
          password: await hashPassword(dto.password),
          status: UserStatus.ACTIVE,
          user_type:
            invitation.actor_type === PortalActorType.CUSTOMER
              ? UserType.CUSTOMER
              : this.resolveIntermediaryUserType(
                  invitation.company.company_type,
                ),
          officer_title:
            invitation.actor_type === PortalActorType.CUSTOMER
              ? 'Customer'
              : 'Intermediary Portal User',
          // Acceptance through a token sent to the email address verifies
          // control of that email.
          is_email_verified: true,
          // Phone verification requires a separate OTP process; don't mark
          // it verified here.
          is_phone_verified: false,
        }),
      );

      const membership = await this.ensureMembershipAndPortalRole(
        manager,
        user,
        invitation,
      );

      await this.ensurePrimaryBranch(
        manager,
        invitation.company_id,
        membership.id,
      );

      await this.linkInvitationCustomerToUser(manager, invitation, user);

      const account = await this.activatePortalAccount(
        manager,
        invitation,
        user,
      );

      await this.markInvitationAccepted(manager, invitation, user.id);

      return { account, user, company: invitation.company };
    });

    await this.auditService.log({
      userId: result.user.id,
      companyId: result.account.company_id,
      action: 'portal.invitation.accepted',
      resource: 'portal_account',
      resourceId: result.account.id,
      metadata: { actorType: result.account.actor_type },
    });

    return {
      message: 'Portal invitation accepted. You can now sign in.',
      company_slug: result.company.slug,
      email: result.user.email,
      actor_type: result.account.actor_type,
    };
  }

  /**
   * Accept an invitation for an already authenticated user. Safer than
   * linking an existing user using only the public invitation token.
   */
  async acceptInvitationForExistingUser(
    authenticatedUserId: string,
    dto: AcceptPortalInvitationDto,
  ) {
    if (!dto.accept_terms || !dto.accept_privacy) {
      throw new BadRequestException(
        'Terms and privacy policy must be accepted',
      );
    }

    const tokenHash = this.hashToken(dto.token);

    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await manager
        .getRepository(PortalInvitation)
        .createQueryBuilder('invitation')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('invitation.company', 'company')
        .where('invitation.token_hash = :tokenHash', { tokenHash })
        .getOne();

      if (!invitation) {
        throw new NotFoundException('Portal invitation not found');
      }

      this.assertInvitationUsable(invitation);

      const user = await manager.getRepository(User).findOne({
        where: { id: authenticatedUserId },
      });

      if (!user) {
        throw new NotFoundException('Authenticated user not found');
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          'Inactive users cannot accept portal invitations',
        );
      }

      if (this.isPlatformAdministrator(user)) {
        throw new ForbiddenException(
          'Platform administrator accounts cannot be used as portal accounts',
        );
      }

      this.assertUserMatchesInvitation(user, invitation);
      this.assertUserTypeCompatible(user, invitation);

      const membership = await this.ensureMembershipAndPortalRole(
        manager,
        user,
        invitation,
      );

      await this.ensurePrimaryBranch(
        manager,
        invitation.company_id,
        membership.id,
      );

      await this.linkInvitationCustomerToUser(manager, invitation, user);

      const account = await this.activatePortalAccount(
        manager,
        invitation,
        user,
      );

      await this.markInvitationAccepted(manager, invitation, user.id);

      return { account, user, company: invitation.company };
    });

    await this.auditService.log({
      userId: authenticatedUserId,
      companyId: result.account.company_id,
      action: 'portal.invitation.accepted',
      resource: 'portal_account',
      resourceId: result.account.id,
      metadata: { actorType: result.account.actor_type, existingUser: true },
    });

    return {
      message: 'Portal invitation accepted.',
      company_slug: result.company.slug,
      actor_type: result.account.actor_type,
    };
  }

  /**
   * List portal accounts for the active company. Add pagination before
   * exposing this against a company with a large customer base.
   */
  async findAll(companyId: string) {
    return this.accountRepository.find({
      where: { company_id: companyId },
      relations: {
        user: true,
        customer: true,
        intermediary_company: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async suspend(
    companyId: string,
    accountId: string,
    userId: string,
    reason: string,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, company_id: companyId },
    });

    if (!account) {
      throw new NotFoundException('Portal account not found');
    }

    if (account.status === PortalAccountStatus.CLOSED) {
      throw new ConflictException('Closed portal account cannot be suspended');
    }

    if (account.status === PortalAccountStatus.SUSPENDED) {
      return account;
    }

    account.status = PortalAccountStatus.SUSPENDED;
    account.suspended_by = userId;
    account.suspended_at = new Date();
    account.suspension_reason = reason.trim();

    const saved = await this.accountRepository.save(account);

    await this.auditService.log({
      userId,
      companyId,
      action: 'portal.account.suspended',
      resource: 'portal_account',
      resourceId: account.id,
      metadata: { reason: account.suspension_reason },
    });

    return saved;
  }

  async activate(companyId: string, accountId: string, userId: string) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, company_id: companyId },
    });

    if (!account) {
      throw new NotFoundException('Portal account not found');
    }

    if (account.status === PortalAccountStatus.CLOSED) {
      throw new ConflictException(
        'Closed portal account cannot be reactivated',
      );
    }

    if (account.status === PortalAccountStatus.ACTIVE) {
      return account;
    }

    account.status = PortalAccountStatus.ACTIVE;
    account.activated_at = new Date();
    account.suspended_by = null;
    account.suspended_at = null;
    account.suspension_reason = null;

    const saved = await this.accountRepository.save(account);

    await this.auditService.log({
      userId,
      companyId,
      action: 'portal.account.activated',
      resource: 'portal_account',
      resourceId: account.id,
    });

    return saved;
  }

  private async ensureCustomerPortalAccess(
    user: AuthenticatedUser,
  ): Promise<PortalAccount> {
    const existingAccount = await this.accountRepository.findOne({
      where: {
        user_id: user.id,
        actor_type: PortalActorType.CUSTOMER,
        status: PortalAccountStatus.ACTIVE,
      },
      relations: {
        customer: true,
        intermediary_company: true,
      },
      order: {
        last_accessed_at: 'DESC',
        created_at: 'ASC',
      },
    });

    if (existingAccount) {
      return existingAccount;
    }

    return this.dataSource.transaction(async (manager) => {
      // Customer portal pages issue several protected requests in parallel.
      // Serialize auto-provisioning for this user so every request after the
      // first one observes and reuses the same customer and portal account.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`customer-portal:${user.id}`],
      );

      const customerRepository = manager.getRepository(Customer);
      const portalUser = await manager.getRepository(User).findOne({
        where: { id: user.id },
      });

      if (!portalUser) {
        throw new NotFoundException('Authenticated user not found');
      }

      const linkedCustomer = await customerRepository.findOne({
        where: { user_id: user.id },
      });

      if (linkedCustomer) {
        return this.ensureActiveCustomerPortalAccount(
          manager,
          linkedCustomer,
          user.id,
        );
      }

      const insurer = await this.resolveSelfServiceInsurerCompany(manager);
      const matchedCustomer = await this.findVerifiedExistingCustomer(
        manager,
        insurer.id,
        portalUser,
      );

      const customer =
        matchedCustomer ??
        (await customerRepository.save(
          customerRepository.create({
            company_id: insurer.id,
            user_id: user.id,
            customer_no: await this.generateCustomerNo(manager, insurer.id),
            customer_type: CustomerType.INDIVIDUAL,
            first_name: portalUser.first_name ?? null,
            last_name: portalUser.last_name ?? null,
            display_name:
              [portalUser.first_name, portalUser.last_name]
                .filter(Boolean)
                .join(' ')
                .trim() || null,
            phone: portalUser.phone,
            email: portalUser.email,
            country: 'Tanzania',
            country_code: 'TZA',
            region: 'Unspecified',
            district: 'Unspecified',
            kyc_status: CustomerKycStatus.PENDING,
            status: CustomerStatus.ACTIVE,
            data_source: 'SELF_SERVICE',
            metadata: {
              auto_provisioned: true,
              source: 'customer_portal',
            },
          }),
        ));

      if (matchedCustomer) {
        await this.assignCustomerToUser(manager, matchedCustomer, user.id);
      }

      const freshCustomer =
        matchedCustomer ??
        (await customerRepository.findOneOrFail({
          where: { id: customer.id },
        }));

      const account = await this.ensureActiveCustomerPortalAccount(
        manager,
        freshCustomer,
        user.id,
      );

      account.customer = freshCustomer;

      return account;
    });
  }

  private async ensureActiveCustomerPortalAccount(
    manager: EntityManager,
    customer: Customer,
    userId: string,
  ): Promise<PortalAccount> {
    const accountRepository = manager.getRepository(PortalAccount);
    const existingAccount = await accountRepository.findOne({
      where: {
        company_id: customer.company_id,
        user_id: userId,
        actor_type: PortalActorType.CUSTOMER,
      },
      withDeleted: true,
      relations: {
        customer: true,
        intermediary_company: true,
      },
    });

    if (existingAccount) {
      if (
        existingAccount.customer_id &&
        existingAccount.customer_id !== customer.id
      ) {
        throw new ConflictException(
          'Portal access is linked to a different customer profile',
        );
      }

      if (existingAccount.status === PortalAccountStatus.CLOSED) {
        throw new ForbiddenException('Customer portal access has been closed');
      }

      if (existingAccount.status === PortalAccountStatus.SUSPENDED) {
        throw new ForbiddenException(
          'Customer portal access has been suspended',
        );
      }

      if (existingAccount.status !== PortalAccountStatus.ACTIVE) {
        existingAccount.status = PortalAccountStatus.ACTIVE;
        existingAccount.activated_at =
          existingAccount.activated_at ?? new Date();
      }

      existingAccount.deleted_at = null;
      existingAccount.customer_id = customer.id;
      existingAccount.accepted_terms_at =
        existingAccount.accepted_terms_at ?? new Date();
      existingAccount.accepted_privacy_at =
        existingAccount.accepted_privacy_at ?? new Date();
      existingAccount.customer = customer;

      return accountRepository.save(existingAccount);
    }

    return accountRepository.save(
      accountRepository.create({
        company_id: customer.company_id,
        user_id: userId,
        actor_type: PortalActorType.CUSTOMER,
        customer_id: customer.id,
        intermediary_company_id: null,
        status: PortalAccountStatus.ACTIVE,
        activated_at: new Date(),
        accepted_terms_at: new Date(),
        accepted_privacy_at: new Date(),
        created_by: userId,
        metadata: {
          auto_provisioned: true,
          source: 'customer_portal',
        },
      }),
    );
  }

  private async linkInvitationCustomerToUser(
    manager: EntityManager,
    invitation: PortalInvitation,
    user: User,
  ): Promise<void> {
    if (
      invitation.actor_type !== PortalActorType.CUSTOMER ||
      !invitation.customer_id
    ) {
      return;
    }

    const customerRepository = manager.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id: invitation.customer_id, company_id: invitation.company_id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.assignCustomerToUser(manager, customer, user.id);
  }

  private async assignCustomerToUser(
    manager: EntityManager,
    customer: Customer,
    userId: string,
  ): Promise<void> {
    const customerRepository = manager.getRepository(Customer);

    const existingLinkedCustomer = await customerRepository.findOne({
      where: { user_id: userId },
    });

    if (existingLinkedCustomer && existingLinkedCustomer.id !== customer.id) {
      throw new ConflictException(
        'This user is already linked to a different customer profile',
      );
    }

    if (customer.user_id && customer.user_id !== userId) {
      throw new ConflictException(
        'This customer profile is already linked to another user',
      );
    }

    if (customer.user_id === userId) {
      return;
    }

    customer.user_id = userId;
    await customerRepository.save(customer);
  }

  private async findVerifiedExistingCustomer(
    manager: EntityManager,
    companyId: string,
    user: User,
  ): Promise<Customer | null> {
    if (
      !user.is_email_verified ||
      !user.is_phone_verified ||
      !user.email ||
      !user.phone
    ) {
      return null;
    }

    return manager
      .getRepository(Customer)
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.user_id IS NULL')
      .andWhere('customer.deleted_at IS NULL')
      .andWhere('LOWER(customer.email) = :email', {
        email: user.email.trim().toLowerCase(),
      })
      .andWhere('customer.phone = :phone', {
        phone: user.phone.trim(),
      })
      .orderBy('customer.created_at', 'ASC')
      .getOne();
  }

  private async resolveSelfServiceInsurerCompany(
    manager: EntityManager,
  ): Promise<Company> {
    const companies = await manager.getRepository(Company).find({
      where: {
        company_type: CompanyType.INSURANCE_COMPANY,
        status: 'active',
      },
      order: {
        created_at: 'ASC',
      },
    });

    const preferred = companies.filter((company) => {
      const settings = company.settings ?? {};
      const metadata = company.metadata ?? {};

      return (
        settings.allow_self_registration === true ||
        settings['default_b2c_insurer'] === true ||
        metadata['default_b2c_insurer'] === true
      );
    });

    const explicitlyDefault =
      preferred.find(
        (company) =>
          company.settings?.['default_b2c_insurer'] === true ||
          company.metadata?.['default_b2c_insurer'] === true,
      ) ?? null;

    if (explicitlyDefault) {
      return explicitlyDefault;
    }

    if (preferred.length > 0) {
      return preferred[0];
    }

    if (companies.length === 1) {
      return companies[0];
    }

    throw new ForbiddenException(
      'No self-service insurer company is configured for customer portal onboarding',
    );
  }

  private async generateCustomerNo(
    manager: EntityManager,
    companyId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CUST-${year}-`;
    const lockKey = `${companyId}:${prefix}:${year}`;

    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      lockKey,
    ]);

    const lastCustomer = await manager
      .getRepository(Customer)
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.customer_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('customer.customer_no', 'DESC')
      .limit(1)
      .getOne();

    const next = lastCustomer?.customer_no
      ? Number(lastCustomer.customer_no.substring(prefix.length)) + 1
      : 1;

    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  /**
   * Create a new invitation. Existing pending invitations for the same
   * company and email are revoked before the new token is created.
   */
  private async createInvitation(params: {
    company: Company;
    actorType: PortalActorType;
    customerId: string | null;
    intermediaryCompanyId: string | null;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    invitedBy: string;
  }) {
    await this.invitationRepository.update(
      {
        company_id: params.company.id,
        email: params.email,
        status: PortalInvitationStatus.PENDING,
      },
      {
        status: PortalInvitationStatus.REVOKED,
        revoked_by: params.invitedBy,
        revoked_at: new Date(),
        revocation_reason: 'Superseded by a newer invitation',
      },
    );

    const rawToken = randomBytes(32).toString('hex');

    const expiryHours = this.configService.get<number>(
      'PORTAL_INVITATION_EXPIRY_HOURS',
      48,
    );

    const invitation = await this.invitationRepository.save(
      this.invitationRepository.create({
        company_id: params.company.id,
        actor_type: params.actorType,
        customer_id: params.customerId,
        intermediary_company_id: params.intermediaryCompanyId,
        email: params.email,
        phone: params.phone,
        first_name: params.firstName,
        last_name: params.lastName,
        token_hash: this.hashToken(rawToken),
        status: PortalInvitationStatus.PENDING,
        expires_at: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        invited_by: params.invitedBy,
      }),
    );

    const invitationUrl = buildUrl(
      this.configService.getOrThrow<string>('app.frontendUrl'),
      'portal',
      'accept-invitation',
      { token: rawToken },
    );

    // For the first implementation this is sent directly. A later phase
    // should queue the communication and persist delivery status/retries.
    await this.mailService.sendPortalInvitationEmail(
      invitation.email,
      invitation.first_name ?? 'User',
      params.company.name,
      invitationUrl,
      invitation.expires_at,
    );

    await this.auditService.log({
      userId: params.invitedBy,
      companyId: params.company.id,
      action: 'portal.invitation.created',
      resource: 'portal_invitation',
      resourceId: invitation.id,
      metadata: {
        actorType: invitation.actor_type,
        // Avoid storing a complete email in security logs where possible.
        maskedEmail: this.maskEmail(invitation.email),
      },
    });

    return {
      id: invitation.id,
      actor_type: invitation.actor_type,
      email: invitation.email,
      expires_at: invitation.expires_at,
      status: invitation.status,
      // Expose the invitation token only outside production, for local and
      // automated testing.
      ...(this.configService.get<string>('app.env') !== 'production'
        ? { invitation_token: rawToken }
        : {}),
    };
  }

  private async findPendingInvitation(token: string) {
    const invitation = await this.invitationRepository.findOne({
      where: { token_hash: this.hashToken(token) },
      relations: { company: true },
    });

    if (!invitation) {
      throw new NotFoundException('Portal invitation not found');
    }

    this.assertInvitationUsable(invitation);

    return invitation;
  }

  private assertInvitationUsable(invitation: PortalInvitation) {
    if (invitation.status !== PortalInvitationStatus.PENDING) {
      throw new ConflictException('Portal invitation is no longer available');
    }

    if (invitation.expires_at.getTime() <= Date.now()) {
      throw new ConflictException('Portal invitation has expired');
    }
  }

  private async findInvitationUser(invitation: PortalInvitation) {
    const normalizedEmail = invitation.email.trim().toLowerCase();
    const normalizedPhone = invitation.phone?.trim();

    const query = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail });

    if (normalizedPhone) {
      query.orWhere('user.phone = :phone', { phone: normalizedPhone });
    }

    return query.getOne();
  }

  private async findMatchingUsers(
    manager: EntityManager,
    normalizedEmail: string,
    normalizedPhone: string,
  ) {
    const userRepository = manager.getRepository(User);

    const emailUser = await userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();

    const phoneUser = await userRepository.findOne({
      where: { phone: normalizedPhone },
    });

    return { emailUser, phoneUser };
  }

  private assertUserMatchesInvitation(
    user: User,
    invitation: PortalInvitation,
  ) {
    const invitationEmail = invitation.email.trim().toLowerCase();
    const userEmail = user.email.trim().toLowerCase();

    if (userEmail !== invitationEmail) {
      throw new ForbiddenException(
        'Invitation email does not belong to the authenticated user',
      );
    }

    const invitationPhone = invitation.phone?.trim();

    if (invitationPhone && user.phone !== invitationPhone) {
      throw new ForbiddenException(
        'Invitation phone number does not belong to the authenticated user',
      );
    }
  }

  private assertUserTypeCompatible(user: User, invitation: PortalInvitation) {
    if (
      invitation.actor_type === PortalActorType.CUSTOMER &&
      user.user_type !== UserType.CUSTOMER
    ) {
      throw new ConflictException(
        'The existing account is not a customer account',
      );
    }

    if (
      invitation.actor_type === PortalActorType.INTERMEDIARY &&
      ![UserType.BROKER, UserType.AGENT].includes(user.user_type as UserType)
    ) {
      throw new ConflictException(
        'The existing account is not an intermediary account',
      );
    }
  }

  private isPlatformAdministrator(user: User): boolean {
    return [UserType.OWNER, UserType.SUPER_ADMIN].includes(
      user.user_type as UserType,
    );
  }

  private async ensureMembershipAndPortalRole(
    manager: EntityManager,
    user: User,
    invitation: PortalInvitation,
  ) {
    const membershipRepository = manager.getRepository(CompanyUser);

    let membership = await membershipRepository.findOne({
      where: { company_id: invitation.company_id, user_id: user.id },
    });

    // A person already working internally for the target company must not
    // be silently converted into an external customer/intermediary user.
    if (membership) {
      const existingRoles = await manager
        .getRepository(CompanyUserRole)
        .createQueryBuilder('assignment')
        .innerJoinAndSelect('assignment.role', 'role')
        .where('assignment.company_user_id = :membershipId', {
          membershipId: membership.id,
        })
        .getMany();

      const internalRole = existingRoles.find(
        (assignment) =>
          !['CUSTOMER_PORTAL', 'INTERMEDIARY_PORTAL'].includes(
            assignment.role.name,
          ),
      );

      if (internalRole) {
        throw new ConflictException(
          'An internal company user cannot be converted into an external portal account',
        );
      }
    }

    if (!membership) {
      const hasMembership =
        (await membershipRepository.count({
          where: { user_id: user.id, status: 'active' },
        })) > 0;

      membership = await membershipRepository.save(
        membershipRepository.create({
          company_id: invitation.company_id,
          user_id: user.id,
          status: 'active',
          is_default: !hasMembership,
          last_accessed_at: null,
        }),
      );
    } else {
      membership.status = 'active';
      membership = await membershipRepository.save(membership);
    }

    const roleName =
      invitation.actor_type === PortalActorType.CUSTOMER
        ? 'CUSTOMER_PORTAL'
        : 'INTERMEDIARY_PORTAL';

    const role = await manager
      .getRepository(Role)
      .createQueryBuilder('role')
      .where('role.name = :roleName', { roleName })
      .andWhere('(role.company_id = :companyId OR role.company_id IS NULL)', {
        companyId: invitation.company_id,
      })
      .orderBy(
        'CASE WHEN role.company_id = :companyId THEN 0 ELSE 1 END',
        'ASC',
      )
      .setParameter('companyId', invitation.company_id)
      .getOne();

    if (!role) {
      throw new NotFoundException(`${roleName} role has not been seeded`);
    }

    const assignmentRepository = manager.getRepository(CompanyUserRole);

    const existingAssignment = await assignmentRepository.findOne({
      where: { company_user_id: membership.id, role_id: role.id },
    });

    if (!existingAssignment) {
      await assignmentRepository.save(
        assignmentRepository.create({
          company_user_id: membership.id,
          role_id: role.id,
        }),
      );
    }

    return membership;
  }

  /**
   * Current tenant authentication requires a branch membership and active
   * branch, so portal users are attached to the first active company
   * branch. They still cannot access branch business data because
   * PortalGuard and portal ownership filters apply to every endpoint.
   */
  private async ensurePrimaryBranch(
    manager: EntityManager,
    companyId: string,
    membershipId: string,
  ) {
    const branch = await manager.getRepository(Branch).findOne({
      where: { company_id: companyId, status: 'active' },
      order: { created_at: 'ASC' },
    });

    if (!branch) {
      throw new NotFoundException('Company has no active branch');
    }

    const branchUserRepository = manager.getRepository(BranchUser);

    // Ensure a single active branch for this membership.
    await branchUserRepository
      .createQueryBuilder()
      .update()
      .set({ is_active_branch: false, is_primary: false })
      .where('company_user_id = :membershipId', { membershipId })
      .execute();

    let assignment = await branchUserRepository.findOne({
      where: { branch_id: branch.id, company_user_id: membershipId },
    });

    if (!assignment) {
      assignment = branchUserRepository.create({
        branch_id: branch.id,
        company_user_id: membershipId,
        is_primary: true,
        is_active_branch: true,
        assigned_by: null,
        activated_at: new Date(),
        activated_by: null,
      });
    } else {
      assignment.is_primary = true;
      assignment.is_active_branch = true;
      assignment.activated_at = new Date();
    }

    await branchUserRepository.save(assignment);
  }

  private async activatePortalAccount(
    manager: EntityManager,
    invitation: PortalInvitation,
    user: User,
  ) {
    const accountRepository = manager.getRepository(PortalAccount);

    let account = await accountRepository.findOne({
      where: {
        company_id: invitation.company_id,
        user_id: user.id,
        actor_type: invitation.actor_type,
      },
      withDeleted: true,
    });

    const now = new Date();

    if (!account) {
      account = accountRepository.create({
        company_id: invitation.company_id,
        user_id: user.id,
        actor_type: invitation.actor_type,
        customer_id: invitation.customer_id,
        intermediary_company_id: invitation.intermediary_company_id,
        status: PortalAccountStatus.ACTIVE,
        activated_at: now,
        accepted_terms_at: now,
        accepted_privacy_at: now,
        created_by: invitation.invited_by,
        metadata: {},
      });
    } else {
      if (account.status === PortalAccountStatus.CLOSED) {
        throw new ConflictException(
          'Closed portal account cannot be reopened using an invitation',
        );
      }

      account.deleted_at = null;
      account.status = PortalAccountStatus.ACTIVE;
      account.customer_id = invitation.customer_id;
      account.intermediary_company_id = invitation.intermediary_company_id;
      account.activated_at = now;
      account.accepted_terms_at = now;
      account.accepted_privacy_at = now;
      account.suspended_by = null;
      account.suspended_at = null;
      account.suspension_reason = null;
    }

    return accountRepository.save(account);
  }

  private async markInvitationAccepted(
    manager: EntityManager,
    invitation: PortalInvitation,
    userId: string,
  ) {
    invitation.status = PortalInvitationStatus.ACCEPTED;
    invitation.accepted_by = userId;
    invitation.accepted_at = new Date();

    await manager.getRepository(PortalInvitation).save(invitation);
  }

  /**
   * Follows the existing USR-00001 format. A dedicated sequence table would
   * be preferable if the user count can exceed the fixed number length.
   */
  private async generateUserNo(manager: EntityManager) {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      'portal-user-number',
    ]);

    const rows = await manager.query(`
      SELECT user_no
      FROM users
      WHERE user_no ~ '^USR-[0-9]+$'
      ORDER BY CAST(REPLACE(user_no, 'USR-', '') AS bigint) DESC
      LIMIT 1
    `);

    const last = String(rows[0]?.user_no ?? 'USR-00000');
    const next = Number(last.replace('USR-', '')) + 1;

    return `USR-${String(next).padStart(5, '0')}`;
  }

  private resolveIntermediaryUserType(companyType: CompanyType): UserType {
    return companyType === CompanyType.BROKER
      ? UserType.BROKER
      : UserType.AGENT;
  }

  /**
   * Deliberately a plain deterministic SHA-256 digest, not the shared
   * argon2-based hashToken/verifyToken utility - invitation lookup requires
   * an exact-match unique-column query, which a salted hash can't support.
   */
  private hashToken(token: string) {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    const visible = name.slice(0, 2);

    return `${visible}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
  }

  private maskPhone(phone: string | null) {
    if (!phone) {
      return null;
    }

    const visible = phone.slice(-3);

    return `${'*'.repeat(Math.max(4, phone.length - 3))}${visible}`;
  }
}
