import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Brackets } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { CustomersService } from './customers.service';
import { CustomerKycStatus } from './enums/customer-kyc-status.enum';
import { TiraPolicyholderMapperService } from './services/tira-policyholder-mapper.service';

const COMPANY_ALL = 'data-scope:company-all';
const OWN_RECORDS = 'data-scope:own-records';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'maker-1',
    scope: 'company',
    userType: 'STAFF',
    companyId: 'company-1',
    companyType: 'INSURANCE_COMPANY',
    companyMembershipId: 'membership-1',
    roles: ['STAFF'],
    permissions: [COMPANY_ALL],
    assignedBranchIds: [],
    ...overrides,
  } as any;
}

const maker = makeUser({ id: 'maker-1' });
const checker = makeUser({ id: 'checker-1' });
const admin = makeUser({ id: 'maker-1', roles: ['INSURANCE_ADMIN'] });

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer-1',
    company_id: 'company-1',
    customer_no: 'CUST-2026-000001',
    customer_type: 'INDIVIDUAL',
    display_name: 'Asha Juma',
    created_by: 'maker-1',
    deleted_at: null,
    kyc_status: CustomerKycStatus.PENDING,
    kyc_version: 0,
    kyc_verified_by: null,
    kyc_verified_at: null,
    kyc_expires_at: null,
    kyc_rejection_reason: null,
    // Test-only: branches of quotations/policies linked to this customer.
    _linkedBranchIds: [] as string[],
    ...overrides,
  } as any;
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    company_id: 'company-1',
    customer_id: 'customer-1',
    kyc_version: 1,
    status: CustomerKycStatus.IN_REVIEW,
    submitted_by: 'maker-1',
    rejection_reason: null,
    ...overrides,
  } as any;
}

/**
 * Minimal in-memory query builder that evaluates the conditions the real
 * DataAccessScopeService adds for customers, so scope tests exercise the
 * real scope rules instead of a stub.
 */
function makeQueryBuilder(rows: any[]) {
  const predicates: Array<(row: any, p: Record<string, any>) => boolean> = [];
  const params: Record<string, any> = {};

  const toPredicate = (
    condition: unknown,
  ): ((row: any, p: Record<string, any>) => boolean) => {
    if (condition instanceof Brackets) {
      const ors: Array<(row: any, p: Record<string, any>) => boolean> = [];
      const sub: any = {
        where: (c: unknown) => (ors.push(toPredicate(c)), sub),
        orWhere: (c: unknown) => (ors.push(toPredicate(c)), sub),
      };
      condition.whereFactory(sub);
      return (row, p) => ors.some((fn) => fn(row, p));
    }
    const sql = String(condition).replace(/\s+/g, ' ').trim();
    if (sql === 'customer.id = :id') return (r, p) => r.id === p.id;
    if (sql === 'customer.deleted_at IS NULL') return (r) => !r.deleted_at;
    if (sql === 'customer.company_id = :scopeCompanyId')
      return (r, p) => r.company_id === p.scopeCompanyId;
    if (sql === 'customer.created_by = :scopeUserId')
      return (r, p) => r.created_by === p.scopeUserId;
    if (sql.startsWith('EXISTS ('))
      return (r, p) =>
        (r._linkedBranchIds as string[]).some((b) =>
          (p.scopeBranchIds ?? []).includes(b),
        );
    throw new Error(`Unhandled condition in fake query builder: ${sql}`);
  };

  const qb: any = {
    where: (c: unknown, p?: Record<string, any>) => {
      predicates.push(toPredicate(c));
      Object.assign(params, p ?? {});
      return qb;
    },
    setParameters: (p: Record<string, any>) => {
      Object.assign(params, p);
      return qb;
    },
    withDeleted: () => qb,
    getOne: jest.fn(async () => {
      // Soft-delete filtering is itself an explicit predicate, so
      // withDeleted() only means "no deleted_at predicate was added".
      const match = rows.find((row) =>
        predicates.every((fn) => fn(row, params)),
      );
      return match ?? null;
    }),
  };
  qb.andWhere = qb.where;
  return qb;
}

function makeHarness(
  params: {
    customers?: any[];
    review?: any | null;
    relations?: Partial<Record<string, any[]>>;
  } = {},
) {
  const customers = params.customers ?? [makeCustomer()];
  const review = params.review === undefined ? makeReview() : params.review;

  const relations = {
    identifiers: [
      { identifier_type: 'NIN', identifier_value: '1990', is_primary: true },
    ],
    addresses: [{ address_type: 'PHYSICAL', region: 'Dar', district: 'Ilala' }],
    contacts: [{ contact_type: 'PHONE', value: '255700000000' }],
    documents: [{ document_type: 'NATIONAL_ID' }],
    ...params.relations,
  };

  const customerRepo = {
    createQueryBuilder: jest.fn(() => makeQueryBuilder(customers)),
    findOneOrFail: jest.fn(async ({ where }: any) => {
      const found = customers.find(
        (c) => c.id === where.id && c.company_id === where.company_id,
      );
      if (!found) throw new Error('EntityNotFound');
      return found;
    }),
    save: jest.fn(async (value: any) => value),
  };
  const reviewRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      review &&
      review.customer_id === where.customer_id &&
      review.kyc_version === where.kyc_version &&
      (where.status === undefined || review.status === where.status)
        ? review
        : null,
    ),
    create: jest.fn((value: any) => ({ id: 'review-new', ...value })),
    save: jest.fn(async (value: any) => value),
  };
  const relationRepo = (rows: any[]) => ({
    find: jest.fn().mockResolvedValue(rows),
  });
  const identifierRepo = relationRepo(relations.identifiers);
  const addressRepo = relationRepo(relations.addresses);
  const contactRepo = relationRepo(relations.contacts);
  const documentRepo = relationRepo(relations.documents);

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'Customer':
          return customerRepo;
        case 'CustomerKycReview':
          return reviewRepo;
        case 'CustomerIdentifier':
          return identifierRepo;
        case 'CustomerAddress':
          return addressRepo;
        case 'CustomerContact':
          return contactRepo;
        case 'CustomerDocument':
          return documentRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };

  const dataSource = {
    manager,
    transaction: jest.fn(async (fn: any) => fn(manager)),
  } as any;

  const unused = {} as any;
  const service = new CustomersService(
    dataSource,
    customerRepo as any,
    identifierRepo as any,
    addressRepo as any,
    contactRepo as any,
    documentRepo as any,
    reviewRepo as any,
    unused,
    unused,
    unused,
    new DataAccessScopeService(),
    new TiraPolicyholderMapperService(),
  );

  return { service, dataSource, customerRepo, reviewRepo, customers };
}

describe('CustomersService KYC maker-checker', () => {
  describe('submitKycReviewForUser', () => {
    it.each([
      CustomerKycStatus.PENDING,
      CustomerKycStatus.REJECTED,
      CustomerKycStatus.REQUIRES_UPDATE,
      CustomerKycStatus.EXPIRED,
    ])('opens a new IN_REVIEW review from %s', async (status) => {
      const customer = makeCustomer({
        kyc_status: status,
        kyc_version: 2,
        kyc_rejection_reason: 'old reason',
      });
      const h = makeHarness({ customers: [customer], review: null });

      const review = await h.service.submitKycReviewForUser(
        maker,
        'customer-1',
        { submission_notes: '  please check  ' },
      );

      expect(review).toMatchObject({
        company_id: 'company-1',
        customer_id: 'customer-1',
        kyc_version: 3,
        status: CustomerKycStatus.IN_REVIEW,
        submitted_by: 'maker-1',
        submission_notes: 'please check',
      });
      expect(review.customer_snapshot_hash).toEqual(expect.any(String));
      expect(customer).toMatchObject({
        kyc_status: CustomerKycStatus.IN_REVIEW,
        kyc_version: 3,
        kyc_rejection_reason: null,
        updated_by: 'maker-1',
      });
    });

    it.each([CustomerKycStatus.IN_REVIEW, CustomerKycStatus.VERIFIED])(
      'refuses to submit a customer that is already %s',
      async (status) => {
        const h = makeHarness({
          customers: [makeCustomer({ kyc_status: status })],
        });

        await expect(
          h.service.submitKycReviewForUser(maker, 'customer-1', {} as any),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(h.reviewRepo.save).not.toHaveBeenCalled();
      },
    );

    it('requires at least one KYC document before review', async () => {
      const h = makeHarness({ review: null, relations: { documents: [] } });

      await expect(
        h.service.submitKycReviewForUser(maker, 'customer-1', {} as any),
      ).rejects.toThrow('At least one KYC document is required');
      expect(h.customerRepo.save).not.toHaveBeenCalled();
    });

    it('requires a phone contact before review', async () => {
      const h = makeHarness({
        review: null,
        relations: { contacts: [{ contact_type: 'EMAIL', value: 'a@b.tz' }] },
      });

      await expect(
        h.service.submitKycReviewForUser(maker, 'customer-1', {} as any),
      ).rejects.toThrow('phone contact is required');
    });
  });

  describe('approveKycReviewForUser', () => {
    const inReview = () =>
      makeCustomer({ kyc_status: CustomerKycStatus.IN_REVIEW, kyc_version: 1 });

    it('lets a different user approve and marks the customer VERIFIED', async () => {
      const customer = inReview();
      const h = makeHarness({ customers: [customer] });

      const result = await h.service.approveKycReviewForUser(
        checker,
        'customer-1',
        { expires_at: '2027-10-08T00:00:00.000Z', comments: ' ok ' },
      );

      expect(result).toMatchObject({
        status: CustomerKycStatus.VERIFIED,
        reviewed_by: 'checker-1',
        approval_comments: 'ok',
      });
      expect(customer).toMatchObject({
        kyc_status: CustomerKycStatus.VERIFIED,
        kyc_verified_by: 'checker-1',
        kyc_rejection_reason: null,
      });
      expect(customer.kyc_expires_at).toEqual(
        new Date('2027-10-08T00:00:00.000Z'),
      );
    });

    it('forbids the submitter from approving their own review', async () => {
      const customer = inReview();
      const h = makeHarness({ customers: [customer] });

      await expect(
        h.service.approveKycReviewForUser(maker, 'customer-1', {} as any),
      ).rejects.toThrow('cannot approve it');
      expect(customer.kyc_status).toBe(CustomerKycStatus.IN_REVIEW);
      expect(h.reviewRepo.save).not.toHaveBeenCalled();
    });

    it('lets a company admin approve a review they submitted', async () => {
      const customer = inReview();
      const h = makeHarness({ customers: [customer] });

      await h.service.approveKycReviewForUser(admin, 'customer-1', {});

      expect(customer.kyc_status).toBe(CustomerKycStatus.VERIFIED);
      expect(customer.kyc_verified_by).toBe('maker-1');
    });

    it.each([
      CustomerKycStatus.PENDING,
      CustomerKycStatus.VERIFIED,
      CustomerKycStatus.REJECTED,
      CustomerKycStatus.REQUIRES_UPDATE,
      CustomerKycStatus.EXPIRED,
    ])('refuses to approve a customer in %s', async (status) => {
      const h = makeHarness({
        customers: [makeCustomer({ kyc_status: status, kyc_version: 1 })],
      });

      await expect(
        h.service.approveKycReviewForUser(checker, 'customer-1', {} as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('fails when no open review exists for the current KYC version', async () => {
      const h = makeHarness({
        customers: [inReview()],
        review: makeReview({ kyc_version: 0 }),
      });

      await expect(
        h.service.approveKycReviewForUser(checker, 'customer-1', {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('rejectKycReviewForUser', () => {
    const inReview = () =>
      makeCustomer({
        kyc_status: CustomerKycStatus.IN_REVIEW,
        kyc_version: 1,
        kyc_verified_by: 'someone',
      });

    it('rejects with a reason and clears verification fields', async () => {
      const customer = inReview();
      const h = makeHarness({ customers: [customer] });

      const result = await h.service.rejectKycReviewForUser(
        checker,
        'customer-1',
        { rejection_reason: '  ID blurry ', comments: 'resubmit' },
      );

      expect(result).toMatchObject({
        status: CustomerKycStatus.REJECTED,
        rejection_reason: 'ID blurry',
        reviewed_by: 'checker-1',
        rejection_comments: 'resubmit',
      });
      expect(customer).toMatchObject({
        kyc_status: CustomerKycStatus.REJECTED,
        kyc_verified_by: null,
        kyc_expires_at: null,
        kyc_rejection_reason: 'ID blurry',
      });
    });

    it('requires a non-blank rejection reason', async () => {
      const customer = inReview();
      const h = makeHarness({ customers: [customer] });

      await expect(
        h.service.rejectKycReviewForUser(checker, 'customer-1', {
          rejection_reason: '   ',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(customer.kyc_status).toBe(CustomerKycStatus.IN_REVIEW);
    });

    it('forbids a non-admin submitter from rejecting their own review', async () => {
      const h = makeHarness({ customers: [inReview()] });

      await expect(
        h.service.rejectKycReviewForUser(maker, 'customer-1', {
          rejection_reason: 'x',
        } as any),
      ).rejects.toThrow('cannot reject it');
    });

    it('refuses to reject a customer that is not in review', async () => {
      const h = makeHarness({
        customers: [makeCustomer({ kyc_status: CustomerKycStatus.VERIFIED })],
      });

      await expect(
        h.service.rejectKycReviewForUser(checker, 'customer-1', {
          rejection_reason: 'x',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('expireKycForUser', () => {
    it.each([CustomerKycStatus.VERIFIED, CustomerKycStatus.IN_REVIEW])(
      'expires a %s customer and its latest review',
      async (status) => {
        const customer = makeCustomer({
          kyc_status: status,
          kyc_version: 1,
          kyc_verified_by: 'checker-1',
          kyc_verified_at: new Date(),
          kyc_expires_at: new Date(),
        });
        const review = makeReview({ status });
        const h = makeHarness({ customers: [customer], review });

        const result = await h.service.expireKycForUser(checker, 'customer-1', {
          reason: 'ID expired',
        });

        expect(result).toEqual({
          customerId: 'customer-1',
          kycStatus: CustomerKycStatus.EXPIRED,
          kycVersion: 1,
        });
        expect(review).toMatchObject({
          status: CustomerKycStatus.EXPIRED,
          rejection_reason: 'ID expired',
          reviewed_by: 'checker-1',
        });
        expect(customer).toMatchObject({
          kyc_verified_by: null,
          kyc_verified_at: null,
          kyc_expires_at: null,
          kyc_rejection_reason: 'ID expired',
        });
      },
    );

    it.each([
      CustomerKycStatus.PENDING,
      CustomerKycStatus.REJECTED,
      CustomerKycStatus.EXPIRED,
      CustomerKycStatus.REQUIRES_UPDATE,
    ])('refuses to expire a %s customer', async (status) => {
      const h = makeHarness({
        customers: [makeCustomer({ kyc_status: status })],
      });

      await expect(
        h.service.expireKycForUser(checker, 'customer-1', {} as any),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.customerRepo.save).not.toHaveBeenCalled();
    });
  });
});

describe('CustomersService customer scoping', () => {
  it("never returns another company's customer", async () => {
    const h = makeHarness({
      customers: [makeCustomer({ company_id: 'company-2' })],
    });

    await expect(
      h.service.getKycForUser(maker, 'customer-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not let KYC transitions touch another company's customer", async () => {
    const foreign = makeCustomer({
      company_id: 'company-2',
      kyc_status: CustomerKycStatus.IN_REVIEW,
      kyc_version: 1,
    });
    const h = makeHarness({ customers: [foreign] });

    await expect(
      h.service.approveKycReviewForUser(checker, 'customer-1', {} as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(foreign.kyc_status).toBe(CustomerKycStatus.IN_REVIEW);
  });

  it('rejects users without an active company membership', async () => {
    const h = makeHarness();

    await expect(
      h.service.getKycForUser(
        makeUser({ companyMembershipId: undefined }),
        'customer-1',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('hides soft-deleted customers from reads', async () => {
    const h = makeHarness({
      customers: [makeCustomer({ deleted_at: new Date() })],
    });

    await expect(
      h.service.getKycForUser(maker, 'customer-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a company-wide user read and write any company customer', async () => {
    const customer = makeCustomer({
      created_by: 'someone-else',
      kyc_status: CustomerKycStatus.VERIFIED,
    });
    const h = makeHarness({ customers: [customer] });

    await expect(
      h.service.getKycForUser(checker, 'customer-1'),
    ).resolves.toMatchObject({ customerId: 'customer-1' });
    await expect(
      h.service.expireKycForUser(checker, 'customer-1', {} as any),
    ).resolves.toMatchObject({ kycStatus: CustomerKycStatus.EXPIRED });
  });

  it('limits own-records users to customers they created', async () => {
    const ownOnly = makeUser({ id: 'user-9', permissions: [OWN_RECORDS] });
    const h = makeHarness({
      customers: [makeCustomer({ created_by: 'someone-else' })],
    });

    await expect(
      h.service.getKycForUser(ownOnly, 'customer-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets branch users read branch-linked customers but not write them', async () => {
    const branchUser = makeUser({
      id: 'branch-user',
      permissions: [],
      assignedBranchIds: ['branch-1'],
    });
    const customer = makeCustomer({
      created_by: 'someone-else',
      kyc_status: CustomerKycStatus.VERIFIED,
      _linkedBranchIds: ['branch-1'],
    });
    const h = makeHarness({ customers: [customer] });

    await expect(
      h.service.getKycForUser(branchUser, 'customer-1'),
    ).resolves.toMatchObject({ customerId: 'customer-1' });
    await expect(
      h.service.expireKycForUser(branchUser, 'customer-1', {} as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(customer.kyc_status).toBe(CustomerKycStatus.VERIFIED);
  });

  it('hides customers linked only to branches outside the user scope', async () => {
    const branchUser = makeUser({
      id: 'branch-user',
      permissions: [],
      assignedBranchIds: ['branch-1'],
    });
    const h = makeHarness({
      customers: [
        makeCustomer({
          created_by: 'someone-else',
          _linkedBranchIds: ['branch-2'],
        }),
      ],
    });

    await expect(
      h.service.getKycForUser(branchUser, 'customer-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
