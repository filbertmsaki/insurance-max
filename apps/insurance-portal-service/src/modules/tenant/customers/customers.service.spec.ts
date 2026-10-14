import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { CustomersService } from './customers.service';
import { CustomerType } from './enums/customer-type.enum';
import { TiraPolicyholderMapperService } from './services/tira-policyholder-mapper.service';

const user = {
  id: 'user-1',
  scope: 'company',
  userType: 'STAFF',
  companyId: 'company-1',
  companyType: 'INSURANCE_COMPANY',
  companyMembershipId: 'membership-1',
  roles: ['STAFF'],
  permissions: ['data-scope:company-all'],
} as any;

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

function individualDto(overrides: Record<string, unknown> = {}) {
  return {
    customer_type: CustomerType.INDIVIDUAL,
    first_name: 'Asha',
    last_name: 'Juma',
    gender: 'F',
    date_of_birth: '1990-01-01',
    identifiers: [
      {
        identifier_type: 'NIN',
        identifier_value: '19900101-12345-00001-12',
        is_primary: true,
      },
    ],
    addresses: [
      {
        address_type: 'PHYSICAL',
        country_code: 'TZA',
        region: 'Dar es Salaam',
        district: 'Ilala',
        is_primary: true,
      },
    ],
    contacts: [
      { contact_type: 'PHONE', value: '+255 700 000 000', is_primary: true },
    ],
    ...overrides,
  } as any;
}

function corporateDto(overrides: Record<string, unknown> = {}) {
  return individualDto({
    customer_type: CustomerType.CORPORATE,
    first_name: undefined,
    last_name: undefined,
    gender: undefined,
    date_of_birth: undefined,
    company_name: 'Kilimo Ltd',
    identifiers: [
      {
        identifier_type: 'TIN',
        identifier_value: '100-200-300',
        is_primary: true,
      },
    ],
    ...overrides,
  });
}

function makeChainQueryBuilder(result: () => any) {
  const qb: any = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'limit']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn(async () => result());
  return qb;
}

function makeHarness(
  params: {
    existingIdentifier?: any;
    existingContact?: any;
    findOne?: any;
  } = {},
) {
  const identifierQb = makeChainQueryBuilder(
    () => params.existingIdentifier ?? null,
  );
  const contactQb = makeChainQueryBuilder(() => params.existingContact ?? null);

  const childRepo = () => ({
    softDelete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => value),
    find: jest.fn().mockResolvedValue([]),
  });
  const identifierRepo = {
    ...childRepo(),
    createQueryBuilder: jest.fn(() => identifierQb),
  };
  const contactRepo = {
    ...childRepo(),
    createQueryBuilder: jest.fn(() => contactQb),
  };
  const addressRepo = childRepo();
  const documentRepo = childRepo();
  const assetRepo = childRepo();

  const customerRepo = {
    createQueryBuilder: jest.fn(() => makeChainQueryBuilder(() => null)),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) =>
      Object.assign(value, { id: value.id ?? 'customer-new' }),
    ),
    findOne: jest.fn(async () => params.findOne ?? null),
  };
  const versionRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => ({ id: 'version-1', ...value })),
  };
  const auditRepo = {
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => value),
  };

  const manager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'Customer':
          return customerRepo;
        case 'CustomerIdentifier':
          return identifierRepo;
        case 'CustomerAddress':
          return addressRepo;
        case 'CustomerContact':
          return contactRepo;
        case 'CustomerDocument':
          return documentRepo;
        case 'CustomerVersion':
          return versionRepo;
        case 'CustomerAuditLog':
          return auditRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };
  const dataSource = {
    manager,
    transaction: jest.fn(async (fn: any) => fn(manager)),
  } as any;

  const service = new CustomersService(
    dataSource,
    customerRepo as any,
    identifierRepo as any,
    addressRepo as any,
    contactRepo as any,
    documentRepo as any,
    versionRepo as any,
    auditRepo as any,
    assetRepo as any,
    new DataAccessScopeService(),
    new TiraPolicyholderMapperService(),
  );

  return {
    service,
    dataSource,
    customerRepo,
    identifierRepo,
    identifierQb,
    contactRepo,
    addressRepo,
  };
}

describe('CustomersService customer validation', () => {
  it('creates a valid individual customer', async () => {
    const h = makeHarness();

    const customer = await h.service.createForUser(user, individualDto());

    expect(customer).toMatchObject({
      company_id: 'company-1',
      display_name: 'Asha Juma',
      id_type: 1,
      nida_no: '19900101-12345-00001-12',
      phone: '+255700000000',
    });
    expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('requires customer_type', async () => {
    const h = makeHarness();

    await expect(
      h.service.createForUser(
        user,
        individualDto({ customer_type: undefined }),
      ),
    ).rejects.toThrow('customer_type is required');
  });

  it.each([
    [{ first_name: '  ' }, 'first_name and last_name'],
    [{ last_name: undefined }, 'first_name and last_name'],
    [{ gender: undefined }, 'require gender'],
    [{ date_of_birth: undefined }, 'require date_of_birth'],
    [{ date_of_birth: 'not-a-date' }, 'Invalid date value'],
  ])('rejects an individual customer with %j', async (overrides, message) => {
    const h = makeHarness();

    await expect(
      h.service.createForUser(user, individualDto(overrides)),
    ).rejects.toThrow(message);
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('requires company_name for corporate customers', async () => {
    const h = makeHarness();

    await expect(
      h.service.createForUser(user, corporateDto({ company_name: ' ' })),
    ).rejects.toThrow('Corporate customers require company_name');
  });

  it('does not require personal fields for corporate customers', async () => {
    const h = makeHarness();

    const customer = await h.service.createForUser(user, corporateDto());

    expect(customer).toMatchObject({
      display_name: 'Kilimo Ltd',
      policy_holder_type: 2,
      first_name: null,
      gender: null,
      tin: '100-200-300',
      id_type: 6,
    });
  });

  it.each([
    [{ identifiers: [] }, 'At least one customer identifier is required'],
    [
      {
        identifiers: [
          { identifier_type: 'NIN', identifier_value: 'A1', is_primary: true },
          { identifier_type: 'TIN', identifier_value: 'B2' },
        ],
      },
      'Exactly one primary customer identifier is required',
    ],
    [{ addresses: [] }, 'At least one customer address is required'],
    [
      { contacts: [{ contact_type: 'EMAIL', value: 'a@b.tz' }] },
      'At least one phone contact is required',
    ],
    [
      {
        contacts: [
          { contact_type: 'PHONE', value: '0700000001', is_primary: true },
          { contact_type: 'phone', value: '0700000002', is_primary: true },
        ],
      },
      'Exactly one primary contact is required for contact type PHONE',
    ],
  ])('rejects structured payload %j', async (overrides, message) => {
    const h = makeHarness();

    const promise = h.service.createForUser(user, individualDto(overrides));

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(message);
  });

  it('builds identifiers, address and contacts from legacy flat fields', async () => {
    const h = makeHarness();

    const customer = await h.service.createForUser(
      user,
      individualDto({
        identifiers: undefined,
        addresses: undefined,
        contacts: undefined,
        id_type: 3,
        id_number: 'AB123456',
        country_code: 'tza',
        region: 'Arusha',
        district: 'Arusha CBD',
        phone: '0754 (123) 456',
      }),
    );

    expect(customer).toMatchObject({
      id_type: 3,
      passport_no: 'AB123456',
      country_code: 'TZA',
      region: 'Arusha',
      phone: '0754123456',
    });
  });

  it('persists an implicitly primary phone contact as primary', async () => {
    const h = makeHarness();

    await h.service.createForUser(
      user,
      individualDto({
        contacts: [{ contact_type: 'PHONE', value: '0700000000' }],
      }),
    );

    const saved = h.contactRepo.save.mock.calls[0][0];
    expect(saved).toEqual([
      expect.objectContaining({ contact_type: 'PHONE', is_primary: true }),
    ]);
  });

  it('persists exactly one primary identifier when the primary is implied', async () => {
    const h = makeHarness();

    await h.service.createForUser(
      user,
      individualDto({
        identifiers: [
          {
            identifier_type: 'TIN',
            identifier_value: '111',
            is_primary: false,
          },
          { identifier_type: 'NIN', identifier_value: '222' },
        ],
      }),
    );

    const saved = h.identifierRepo.save.mock.calls[0][0];
    expect(saved.filter((item: any) => item.is_primary)).toHaveLength(1);
  });
});

describe('CustomersService identifier duplicates', () => {
  it('rejects an identifier already used in the company before writing', async () => {
    const h = makeHarness({ existingIdentifier: { customer_id: 'other' } });

    await expect(
      h.service.createForUser(user, individualDto()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('matches on company, upper-cased type and a normalized-value fingerprint', async () => {
    const h = makeHarness();

    await (h.service as any).assertExactIdentifierDuplicates('company-1', [
      { identifier_type: ' nin ', identifier_value: 'ab-12 3' },
    ]);

    expect(h.identifierQb.where).toHaveBeenCalledWith(
      'identifier.company_id = :companyId',
      { companyId: 'company-1' },
    );
    expect(h.identifierQb.andWhere).toHaveBeenCalledWith(
      'identifier.identifier_type = :identifierType',
      { identifierType: 'NIN' },
    );
    expect(h.identifierQb.andWhere).toHaveBeenCalledWith(
      'identifier.fingerprint = :fingerprint',
      { fingerprint: sha256('AB123') },
    );
  });

  it('excludes the customer being updated from the duplicate search', async () => {
    const h = makeHarness();

    await (h.service as any).assertExactIdentifierDuplicates(
      'company-1',
      [{ identifier_type: 'NIN', identifier_value: 'X1' }],
      'customer-1',
    );

    expect(h.identifierQb.andWhere).toHaveBeenCalledWith(
      'identifier.customer_id != :excludeCustomerId',
      { excludeCustomerId: 'customer-1' },
    );
  });

  it('skips identifiers whose value normalizes to nothing', async () => {
    const h = makeHarness();

    await (h.service as any).assertExactIdentifierDuplicates('company-1', [
      { identifier_type: 'NIN', identifier_value: '  ' },
    ]);

    expect(h.identifierRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('flags a possible phone duplicate unless overridden with permission and reason', async () => {
    const existingContact = { customer_id: 'customer-9' };

    const denied = makeHarness({ existingContact });
    await expect(
      denied.service.createForUser(
        user,
        individualDto({ duplicate_override_reason: 'same family phone' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CUSTOMER_POSSIBLE_DUPLICATE',
        existingCustomerId: 'customer-9',
      }),
    });

    const allowed = makeHarness({ existingContact });
    await expect(
      allowed.service.createForUser(
        { ...user, permissions: ['customers:duplicate-override'] },
        individualDto({ duplicate_override_reason: 'same family phone' }),
      ),
    ).resolves.toMatchObject({ id: 'customer-new' });
  });
});

describe('CustomersService TIRA policyholder payload', () => {
  it('maps an individual customer', () => {
    const h = makeHarness();

    const payload = h.service.toPolicyHolderPayload({
      display_name: 'Asha Juma',
      company_name: null,
      date_of_birth: '1990-01-01',
      policy_holder_type: 1,
      id_number: '19900101123450000112',
      id_type: 1,
      gender: 'F',
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      street: 'Samora Ave',
      phone: '255700000000',
      fax: null,
      postal_address: 'P.O. Box 1',
      email: 'asha@example.tz',
    } as any);

    expect(payload).toEqual({
      PolicyHolderName: 'Asha Juma',
      PolicyHolderBirthDate: '1990-01-01',
      PolicyHolderType: 1,
      PolicyHolderIdNumber: '19900101123450000112',
      PolicyHolderIdType: 1,
      Gender: 'F',
      CountryCode: 'TZA',
      Region: 'Dar es Salaam',
      District: 'Ilala',
      Street: 'Samora Ave',
      PolicyHolderPhoneNumber: '255700000000',
      PolicyHolderFax: null,
      PostalAddress: 'P.O. Box 1',
      EmailAddress: 'asha@example.tz',
    });
  });

  it('maps a corporate customer with TIN identifier type', () => {
    const h = makeHarness();

    const payload = h.service.toPolicyHolderPayload({
      display_name: null,
      company_name: 'Kilimo Ltd',
      date_of_birth: null,
      policy_holder_type: 2,
      id_type: 6,
      id_number: '100200300',
      gender: null,
    } as any);

    expect(payload).toMatchObject({
      PolicyHolderName: 'Kilimo Ltd',
      PolicyHolderType: 2,
      PolicyHolderIdType: 6,
      PolicyHolderIdNumber: '100200300',
      PolicyHolderBirthDate: null,
      Gender: null,
    });
  });

  it('falls back to the joined personal name when no display name exists', () => {
    const h = makeHarness();

    const payload = h.service.toPolicyHolderPayload({
      display_name: null,
      company_name: null,
      first_name: 'Asha',
      middle_name: null,
      last_name: 'Juma',
    } as any);

    expect(payload.PolicyHolderName).toBe('Asha Juma');
  });

  it("does not generate a payload for another company's customer", async () => {
    const h = makeHarness({ findOne: null });

    await expect(
      h.service.generatePolicyHolderPayload('company-1', 'customer-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.customerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'customer-x', company_id: 'company-1' },
    });
  });
});
