import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import {
  Brackets,
  DataSource,
  EntityManager,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import {
  CustomerAddressInput,
  CustomerContactInput,
  CustomerIdentifierInput,
  CustomerWriteModel,
} from './customer-write-model';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomerDto } from './dto/filter-customer.dto';
import {
  CUSTOMER_SEARCH_MAX_LIMIT,
  SearchCustomersDto,
} from './dto/search-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerContact } from './entities/customer-contact.entity';
import { CustomerDocument } from './entities/customer-document.entity';
import { CustomerIdentifier } from './entities/customer-identifier.entity';
import { CustomerAuditLog } from './entities/customer-audit-log.entity';
import { CustomerVersion } from './entities/customer-version.entity';
import { Customer } from './entities/customer.entity';
import { InsuredAsset } from './entities/insured-asset.entity';
import { CustomerGender } from './enums/customer-gender.enum';
import { CustomerPolicyHolderType } from './enums/customer-policy-holder-type.enum';
import { CustomerStatus } from './enums/customer-status.enum';
import { CustomerType } from './enums/customer-type.enum';
import { TiraPolicyholderMapperService } from './services/tira-policyholder-mapper.service';
import {
  containsPattern,
  customerSearchDocumentSql,
  maskIdentifier,
  parseCustomerSearchTerm,
  prefixPattern,
} from './utils/customer-search.util';
import { quotationFlowForUnderwriteLine } from '@insurance-max/contracts';
import { policyBusinessLineSql } from '../policies/utils/policy-business-line.sql';

type IdentifierType =
  | 'NIN'
  | 'VOTER_NUMBER'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'ZANID'
  | 'TIN'
  | 'INCORPORATION_CERTIFICATE'
  | 'BUSINESS_REGISTRATION'
  | 'VRN'
  | 'OTHER';

type NumericLike = number | string | null | undefined;

@Injectable()
export class CustomersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerIdentifier)
    private readonly customerIdentifierRepository: Repository<CustomerIdentifier>,
    @InjectRepository(CustomerAddress)
    private readonly customerAddressRepository: Repository<CustomerAddress>,
    @InjectRepository(CustomerContact)
    private readonly customerContactRepository: Repository<CustomerContact>,
    @InjectRepository(CustomerDocument)
    private readonly customerDocumentRepository: Repository<CustomerDocument>,
    @InjectRepository(CustomerVersion)
    private readonly customerVersionRepository: Repository<CustomerVersion>,
    @InjectRepository(CustomerAuditLog)
    private readonly customerAuditLogRepository: Repository<CustomerAuditLog>,
    @InjectRepository(InsuredAsset)
    private readonly insuredAssetRepository: Repository<InsuredAsset>,
    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly tiraPolicyholderMapper: TiraPolicyholderMapperService,
  ) {}

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;

    return (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizePhone(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }

    return normalized.replace(/[\s()-]/g, '');
  }

  private normalizeEmail(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    return normalized ? normalized.toLowerCase() : null;
  }

  private normalizeCountryCode(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }

    return date.toISOString().slice(0, 10);
  }

  private normalizeTimestamp(value?: string | Date | null): Date | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }

    return date;
  }

  private normalizeNumeric(value: NumericLike): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException('Invalid numeric value');
    }

    return String(numeric);
  }

  private normalizeIdentifierValue(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }

    return normalized.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  private hashIdentifier(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private hashDefinition(definition: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(this.sortValue(definition)), 'utf8')
      .digest('hex');
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }

    if (typeof value === 'string') {
      return value.trim().replace(/\r\n/g, '\n');
    }

    return value;
  }

  private mapPolicyHolderTypeToCustomerType(
    policyHolderType: CustomerPolicyHolderType,
  ): CustomerType {
    return policyHolderType === CustomerPolicyHolderType.CORPORATE
      ? CustomerType.CORPORATE
      : CustomerType.INDIVIDUAL;
  }

  private mapPolicyHolderType(
    customerType: CustomerType,
  ): CustomerPolicyHolderType {
    return customerType === CustomerType.INDIVIDUAL
      ? CustomerPolicyHolderType.INDIVIDUAL
      : CustomerPolicyHolderType.CORPORATE;
  }

  private mapLegacyIdTypeToIdentifierType(
    idType?: number | null,
  ): IdentifierType {
    switch (idType) {
      case 1:
        return 'NIN';
      case 2:
        return 'VOTER_NUMBER';
      case 3:
        return 'PASSPORT';
      case 4:
        return 'DRIVING_LICENSE';
      case 5:
        return 'ZANID';
      case 6:
        return 'TIN';
      case 7:
        return 'INCORPORATION_CERTIFICATE';
      default:
        return 'OTHER';
    }
  }

  private mapIdentifierTypeToLegacyIdType(
    identifierType?: string | null,
  ): number | null {
    switch (identifierType) {
      case 'NIN':
        return 1;
      case 'VOTER_NUMBER':
        return 2;
      case 'PASSPORT':
        return 3;
      case 'DRIVING_LICENSE':
        return 4;
      case 'ZANID':
        return 5;
      case 'TIN':
        return 6;
      case 'INCORPORATION_CERTIFICATE':
        return 7;
      default:
        return null;
    }
  }

  /**
   * Splits an individual's PolicyHolderName into the stored name columns.
   * The full name is kept verbatim as display_name.
   */
  private splitPersonName(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { first_name: parts[0], middle_name: null, last_name: null };
    }

    return {
      first_name: parts[0] ?? null,
      middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
      last_name: parts[parts.length - 1] ?? null,
    };
  }

  /** Current stored values expressed as the public policyholder contract. */
  private toPolicyHolderFields(customer: Customer): Partial<CreateCustomerDto> {
    return {
      policy_holder_name:
        customer.display_name ??
        customer.company_name ??
        ([customer.first_name, customer.middle_name, customer.last_name]
          .filter(Boolean)
          .join(' ') ||
          undefined),
      policy_holder_birth_date: customer.date_of_birth ?? undefined,
      policy_holder_type:
        customer.policy_holder_type ??
        this.mapPolicyHolderType(customer.customer_type),
      policy_holder_id_number: customer.id_number ?? undefined,
      policy_holder_id_type: customer.id_type ?? undefined,
      gender: customer.gender,
      country_code: customer.country_code,
      region: customer.region,
      district: customer.district,
      street: customer.street ?? undefined,
      policy_holder_phone_number: customer.phone,
      policy_holder_fax: customer.fax,
      postal_address: customer.postal_address,
      email_address: customer.email,
    };
  }

  /**
   * Builds the persisted write model from the policyholder fields. When
   * updating, child records the policyholder contract does not describe
   * (secondary identifiers/addresses, representatives, extra phones) are
   * carried over so existing relationships survive the edit.
   */
  private buildWriteModel(
    input: Partial<CreateCustomerDto>,
    current?: {
      customer: Customer;
      identifiers: CustomerIdentifier[];
      addresses: CustomerAddress[];
      contacts: CustomerContact[];
    },
  ): CustomerWriteModel {
    const name = this.normalizeText(input.policy_holder_name);
    const birthDate = this.normalizeDate(input.policy_holder_birth_date);
    const policyHolderType = input.policy_holder_type
      ? Number(input.policy_holder_type)
      : null;
    const idType = input.policy_holder_id_type
      ? Number(input.policy_holder_id_type)
      : null;
    const idNumber = this.normalizeText(input.policy_holder_id_number);
    const gender = this.normalizeText(input.gender) as CustomerGender | null;
    const countryCode = this.normalizeCountryCode(input.country_code);
    const region = this.normalizeText(input.region);
    const district = this.normalizeText(input.district);
    const street = this.normalizeText(input.street);
    const phone = this.normalizePhone(input.policy_holder_phone_number);
    const fax = this.normalizePhone(input.policy_holder_fax);
    const email = this.normalizeEmail(input.email_address);
    const postalAddress = this.normalizeText(input.postal_address);

    const missing = [
      !name && 'policy_holder_name',
      !birthDate && 'policy_holder_birth_date',
      !policyHolderType && 'policy_holder_type',
      !idNumber && 'policy_holder_id_number',
      !idType && 'policy_holder_id_type',
      !countryCode && 'country_code',
      !region && 'region',
      !district && 'district',
      !street && 'street',
      !phone && 'policy_holder_phone_number',
      policyHolderType === CustomerPolicyHolderType.INDIVIDUAL &&
        !gender &&
        'gender',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required policyholder fields: ${missing.join(', ')}`,
      );
    }

    const customerType = this.mapPolicyHolderTypeToCustomerType(
      policyHolderType as CustomerPolicyHolderType,
    );
    const identifierType = this.mapLegacyIdTypeToIdentifierType(idType);

    const identifiers: CustomerIdentifierInput[] = [
      {
        identifier_type: identifierType,
        identifier_value: idNumber!,
        country_code: countryCode,
        is_primary: true,
        is_verified: false,
      },
      ...(current?.identifiers ?? [])
        .filter(
          (item) =>
            !item.is_primary &&
            item.identifier_type.trim().toUpperCase() !== identifierType,
        )
        .map((item) => ({
          identifier_type: item.identifier_type,
          identifier_value: item.identifier_value,
          country_code: item.country_code,
          is_primary: false,
          is_verified: item.is_verified,
          issued_at: item.issued_at,
          expires_at: item.expires_at,
          metadata: item.metadata,
        })),
    ];

    const currentPrimaryAddress = current?.addresses.find(
      (item) => item.is_primary,
    );
    const addresses: CustomerAddressInput[] = [
      {
        address_type: currentPrimaryAddress?.address_type ?? 'PHYSICAL',
        country_code: countryCode!,
        country: currentPrimaryAddress?.country ?? null,
        region: region!,
        district: district!,
        ward: currentPrimaryAddress?.ward ?? null,
        street,
        postal_address: postalAddress,
        latitude: currentPrimaryAddress?.latitude ?? null,
        longitude: currentPrimaryAddress?.longitude ?? null,
        is_primary: true,
      },
      ...(current?.addresses ?? [])
        .filter((item) => !item.is_primary)
        .map((item) => ({
          address_type: item.address_type,
          country_code: item.country_code,
          country: item.country,
          region: item.region,
          district: item.district,
          ward: item.ward,
          street: item.street,
          postal_address: item.postal_address,
          latitude: item.latitude,
          longitude: item.longitude,
          is_primary: false,
        })),
    ];

    const policyHolderContactTypes = new Set(['PHONE', 'FAX', 'EMAIL']);
    const contacts: CustomerContactInput[] = [
      { contact_type: 'PHONE', value: phone!, is_primary: true },
      ...(fax ? [{ contact_type: 'FAX', value: fax, is_primary: true }] : []),
      ...(email
        ? [{ contact_type: 'EMAIL', value: email, is_primary: true }]
        : []),
      ...(current?.contacts ?? [])
        .filter((item) => {
          const type = item.contact_type.trim().toUpperCase();
          // Primary phone/fax/email are replaced by the policyholder fields.
          return !(policyHolderContactTypes.has(type) && item.is_primary);
        })
        .filter((item) => {
          const type = item.contact_type.trim().toUpperCase();
          if (type === 'PHONE') return item.normalized_value !== phone;
          if (type === 'FAX') return item.normalized_value !== fax;
          if (type === 'EMAIL') return item.normalized_value !== email;
          return true;
        })
        .map((item) => {
          const type = item.contact_type.trim().toUpperCase();
          return {
            contact_type: item.contact_type,
            label: item.label,
            contact_name: item.contact_name,
            contact_role: item.contact_role,
            value: item.value,
            // A secondary fax/email becomes primary when the field is cleared.
            is_primary: policyHolderContactTypes.has(type)
              ? false
              : item.is_primary,
            is_verified: item.is_verified,
          };
        }),
    ];

    const personName =
      customerType === CustomerType.INDIVIDUAL
        ? this.splitPersonName(name!)
        : { first_name: null, middle_name: null, last_name: null };

    return {
      customer_type: customerType,
      display_name: name!,
      ...personName,
      company_name: customerType === CustomerType.CORPORATE ? name : null,
      gender,
      date_of_birth: birthDate!,
      id_type: idType!,
      id_number: idNumber!,
      phone: phone!,
      fax,
      email,
      country_code: countryCode!,
      region: region!,
      district: district!,
      street: street!,
      postal_address: postalAddress,
      status: current?.customer.status ?? CustomerStatus.ACTIVE,
      metadata: current?.customer.metadata ?? null,
      identifiers,
      addresses,
      contacts,
      duplicate_override_reason: this.normalizeText(
        input.duplicate_override_reason,
      ),
    };
  }

  private buildIdentityFingerprint(
    companyId: string,
    identifierType: string | null,
    identifierValue: string | null,
  ): string | null {
    const normalized = this.normalizeIdentifierValue(identifierValue);
    if (!normalized) {
      return null;
    }

    return this.hashIdentifier(
      `${companyId}|${identifierType ?? ''}|${normalized}`,
    );
  }

  private async assertExactIdentifierDuplicates(
    companyId: string,
    identifiers: CustomerIdentifierInput[],
    excludeCustomerId?: string,
  ): Promise<void> {
    for (const identifier of identifiers) {
      const normalizedValue = this.normalizeIdentifierValue(
        identifier.identifier_value,
      );

      if (!normalizedValue) {
        continue;
      }

      const fingerprint = this.hashIdentifier(normalizedValue);
      const existing = await this.customerIdentifierRepository
        .createQueryBuilder('identifier')
        .where('identifier.company_id = :companyId', { companyId })
        .andWhere('identifier.identifier_type = :identifierType', {
          identifierType: identifier.identifier_type.trim().toUpperCase(),
        })
        .andWhere('identifier.fingerprint = :fingerprint', { fingerprint })
        .andWhere('identifier.deleted_at IS NULL')
        .andWhere(
          excludeCustomerId
            ? 'identifier.customer_id != :excludeCustomerId'
            : '1=1',
          excludeCustomerId ? { excludeCustomerId } : {},
        )
        .getOne();

      if (existing) {
        throw new ConflictException(
          'A customer with the same official identifier already exists in this company.',
        );
      }
    }
  }

  private async assertPossibleContactDuplicates(
    user: AuthenticatedUser | null,
    companyId: string,
    contacts: CustomerContactInput[],
    duplicateOverrideReason: string | null,
    excludeCustomerId?: string,
  ): Promise<void> {
    const possibleDuplicates = contacts.filter((contact) => {
      const type = contact.contact_type.trim().toUpperCase();
      return type === 'PHONE' || type === 'EMAIL';
    });

    for (const contact of possibleDuplicates) {
      const contactType = contact.contact_type.trim().toUpperCase();
      const normalizedValue =
        contactType === 'PHONE'
          ? this.normalizePhone(contact.value)
          : this.normalizeEmail(contact.value);

      if (!normalizedValue) {
        continue;
      }

      const existing = await this.customerContactRepository
        .createQueryBuilder('contact')
        .where('contact.company_id = :companyId', { companyId })
        .andWhere('contact.contact_type = :contactType', { contactType })
        .andWhere('contact.normalized_value = :normalizedValue', {
          normalizedValue,
        })
        .andWhere('contact.deleted_at IS NULL')
        .andWhere(
          excludeCustomerId
            ? 'contact.customer_id != :excludeCustomerId'
            : '1=1',
          excludeCustomerId ? { excludeCustomerId } : {},
        )
        .getOne();

      if (!existing) {
        continue;
      }

      const hasOverridePermission = Boolean(
        user?.permissions?.includes('customers:duplicate-override'),
      );

      if (!hasOverridePermission || !duplicateOverrideReason) {
        throw new ConflictException({
          code: 'CUSTOMER_POSSIBLE_DUPLICATE',
          message:
            'A possible duplicate customer was found based on phone or email. Duplicate override permission and a reason are required.',
          duplicateType: contactType,
          duplicateValue: normalizedValue,
          existingCustomerId: existing.customer_id,
        });
      }
    }
  }

  private async findScopedCustomer(
    user: AuthenticatedUser,
    id: string,
    writeAccess = false,
    withDeleted = false,
  ): Promise<Customer> {
    const scope = this.dataAccessScopeService.resolve(user);
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.id = :id', { id });

    if (withDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.andWhere('customer.deleted_at IS NULL');
    }

    if (writeAccess) {
      this.dataAccessScopeService.applyCustomerWriteScope(
        queryBuilder,
        'customer',
        scope,
      );
    } else {
      this.dataAccessScopeService.applyCustomerReadScope(
        queryBuilder,
        'customer',
        scope,
      );
    }

    const customer = await queryBuilder.getOne();
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async generateCustomerNo(
    manager: DataSource['manager'],
    companyId: string,
  ) {
    const year = new Date().getFullYear();
    const prefix = `CUST-${year}-`;
    const lockKey = `${companyId}:${prefix}:${year}`;

    await manager.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [lockKey],
    );

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

  private projectCompatibilityFields(
    customer: Customer,
    model: CustomerWriteModel,
  ): Partial<Customer> {
    const identifierType = this.mapLegacyIdTypeToIdentifierType(model.id_type);

    const projection: Partial<Customer> = {
      display_name: model.display_name,
      customer_type: model.customer_type,
      policy_holder_type: this.mapPolicyHolderType(model.customer_type),
      first_name: model.first_name,
      middle_name: model.middle_name,
      last_name: model.last_name,
      company_name: model.company_name,
      gender: model.gender,
      date_of_birth: model.date_of_birth,
      id_type: model.id_type,
      id_number: model.id_number,
      registration_no: null,
      incorporation_certificate_no: null,
      tin: null,
      vrn: null,
      nida_no: null,
      voter_no: null,
      passport_no: null,
      driving_license_no: null,
      zanid_no: null,
      phone: model.phone,
      fax: model.fax,
      email: model.email,
      country_code: model.country_code,
      region: model.region,
      district: model.district,
      street: model.street,
      postal_address: model.postal_address,
      status: model.status,
      metadata: model.metadata,
      identity_fingerprint: this.buildIdentityFingerprint(
        customer.company_id,
        identifierType,
        model.id_number,
      ),
    };

    for (const identifier of model.identifiers) {
      const type = identifier.identifier_type.trim().toUpperCase();
      const value = this.normalizeText(identifier.identifier_value);
      switch (type) {
        case 'NIN':
          projection.nida_no = value;
          break;
        case 'VOTER_NUMBER':
          projection.voter_no = value;
          break;
        case 'PASSPORT':
          projection.passport_no = value;
          break;
        case 'DRIVING_LICENSE':
          projection.driving_license_no = value;
          break;
        case 'ZANID':
          projection.zanid_no = value;
          break;
        case 'TIN':
          projection.tin = value;
          break;
        case 'INCORPORATION_CERTIFICATE':
          projection.incorporation_certificate_no = value;
          break;
        case 'BUSINESS_REGISTRATION':
          projection.registration_no = value;
          break;
        case 'VRN':
          projection.vrn = value;
          break;
        default:
          break;
      }
    }

    return projection;
  }

  private async getCustomerRelations(
    manager: EntityManager,
    customerId: string,
  ): Promise<{
    identifiers: CustomerIdentifier[];
    addresses: CustomerAddress[];
    contacts: CustomerContact[];
    documents: CustomerDocument[];
  }> {
    // Sequential: the manager may be transactional (one pg connection).
    const identifiers = await manager.getRepository(CustomerIdentifier).find({
      where: { customer_id: customerId, deleted_at: IsNull() },
      order: { is_primary: 'DESC', created_at: 'ASC' },
    });
    const addresses = await manager.getRepository(CustomerAddress).find({
      where: { customer_id: customerId, deleted_at: IsNull() },
      order: { is_primary: 'DESC', created_at: 'ASC' },
    });
    const contacts = await manager.getRepository(CustomerContact).find({
      where: { customer_id: customerId, deleted_at: IsNull() },
      order: { contact_type: 'ASC', is_primary: 'DESC', created_at: 'ASC' },
    });
    const documents = await manager.getRepository(CustomerDocument).find({
      where: { customer_id: customerId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });

    return {
      identifiers,
      addresses,
      contacts,
      documents,
    };
  }

  private toCustomerSnapshot(
    customer: Customer,
    relations: {
      identifiers: CustomerIdentifier[];
      addresses: CustomerAddress[];
      contacts: CustomerContact[];
    },
  ) {
    const primaryIdentifier =
      relations.identifiers.find((item) => item.is_primary) ??
      relations.identifiers[0];

    return {
      customerId: customer.id,
      customerNumber: customer.customer_no,
      customerType: customer.customer_type,
      displayName: customer.display_name,
      firstName: customer.first_name,
      middleName: customer.middle_name,
      lastName: customer.last_name,
      companyName: customer.company_name,
      gender: customer.gender,
      dateOfBirth: customer.date_of_birth,
      nationality: customer.nationality,
      policyHolderType: customer.policy_holder_type,
      primaryIdType: customer.id_type,
      primaryIdNumber: customer.id_number,
      primaryPhone: customer.phone,
      primaryEmail: customer.email,
      identifiers: relations.identifiers.map((identifier) => ({
        type: identifier.identifier_type,
        value: identifier.identifier_value,
        countryCode: identifier.country_code,
        verified: identifier.is_verified,
      })),
      addresses: relations.addresses.map((address) => ({
        type: address.address_type,
        countryCode: address.country_code,
        country: address.country,
        region: address.region,
        district: address.district,
        ward: address.ward,
        street: address.street,
        postalAddress: address.postal_address,
      })),
      contacts: relations.contacts.map((contact) => ({
        type: contact.contact_type,
        value: contact.value,
        name: contact.contact_name,
        role: contact.contact_role,
      })),
      primaryIdentifierType: primaryIdentifier?.identifier_type ?? null,
    };
  }

  private buildFinalizedCustomerSnapshot(
    customer: Customer,
    relations: {
      identifiers: CustomerIdentifier[];
      addresses: CustomerAddress[];
      contacts: CustomerContact[];
    },
  ) {
    const baseSnapshot = this.toCustomerSnapshot(customer, relations);
    const snapshottedAt = new Date().toISOString();
    const snapshotHash = this.hashDefinition({
      ...baseSnapshot,
      snapshotHash: undefined,
      snapshottedAt,
    });

    return {
      ...baseSnapshot,
      snapshotHash,
      snapshottedAt,
    };
  }

  private diffSnapshotFields(
    oldSnapshot: Record<string, unknown> | null,
    newSnapshot: Record<string, unknown> | null,
  ): string[] {
    if (!oldSnapshot || !newSnapshot) {
      return Object.keys(newSnapshot ?? oldSnapshot ?? {});
    }

    const ignored = new Set(['snapshotHash', 'snapshottedAt']);
    const keys = new Set([
      ...Object.keys(oldSnapshot),
      ...Object.keys(newSnapshot),
    ]);

    return [...keys]
      .filter((key) => !ignored.has(key))
      .filter(
        (key) =>
          JSON.stringify(this.sortValue(oldSnapshot[key])) !==
          JSON.stringify(this.sortValue(newSnapshot[key])),
      )
      .sort();
  }

  private async createCustomerVersion(
    manager: EntityManager,
    customer: Customer,
    relations: {
      identifiers: CustomerIdentifier[];
      addresses: CustomerAddress[];
      contacts: CustomerContact[];
      documents: CustomerDocument[];
    },
    userId: string | null,
  ): Promise<CustomerVersion> {
    const versionRepository = manager.getRepository(CustomerVersion);
    const latest = await versionRepository.findOne({
      where: { customer_id: customer.id },
      order: { version_number: 'DESC' },
    });
    const versionNumber = Number(latest?.version_number ?? 0) + 1;
    const snapshot = this.buildFinalizedCustomerSnapshot(customer, relations);

    await versionRepository.update(
      { customer_id: customer.id, is_current_version: true },
      { is_current_version: false },
    );

    return versionRepository.save(
      versionRepository.create({
        company_id: customer.company_id,
        customer_id: customer.id,
        version_number: versionNumber,
        is_current_version: true,
        customer_snapshot: snapshot,
        customer_snapshot_hash: snapshot.snapshotHash,
        created_by: userId,
      }),
    );
  }

  private async getCurrentCustomerVersion(
    manager: EntityManager,
    customerId: string,
  ): Promise<CustomerVersion | null> {
    return manager.getRepository(CustomerVersion).findOne({
      where: { customer_id: customerId, is_current_version: true },
      order: { version_number: 'DESC' },
    });
  }

  private async recordCustomerAudit(
    manager: EntityManager,
    input: {
      customer: Customer;
      version: CustomerVersion | null;
      action: string;
      oldValues?: Record<string, unknown> | null;
      newValues?: Record<string, unknown> | null;
      user: AuthenticatedUser;
      source?: string;
    },
  ): Promise<void> {
    const fieldsChanged = this.diffSnapshotFields(
      input.oldValues ?? null,
      input.newValues ?? null,
    );

    await manager.getRepository(CustomerAuditLog).save(
      manager.getRepository(CustomerAuditLog).create({
        company_id: input.customer.company_id,
        customer_id: input.customer.id,
        customer_version_id: input.version?.id ?? null,
        action: input.action,
        old_values: input.oldValues ?? null,
        new_values: input.newValues ?? null,
        fields_changed: fieldsChanged,
        user_id: input.user.id,
        user_name: null,
        source: input.source ?? 'ADMIN_PORTAL',
      }),
    );
  }

  private async replaceChildRecords(
    manager: DataSource['manager'],
    customer: Customer,
    payload: CustomerWriteModel,
    userId: string,
  ) {
    await manager
      .getRepository(CustomerIdentifier)
      .softDelete({ customer_id: customer.id });
    await manager
      .getRepository(CustomerAddress)
      .softDelete({ customer_id: customer.id });
    await manager
      .getRepository(CustomerContact)
      .softDelete({ customer_id: customer.id });

    const identifierRepository = manager.getRepository(CustomerIdentifier);
    const addressRepository = manager.getRepository(CustomerAddress);
    const contactRepository = manager.getRepository(CustomerContact);

    const identifiers = payload.identifiers.map((identifier) => {
      const normalizedValue = this.normalizeIdentifierValue(
        identifier.identifier_value,
      );

      if (!normalizedValue) {
        throw new BadRequestException('Customer identifier value is required');
      }

      return identifierRepository.create({
        company_id: customer.company_id,
        customer_id: customer.id,
        identifier_type: identifier.identifier_type.trim().toUpperCase(),
        identifier_value: this.normalizeText(identifier.identifier_value)!,
        normalized_value: normalizedValue,
        fingerprint: this.hashIdentifier(normalizedValue),
        country_code: this.normalizeCountryCode(identifier.country_code),
        is_primary: identifier.is_primary !== false,
        is_verified: identifier.is_verified ?? false,
        issued_at: this.normalizeDate(identifier.issued_at),
        expires_at: this.normalizeDate(identifier.expires_at),
        metadata: identifier.metadata ?? null,
        created_by: userId,
        updated_by: userId,
      });
    });

    const addresses = payload.addresses.map((address) =>
      addressRepository.create({
        company_id: customer.company_id,
        customer_id: customer.id,
        address_type: address.address_type.trim().toUpperCase(),
        country_code: this.normalizeCountryCode(address.country_code) ?? 'TZA',
        country: this.normalizeText(address.country),
        region: this.normalizeText(address.region)!,
        district: this.normalizeText(address.district)!,
        ward: this.normalizeText(address.ward),
        street: this.normalizeText(address.street),
        postal_address: this.normalizeText(address.postal_address),
        latitude: this.normalizeNumeric(address.latitude),
        longitude: this.normalizeNumeric(address.longitude),
        is_primary: address.is_primary !== false,
        created_by: userId,
        updated_by: userId,
      }),
    );

    const contacts = payload.contacts.map((contact) => {
      const contactType = contact.contact_type.trim().toUpperCase();
      const normalizedValue =
        contactType === 'PHONE' || contactType === 'FAX'
          ? this.normalizePhone(contact.value)
          : contactType === 'EMAIL'
            ? this.normalizeEmail(contact.value)
            : this.normalizeText(contact.value);

      if (!normalizedValue) {
        throw new BadRequestException('Customer contact value is required');
      }

      return contactRepository.create({
        company_id: customer.company_id,
        customer_id: customer.id,
        contact_type: contactType,
        label: this.normalizeText(contact.label),
        contact_name: this.normalizeText(contact.contact_name),
        contact_role: this.normalizeText(contact.contact_role),
        value: this.normalizeText(contact.value)!,
        normalized_value: normalizedValue,
        is_primary: contact.is_primary !== false,
        is_verified: contact.is_verified ?? false,
        created_by: userId,
        updated_by: userId,
      });
    });

    await identifierRepository.save(identifiers);
    await addressRepository.save(addresses);
    await contactRepository.save(contacts);

    // Documents are not part of the policyholder contract; keep them as-is.
    const documents = await manager.getRepository(CustomerDocument).find({
      where: { customer_id: customer.id, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });

    return {
      identifiers,
      addresses,
      contacts,
      documents,
    };
  }

  private async attachCustomerRelations(customer: Customer) {
    const [identifiers, addresses, contacts, documents, insuredAssets] =
      await Promise.all([
        this.customerIdentifierRepository.find({
          where: { customer_id: customer.id, deleted_at: IsNull() },
          order: { is_primary: 'DESC', created_at: 'ASC' },
        }),
        this.customerAddressRepository.find({
          where: { customer_id: customer.id, deleted_at: IsNull() },
          order: { is_primary: 'DESC', created_at: 'ASC' },
        }),
        this.customerContactRepository.find({
          where: { customer_id: customer.id, deleted_at: IsNull() },
          order: { contact_type: 'ASC', is_primary: 'DESC', created_at: 'ASC' },
        }),
        this.customerDocumentRepository.find({
          where: { customer_id: customer.id, deleted_at: IsNull() },
          order: { created_at: 'DESC' },
        }),
        this.insuredAssetRepository.find({
          where: [
            { customer_id: customer.id, deleted_at: IsNull() },
            { owner_customer_id: customer.id, deleted_at: IsNull() },
          ],
          order: { updated_at: 'DESC' },
        }),
      ]);

    return {
      ...customer,
      identifiers,
      addresses,
      contacts,
      documents,
      insured_assets: insuredAssets,
    };
  }

  async createForUser(user: AuthenticatedUser, dto: CreateCustomerDto) {
    this.dataAccessScopeService.resolve(user);
    const payload = this.buildWriteModel(dto);

    await this.assertExactIdentifierDuplicates(
      user.companyId!,
      payload.identifiers,
    );
    await this.assertPossibleContactDuplicates(
      user,
      user.companyId!,
      payload.contacts,
      payload.duplicate_override_reason,
    );

    const customer = await this.dataSource.transaction(async (manager) => {
      const customerRepository = manager.getRepository(Customer);
      const customerNo = await this.generateCustomerNo(
        manager,
        user.companyId!,
      );
      const entity = customerRepository.create({
        company_id: user.companyId!,
        customer_no: customerNo,
        created_by: user.id,
        updated_by: user.id,
        data_source: 'MANUAL',
        ...this.projectCompatibilityFields(
          customerRepository.create({
            company_id: user.companyId!,
          } as Customer),
          payload,
        ),
      });

      const savedCustomer = await customerRepository.save(entity);
      const childRecords = await this.replaceChildRecords(
        manager,
        savedCustomer,
        payload,
        user.id,
      );

      savedCustomer.identity_fingerprint = this.buildIdentityFingerprint(
        savedCustomer.company_id,
        childRecords.identifiers.find((item) => item.is_primary)
          ?.identifier_type ?? null,
        childRecords.identifiers.find((item) => item.is_primary)
          ?.identifier_value ?? null,
      );

      await customerRepository.save(savedCustomer);

      const version = await this.createCustomerVersion(
        manager,
        savedCustomer,
        childRecords,
        user.id,
      );
      await this.recordCustomerAudit(manager, {
        customer: savedCustomer,
        version,
        action: 'CREATED',
        oldValues: null,
        newValues: version.customer_snapshot,
        user,
      });

      return savedCustomer;
    });

    return this.attachCustomerRelations(customer);
  }

  async create(companyId: string, dto: CreateCustomerDto, userId: string) {
    return this.createForUser(
      {
        id: userId,
        companyId,
        permissions: [],
        roles: [],
      } as unknown as AuthenticatedUser,
      dto,
    );
  }

  async findAllForUser(user: AuthenticatedUser, query: FilterCustomerDto) {
    const scope = this.dataAccessScopeService.resolve(user);
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      customer_type,
      status,
    } = query;

    const safeSortBy = [
      'customer_no',
      'first_name',
      'last_name',
      'company_name',
      'status',
      'customer_type',
      'created_at',
      'updated_at',
    ].includes(sortBy)
      ? sortBy
      : 'created_at';

    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.deleted_at IS NULL')
      .orderBy(`customer.${safeSortBy}`, direction)
      .addOrderBy('customer.id', direction);

    this.dataAccessScopeService.applyCustomerReadScope(
      queryBuilder,
      'customer',
      scope,
    );

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      queryBuilder.andWhere(
        `(
          customer.customer_no ILIKE :term
          OR customer.display_name ILIKE :term
          OR customer.first_name ILIKE :term
          OR customer.last_name ILIKE :term
          OR customer.company_name ILIKE :term
          OR customer.phone ILIKE :term
          OR customer.email ILIKE :term
          OR customer.id_number ILIKE :term
        )`,
        { term },
      );
    }

    if (customer_type) {
      queryBuilder.andWhere('customer.customer_type = :customerType', {
        customerType: customer_type,
      });
    }

    if (status) {
      queryBuilder.andWhere('customer.status = :status', { status });
    }

    if (query.business_line) {
      queryBuilder.andWhere(
        `(
          EXISTS (
            SELECT 1
            FROM quotations line_quotation
            LEFT JOIN quotation_policy_holders line_holder
              ON line_holder.quotation_id = line_quotation.id
            WHERE line_quotation.company_id = customer.company_id
              AND line_quotation.deleted_at IS NULL
              AND line_quotation.quotation_flow = :lineQuotationFlow
              AND (
                line_quotation.customer_id = customer.id
                OR line_holder.customer_id = customer.id
              )
          )
          OR EXISTS (
            SELECT 1
            FROM policies line_policy
            WHERE line_policy.customer_id = customer.id
              AND line_policy.company_id = customer.company_id
              AND line_policy.deleted_at IS NULL
              AND ${policyBusinessLineSql('line_policy')} = :lineBusinessLine
          )
        )`,
        {
          lineQuotationFlow: quotationFlowForUnderwriteLine(
            query.business_line,
          ),
          lineBusinessLine: query.business_line,
        },
      );
    }

    const skip = (page - 1) * limit;
    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Single-box lookup for the quotation wizards: one term matches names,
   * phone numbers, ID numbers and customer numbers, under the same read
   * scope as the customer list. Returns summary fields only; the caller loads
   * the full record with `findOneForUser` once a customer is chosen.
   */
  async searchForUser(user: AuthenticatedUser, query: SearchCustomersDto) {
    const limit = Math.min(query.limit ?? 20, CUSTOMER_SEARCH_MAX_LIMIT);
    const page = query.page ?? 1;
    const terms = parseCustomerSearchTerm(query.q);
    if (!terms) {
      return {
        data: [],
        meta: { page, limit, hasNextPage: false, hasPreviousPage: page > 1 },
      };
    }

    const scope = this.dataAccessScopeService.resolve(user);
    const document = customerSearchDocumentSql('customer');
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .select([
        'customer.id',
        'customer.customer_no',
        'customer.customer_type',
        'customer.policy_holder_type',
        'customer.display_name',
        'customer.first_name',
        'customer.middle_name',
        'customer.last_name',
        'customer.company_name',
        'customer.phone',
        'customer.id_type',
        'customer.id_number',
        'customer.status',
        'customer.updated_at',
      ])
      .where('customer.deleted_at IS NULL');

    this.dataAccessScopeService.applyCustomerReadScope(
      queryBuilder,
      'customer',
      scope,
    );

    terms.tokens.forEach((variants, tokenIndex) => {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          variants.forEach((variant, variantIndex) => {
            const parameter = `searchToken${tokenIndex}_${variantIndex}`;
            qb.orWhere(`${document} LIKE :${parameter} ESCAPE '\\'`, {
              [parameter]: containsPattern(variant),
            });
          });
        }),
      );
    });

    const exactPhone = terms.phone
      ? `OR right(regexp_replace(coalesce(customer.phone, ''), '[^0-9]', '', 'g'), 9) = :searchPhone`
      : '';
    const rows = await queryBuilder
      .orderBy(
        `CASE
          WHEN lower(customer.customer_no) = :searchExact
            OR upper(regexp_replace(coalesce(customer.id_number, ''), '[^A-Za-z0-9]', '', 'g')) = :searchCompact
            ${exactPhone}
            THEN 0
          WHEN lower(coalesce(customer.display_name, customer.company_name, customer.first_name, '')) LIKE :searchPrefix ESCAPE '\\'
            THEN 1
          ELSE 2
        END`,
        'ASC',
      )
      .addOrderBy('customer.updated_at', 'DESC')
      .addOrderBy('customer.id', 'ASC')
      .setParameters({
        searchExact: terms.exact,
        searchCompact: terms.compact,
        searchPhone: terms.phone,
        searchPrefix: prefixPattern(terms.prefix),
      })
      .offset((page - 1) * limit)
      .limit(limit + 1)
      .getMany();

    return {
      data: rows.slice(0, limit).map((customer) => ({
        id: customer.id,
        customer_no: customer.customer_no,
        customer_type: customer.customer_type,
        policy_holder_type: customer.policy_holder_type,
        name:
          customer.display_name ||
          customer.company_name ||
          [customer.first_name, customer.middle_name, customer.last_name]
            .filter(Boolean)
            .join(' '),
        phone: customer.phone,
        id_type: customer.id_type,
        id_number_masked: maskIdentifier(customer.id_number),
        status: customer.status,
      })),
      meta: {
        page,
        limit,
        hasNextPage: rows.length > limit,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOneForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, false);
    return this.attachCustomerRelations(customer);
  }

  async updateForUser(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCustomerDto,
  ) {
    const current = await this.findScopedCustomer(user, id, true);
    const currentRelations = await this.getCustomerRelations(
      this.dataSource.manager,
      current.id,
    );
    // PATCH semantics: omitted fields keep their stored value; an explicit
    // null clears an optional field.
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Partial<CreateCustomerDto>;
    const payload = this.buildWriteModel(
      { ...this.toPolicyHolderFields(current), ...changes },
      { customer: current, ...currentRelations },
    );

    await this.assertExactIdentifierDuplicates(
      user.companyId!,
      payload.identifiers,
      id,
    );
    await this.assertPossibleContactDuplicates(
      user,
      user.companyId!,
      payload.contacts,
      payload.duplicate_override_reason,
      id,
    );

    const updatedCustomer = await this.dataSource.transaction(
      async (manager) => {
        const repository = manager.getRepository(Customer);
        const customer = await repository.findOneOrFail({
          where: { id, company_id: user.companyId! },
        });
        const previousVersion = await this.getCurrentCustomerVersion(
          manager,
          customer.id,
        );
        const previousRelations = await this.getCustomerRelations(
          manager,
          customer.id,
        );
        const previousSnapshot =
          previousVersion?.customer_snapshot ??
          this.buildFinalizedCustomerSnapshot(customer, previousRelations);

        Object.assign(
          customer,
          this.projectCompatibilityFields(customer, payload),
        );
        customer.updated_by = user.id;

        const savedCustomer = await repository.save(customer);
        const childRecords = await this.replaceChildRecords(
          manager,
          savedCustomer,
          payload,
          user.id,
        );

        savedCustomer.identity_fingerprint = this.buildIdentityFingerprint(
          savedCustomer.company_id,
          childRecords.identifiers.find((item) => item.is_primary)
            ?.identifier_type ?? null,
          childRecords.identifiers.find((item) => item.is_primary)
            ?.identifier_value ?? null,
        );

        const finalCustomer = await repository.save(savedCustomer);
        const version = await this.createCustomerVersion(
          manager,
          finalCustomer,
          childRecords,
          user.id,
        );
        await this.recordCustomerAudit(manager, {
          customer: finalCustomer,
          version,
          action: 'UPDATED',
          oldValues: previousSnapshot,
          newValues: version.customer_snapshot,
          user,
        });

        return finalCustomer;
      },
    );

    return this.attachCustomerRelations(updatedCustomer);
  }

  async removeForUser(user: AuthenticatedUser, id: string): Promise<void> {
    const customer = await this.findScopedCustomer(user, id, true);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Customer);
      const currentCustomer = await repository.findOneOrFail({
        where: { id: customer.id, company_id: user.companyId! },
      });
      const currentVersion = await this.getCurrentCustomerVersion(
        manager,
        currentCustomer.id,
      );
      const relations = await this.getCustomerRelations(
        manager,
        currentCustomer.id,
      );
      const oldSnapshot =
        currentVersion?.customer_snapshot ??
        this.buildFinalizedCustomerSnapshot(currentCustomer, relations);

      currentCustomer.status = CustomerStatus.INACTIVE;
      currentCustomer.updated_by = user.id;
      await repository.save(currentCustomer);
      await repository.softDelete(currentCustomer.id);

      await this.recordCustomerAudit(manager, {
        customer: currentCustomer,
        version: currentVersion,
        action: 'ARCHIVED',
        oldValues: oldSnapshot,
        newValues: {
          ...oldSnapshot,
          status: CustomerStatus.INACTIVE,
          archivedAt: new Date().toISOString(),
        },
        user,
      });
    });
  }

  async restoreForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, true, true);
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Customer);
      await repository.restore(id);
      const restored = await repository.findOneOrFail({
        where: { id, company_id: user.companyId! },
      });
      const currentVersion = await this.getCurrentCustomerVersion(
        manager,
        restored.id,
      );
      restored.status = CustomerStatus.ACTIVE;
      restored.updated_by = user.id;
      await repository.save(restored);
      await this.recordCustomerAudit(manager, {
        customer: restored,
        version: currentVersion,
        action: 'ACTIVATED',
        oldValues: {
          customerId: customer.id,
          status: CustomerStatus.INACTIVE,
          deletedAt: customer.deleted_at?.toISOString() ?? null,
        },
        newValues: {
          customerId: restored.id,
          status: CustomerStatus.ACTIVE,
          deletedAt: null,
        },
        user,
      });
    });
    return this.findOneForUser(user, id);
  }

  async listVersionsForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, false, true);
    const versions = await this.customerVersionRepository.find({
      where: { customer_id: customer.id, company_id: customer.company_id },
      order: { version_number: 'DESC' },
    });

    if (versions.length === 0) {
      const relations = await this.getCustomerRelations(
        this.dataSource.manager,
        customer.id,
      );
      const snapshot = this.buildFinalizedCustomerSnapshot(customer, relations);
      return [
        {
          id: null,
          company_id: customer.company_id,
          customer_id: customer.id,
          version_number: 1,
          is_current_version: true,
          customer_snapshot: snapshot,
          customer_snapshot_hash: snapshot.snapshotHash,
          created_by: customer.created_by,
          created_at: customer.created_at,
        },
      ];
    }

    return versions;
  }

  async listAuditHistoryForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, false, true);
    return this.customerAuditLogRepository.find({
      where: { customer_id: customer.id, company_id: customer.company_id },
      order: { created_at: 'DESC' },
      take: 100,
    });
  }

  async generatePolicyHolderPayload(companyId: string, id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.toPolicyHolderPayload(customer);
  }

  toPolicyHolderPayload(customer: Customer) {
    return this.tiraPolicyholderMapper.mapCustomer(customer);
  }
}
