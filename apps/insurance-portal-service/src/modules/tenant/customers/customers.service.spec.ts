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
    policy_holder_name: 'Asha Juma',
    policy_holder_birth_date: '1990-01-01',
    policy_holder_type: 1,
    policy_holder_id_number: '19900101-12345-00001-12',
    policy_holder_id_type: 1,
    gender: 'F',
    country_code: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    street: 'Samora Ave',
    policy_holder_phone_number: '+255 700 000 000',
    ...overrides,
  } as any;
}

function corporateDto(overrides: Record<string, unknown> = {}) {
  return individualDto({
    policy_holder_name: 'Kilimo Ltd',
    policy_holder_birth_date: '2010-05-20',
    policy_holder_type: 2,
    policy_holder_id_number: '100-200-300',
    policy_holder_id_type: 6,
    gender: undefined,
    ...overrides,
  });
}

function makeChainQueryBuilder(result: () => any) {
  const qb: any = {};
  for (const method of [
    'where',
    'andWhere',
    'orderBy',
    'limit',
    'setParameters',
    'withDeleted',
  ]) {
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
    scopedCustomer?: any;
    relations?: { identifiers?: any[]; addresses?: any[]; contacts?: any[] };
  } = {},
) {
  const identifierQb = makeChainQueryBuilder(
    () => params.existingIdentifier ?? null,
  );
  const contactQb = makeChainQueryBuilder(() => params.existingContact ?? null);

  const childRepo = (existing: any[] = []) => ({
    softDelete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => value),
    find: jest.fn().mockResolvedValue(existing),
  });
  const identifierRepo = {
    ...childRepo(params.relations?.identifiers),
    createQueryBuilder: jest.fn(() => identifierQb),
  };
  const contactRepo = {
    ...childRepo(params.relations?.contacts),
    createQueryBuilder: jest.fn(() => contactQb),
  };
  const addressRepo = childRepo(params.relations?.addresses);
  const documentRepo = childRepo();
  const assetRepo = childRepo();

  const customerRepo = {
    createQueryBuilder: jest.fn(() =>
      makeChainQueryBuilder(() =>
        params.scopedCustomer ? { ...params.scopedCustomer } : null,
      ),
    ),
    findOneOrFail: jest.fn(async () => ({ ...params.scopedCustomer })),
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
    documentRepo,
  };
}

describe('CustomersService customer validation', () => {
  it('creates a valid individual customer from policyholder fields', async () => {
    const h = makeHarness();

    const customer = await h.service.createForUser(
      user,
      individualDto({
        policy_holder_name: 'Asha Mwanaidi Juma',
        policy_holder_fax: '022 211 0000',
        postal_address: 'P.O. Box 1',
        email_address: 'Asha@Example.tz',
      }),
    );

    expect(customer).toMatchObject({
      company_id: 'company-1',
      customer_type: CustomerType.INDIVIDUAL,
      policy_holder_type: 1,
      display_name: 'Asha Mwanaidi Juma',
      first_name: 'Asha',
      middle_name: 'Mwanaidi',
      last_name: 'Juma',
      company_name: null,
      gender: 'F',
      date_of_birth: '1990-01-01',
      id_type: 1,
      id_number: '19900101-12345-00001-12',
      nida_no: '19900101-12345-00001-12',
      phone: '+255700000000',
      fax: '0222110000',
      email: 'asha@example.tz',
      street: 'Samora Ave',
      postal_address: 'P.O. Box 1',
    });
    expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ policy_holder_name: '  ' }, 'policy_holder_name'],
    [{ policy_holder_birth_date: undefined }, 'policy_holder_birth_date'],
    [{ policy_holder_type: undefined }, 'policy_holder_type'],
    [{ policy_holder_id_number: undefined }, 'policy_holder_id_number'],
    [{ policy_holder_id_type: undefined }, 'policy_holder_id_type'],
    [{ street: undefined }, 'street'],
    [{ policy_holder_phone_number: ' ' }, 'policy_holder_phone_number'],
    [{ gender: undefined }, 'gender'],
    [{ policy_holder_birth_date: 'not-a-date' }, 'Invalid date value'],
  ])('rejects an individual customer with %j', async (overrides, message) => {
    const h = makeHarness();

    const promise = h.service.createForUser(user, individualDto(overrides));

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(message);
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('does not require gender for corporate customers', async () => {
    const h = makeHarness();

    const customer = await h.service.createForUser(user, corporateDto());

    expect(customer).toMatchObject({
      customer_type: CustomerType.CORPORATE,
      display_name: 'Kilimo Ltd',
      company_name: 'Kilimo Ltd',
      policy_holder_type: 2,
      first_name: null,
      gender: null,
      date_of_birth: '2010-05-20',
      tin: '100-200-300',
      id_type: 6,
    });
  });

  it('keeps an optional gender supplied for a corporate customer', async () => {
    const h = makeHarness();

    const customer = await h.service.createForUser(
      user,
      corporateDto({ gender: 'M' }),
    );

    expect(customer).toMatchObject({ gender: 'M' });
  });

  it('builds the primary identifier, address and contacts', async () => {
    const h = makeHarness();

    await h.service.createForUser(
      user,
      individualDto({
        policy_holder_id_type: 3,
        policy_holder_id_number: 'AB123456',
        country_code: 'tza',
        email_address: 'a@b.tz',
      }),
    );

    expect(h.identifierRepo.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        identifier_type: 'PASSPORT',
        identifier_value: 'AB123456',
        is_primary: true,
      }),
    ]);
    expect(h.addressRepo.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        country_code: 'TZA',
        region: 'Dar es Salaam',
        district: 'Ilala',
        street: 'Samora Ave',
        is_primary: true,
      }),
    ]);
    expect(h.contactRepo.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({ contact_type: 'PHONE', is_primary: true }),
      expect.objectContaining({ contact_type: 'EMAIL', is_primary: true }),
    ]);
  });
});

describe('CustomersService update', () => {
  const stored = {
    id: 'customer-1',
    company_id: 'company-1',
    customer_type: CustomerType.INDIVIDUAL,
    policy_holder_type: 1,
    display_name: 'Asha Juma',
    first_name: 'Asha',
    middle_name: null,
    last_name: 'Juma',
    company_name: null,
    gender: 'F',
    date_of_birth: '1990-01-01',
    id_type: 1,
    id_number: 'NIN-1',
    phone: '+255700000000',
    fax: '0222110000',
    email: 'asha@example.tz',
    country_code: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    street: 'Samora Ave',
    postal_address: null,
    nationality: 'Tanzanian',
    status: 'ACTIVE',
    metadata: { source: 'legacy' },
  };

  function relations() {
    return {
      identifiers: [
        { identifier_type: 'NIN', identifier_value: 'NIN-1', is_primary: true },
        {
          identifier_type: 'TIN',
          identifier_value: 'TIN-9',
          is_primary: false,
          is_verified: true,
        },
      ],
      addresses: [
        {
          address_type: 'PHYSICAL',
          country_code: 'TZA',
          region: 'Dar es Salaam',
          district: 'Ilala',
          ward: 'Kariakoo',
          street: 'Samora Ave',
          is_primary: true,
        },
      ],
      contacts: [
        {
          contact_type: 'PHONE',
          value: '+255700000000',
          normalized_value: '+255700000000',
          is_primary: true,
        },
        {
          contact_type: 'FAX',
          value: '0222110000',
          normalized_value: '0222110000',
          is_primary: true,
        },
        {
          contact_type: 'REPRESENTATIVE',
          value: '0711111111',
          normalized_value: '0711111111',
          contact_name: 'Juma',
          is_primary: true,
        },
      ],
    };
  }

  it('applies a partial change and keeps the other policyholder fields', async () => {
    const h = makeHarness({ scopedCustomer: stored, relations: relations() });

    const customer = await h.service.updateForUser(user, 'customer-1', {
      street: 'Uhuru St',
    });

    expect(customer).toMatchObject({
      street: 'Uhuru St',
      display_name: 'Asha Juma',
      phone: '+255700000000',
      fax: '0222110000',
      nationality: 'Tanzanian',
      metadata: { source: 'legacy' },
      tin: 'TIN-9',
    });
  });

  it('preserves secondary identifiers, address details and representatives', async () => {
    const h = makeHarness({ scopedCustomer: stored, relations: relations() });

    await h.service.updateForUser(user, 'customer-1', {
      policy_holder_fax: null,
    });

    expect(h.identifierRepo.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({ identifier_type: 'NIN', is_primary: true }),
      expect.objectContaining({
        identifier_type: 'TIN',
        is_primary: false,
        is_verified: true,
      }),
    ]);
    expect(h.addressRepo.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({ ward: 'Kariakoo', is_primary: true }),
    ]);
    const contacts = h.contactRepo.save.mock.calls[0][0];
    expect(contacts.map((item: any) => item.contact_type)).toEqual([
      'PHONE',
      'EMAIL',
      'REPRESENTATIVE',
    ]);
    expect(h.documentRepo.softDelete).not.toHaveBeenCalled();
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
