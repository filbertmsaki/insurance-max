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

import { ApproveCustomerKycReviewDto } from './dto/approve-customer-kyc-review.dto';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import {
  CreateCustomerDto,
  CustomerAddressDto,
  CustomerContactDto,
  CustomerDocumentDto,
  CustomerIdentifierDto,
} from './dto/create-customer.dto';
import { FilterCustomerDto } from './dto/filter-customer.dto';
import { RejectCustomerKycReviewDto } from './dto/reject-customer-kyc-review.dto';
import { RequestCustomerKycUpdateDto } from './dto/request-customer-kyc-update.dto';
import { SubmitCustomerKycReviewDto } from './dto/submit-customer-kyc-review.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerContact } from './entities/customer-contact.entity';
import { CustomerDocument } from './entities/customer-document.entity';
import { CustomerIdentifier } from './entities/customer-identifier.entity';
import { CustomerKycReview } from './entities/customer-kyc-review.entity';
import { Customer } from './entities/customer.entity';
import { InsuredAsset } from './entities/insured-asset.entity';
import { CustomerKycStatus } from './enums/customer-kyc-status.enum';
import { CustomerPolicyHolderType } from './enums/customer-policy-holder-type.enum';
import { CustomerStatus } from './enums/customer-status.enum';
import { CustomerType } from './enums/customer-type.enum';

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

interface NormalizedCustomerPayload {
  dto: CreateCustomerDto | UpdateCustomerDto;
  customerType: CustomerType;
  identifiers: CustomerIdentifierDto[];
  addresses: CustomerAddressDto[];
  contacts: CustomerContactDto[];
  documents: CustomerDocumentDto[];
  displayName: string;
  possibleDuplicateOverrideReason: string | null;
}

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
    @InjectRepository(CustomerKycReview)
    private readonly customerKycReviewRepository: Repository<CustomerKycReview>,
    @InjectRepository(InsuredAsset)
    private readonly insuredAssetRepository: Repository<InsuredAsset>,
    private readonly dataAccessScopeService: DataAccessScopeService,
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

  private buildDisplayName(dto: CreateCustomerDto | UpdateCustomerDto): string {
    if (dto.customer_type === CustomerType.CORPORATE) {
      return (
        this.normalizeText(dto.company_name) ??
        this.normalizeText(dto.registration_no) ??
        'Corporate Customer'
      );
    }

    return (
      [
        this.normalizeText(dto.first_name),
        this.normalizeText(dto.middle_name),
        this.normalizeText(dto.last_name),
      ]
        .filter(Boolean)
        .join(' ') || 'Individual Customer'
    );
  }

  private buildLegacyIdentifier(
    customerType: CustomerType,
    dto: CreateCustomerDto | UpdateCustomerDto,
  ) {
    const identifierValue =
      this.normalizeText(dto.id_number) ??
      this.normalizeText(dto.nida_no) ??
      this.normalizeText(dto.voter_no) ??
      this.normalizeText(dto.passport_no) ??
      this.normalizeText(dto.driving_license_no) ??
      this.normalizeText(dto.zanid_no) ??
      this.normalizeText(dto.tin) ??
      this.normalizeText(dto.incorporation_certificate_no) ??
      this.normalizeText(dto.registration_no) ??
      null;

    if (!identifierValue) {
      return null;
    }

    return {
      identifier_type: this.mapLegacyIdTypeToIdentifierType(dto.id_type),
      identifier_value: identifierValue,
      country_code: this.normalizeCountryCode(dto.country_code) ?? 'TZA',
      is_primary: true,
      is_verified: false,
    } satisfies CustomerIdentifierDto;
  }

  private buildLegacyAddress(dto: CreateCustomerDto | UpdateCustomerDto) {
    const region = this.normalizeText(dto.region);
    const district = this.normalizeText(dto.district);
    const countryCode = this.normalizeCountryCode(dto.country_code);

    if (!region || !district || !countryCode) {
      return null;
    }

    return {
      address_type: 'PHYSICAL',
      country_code: countryCode,
      country: this.normalizeText(dto.country),
      region,
      district,
      ward: this.normalizeText(dto.ward),
      street: this.normalizeText(dto.street),
      postal_address: this.normalizeText(dto.postal_address),
      latitude:
        dto.latitude !== undefined && dto.latitude !== null
          ? Number(dto.latitude)
          : null,
      longitude:
        dto.longitude !== undefined && dto.longitude !== null
          ? Number(dto.longitude)
          : null,
      is_primary: true,
    } satisfies CustomerAddressDto;
  }

  private buildLegacyContacts(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): CustomerContactDto[] {
    const contacts: CustomerContactDto[] = [];
    const phone = this.normalizePhone(dto.phone);
    if (phone) {
      contacts.push({
        contact_type: 'PHONE',
        value: phone,
        is_primary: true,
        is_verified: false,
      });
    }

    const alternatePhone = this.normalizePhone(dto.alternate_phone);
    if (alternatePhone) {
      contacts.push({
        contact_type: 'PHONE',
        value: alternatePhone,
        is_primary:
          contacts.filter((item) => item.contact_type === 'PHONE').length === 0,
      });
    }

    const fax = this.normalizePhone(dto.fax);
    if (fax) {
      contacts.push({
        contact_type: 'FAX',
        value: fax,
        is_primary: true,
      });
    }

    const email = this.normalizeEmail(dto.email);
    if (email) {
      contacts.push({
        contact_type: 'EMAIL',
        value: email,
        is_primary: true,
      });
    }

    const representativePhone = this.normalizePhone(dto.contact_phone);
    const representativeEmail = this.normalizeEmail(dto.contact_email);
    const representativeName = this.normalizeText(dto.contact_name);
    const representativeRole = this.normalizeText(dto.contact_role);

    if (
      representativePhone ||
      representativeEmail ||
      representativeName ||
      representativeRole
    ) {
      contacts.push({
        contact_type: 'REPRESENTATIVE',
        value:
          representativePhone ??
          representativeEmail ??
          representativeName ??
          'REPRESENTATIVE',
        contact_name: representativeName,
        contact_role: representativeRole,
        label: 'Primary representative',
        is_primary: true,
      });
    }

    return contacts;
  }

  private buildLegacyDocuments(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): CustomerDocumentDto[] {
    const documentType = this.normalizeText(dto.document_type ?? null);
    if (!documentType) {
      return [];
    }

    return [
      {
        document_type: documentType,
        document_number: this.normalizeText(dto.document_no),
        original_file_name: this.normalizeText(dto.document_file_name),
        mime_type: this.normalizeText(dto.document_mime_type),
        status: dto.document_verified ? 'VERIFIED' : 'PENDING',
      },
    ];
  }

  private normalizeCustomerPayload(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): NormalizedCustomerPayload {
    const customerType = dto.customer_type;
    if (!customerType) {
      throw new BadRequestException('customer_type is required');
    }

    const identifiers =
      dto.identifiers && dto.identifiers.length > 0
        ? dto.identifiers
        : this.buildLegacyIdentifier(customerType, dto)
          ? [this.buildLegacyIdentifier(customerType, dto)!]
          : [];

    const addresses =
      dto.addresses && dto.addresses.length > 0
        ? dto.addresses
        : this.buildLegacyAddress(dto)
          ? [this.buildLegacyAddress(dto)!]
          : [];

    const contacts =
      dto.contacts && dto.contacts.length > 0
        ? dto.contacts
        : this.buildLegacyContacts(dto);

    const documents =
      dto.documents && dto.documents.length > 0
        ? dto.documents
        : this.buildLegacyDocuments(dto);

    this.assertCustomerRules(dto, identifiers, addresses, contacts);

    return {
      dto,
      customerType,
      identifiers,
      addresses,
      contacts,
      documents,
      displayName: this.buildDisplayName(dto),
      possibleDuplicateOverrideReason:
        this.normalizeText(dto.duplicate_override_reason) ?? null,
    };
  }

  private assertCustomerRules(
    dto: CreateCustomerDto | UpdateCustomerDto,
    identifiers: CustomerIdentifierDto[],
    addresses: CustomerAddressDto[],
    contacts: CustomerContactDto[],
  ): void {
    if (dto.customer_type === CustomerType.INDIVIDUAL) {
      if (
        !this.normalizeText(dto.first_name) ||
        !this.normalizeText(dto.last_name)
      ) {
        throw new BadRequestException(
          'Individual customers require first_name and last_name',
        );
      }

      if (!dto.gender) {
        throw new BadRequestException('Individual customers require gender');
      }

      if (!this.normalizeDate(dto.date_of_birth)) {
        throw new BadRequestException(
          'Individual customers require date_of_birth',
        );
      }
    }

    if (dto.customer_type === CustomerType.CORPORATE) {
      if (!this.normalizeText(dto.company_name)) {
        throw new BadRequestException(
          'Corporate customers require company_name',
        );
      }
    }

    if (identifiers.length < 1) {
      throw new BadRequestException(
        'At least one customer identifier is required',
      );
    }

    const primaryIdentifiers = identifiers.filter(
      (item) => item.is_primary !== false,
    );
    if (primaryIdentifiers.length !== 1) {
      throw new BadRequestException(
        'Exactly one primary customer identifier is required',
      );
    }

    if (addresses.length < 1) {
      throw new BadRequestException(
        'At least one customer address is required',
      );
    }

    const primaryAddresses = addresses.filter(
      (item) => item.is_primary !== false,
    );
    if (primaryAddresses.length !== 1) {
      throw new BadRequestException(
        'Exactly one primary customer address is required',
      );
    }

    const phoneContacts = contacts.filter(
      (item) => item.contact_type.trim().toUpperCase() === 'PHONE',
    );
    if (phoneContacts.length < 1) {
      throw new BadRequestException('At least one phone contact is required');
    }

    const primaryContactCountByType = new Map<string, number>();
    for (const contact of contacts) {
      const type = contact.contact_type.trim().toUpperCase();
      if (contact.is_primary !== false) {
        primaryContactCountByType.set(
          type,
          Number(primaryContactCountByType.get(type) ?? 0) + 1,
        );
      }
    }

    for (const [type, count] of primaryContactCountByType.entries()) {
      if (count !== 1) {
        throw new BadRequestException(
          `Exactly one primary contact is required for contact type ${type}`,
        );
      }
    }
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
    identifiers: CustomerIdentifierDto[],
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
    contacts: CustomerContactDto[],
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
    payload: NormalizedCustomerPayload,
  ): Partial<Customer> {
    const primaryIdentifier =
      payload.identifiers.find((item) => item.is_primary !== false) ??
      payload.identifiers[0];
    const primaryAddress =
      payload.addresses.find((item) => item.is_primary !== false) ??
      payload.addresses[0];

    const phoneContacts = payload.contacts.filter(
      (item) => item.contact_type.trim().toUpperCase() === 'PHONE',
    );
    const emailContacts = payload.contacts.filter(
      (item) => item.contact_type.trim().toUpperCase() === 'EMAIL',
    );
    const representative =
      payload.contacts.find(
        (item) => item.contact_type.trim().toUpperCase() === 'REPRESENTATIVE',
      ) ?? null;
    const primaryDocument = payload.documents[0] ?? null;

    const identifierType =
      primaryIdentifier?.identifier_type?.trim().toUpperCase() ?? null;
    const idType = this.mapIdentifierTypeToLegacyIdType(identifierType);
    const idNumber = this.normalizeText(primaryIdentifier?.identifier_value);

    const projection: Partial<Customer> = {
      display_name: payload.displayName,
      customer_type: payload.customerType,
      policy_holder_type: this.mapPolicyHolderType(payload.customerType),
      first_name:
        payload.customerType === CustomerType.INDIVIDUAL
          ? this.normalizeText(payload.dto.first_name)
          : null,
      middle_name:
        payload.customerType === CustomerType.INDIVIDUAL
          ? this.normalizeText(payload.dto.middle_name)
          : null,
      last_name:
        payload.customerType === CustomerType.INDIVIDUAL
          ? this.normalizeText(payload.dto.last_name)
          : null,
      gender:
        payload.customerType === CustomerType.INDIVIDUAL
          ? (payload.dto.gender ?? null)
          : null,
      date_of_birth: this.normalizeDate(payload.dto.date_of_birth),
      nationality: this.normalizeText(payload.dto.nationality),
      company_name:
        payload.customerType === CustomerType.CORPORATE
          ? this.normalizeText(payload.dto.company_name)
          : null,
      registration_no: null,
      incorporation_certificate_no: null,
      tin: null,
      vrn: null,
      id_type: idType,
      id_number: idNumber,
      nida_no: null,
      voter_no: null,
      passport_no: null,
      driving_license_no: null,
      zanid_no: null,
      phone:
        this.normalizePhone(phoneContacts[0]?.value) ?? customer.phone ?? '',
      alternate_phone: this.normalizePhone(phoneContacts[1]?.value),
      fax:
        this.normalizePhone(
          payload.contacts.find(
            (item) => item.contact_type.trim().toUpperCase() === 'FAX',
          )?.value,
        ) ?? null,
      email: this.normalizeEmail(emailContacts[0]?.value),
      country: this.normalizeText(primaryAddress?.country),
      country_code:
        this.normalizeCountryCode(primaryAddress?.country_code) ?? 'TZA',
      region: this.normalizeText(primaryAddress?.region) ?? '',
      district: this.normalizeText(primaryAddress?.district) ?? '',
      ward: this.normalizeText(primaryAddress?.ward),
      street: this.normalizeText(primaryAddress?.street),
      postal_address: this.normalizeText(primaryAddress?.postal_address),
      latitude: this.normalizeNumeric(primaryAddress?.latitude),
      longitude: this.normalizeNumeric(primaryAddress?.longitude),
      contact_name: this.normalizeText(representative?.contact_name),
      contact_role: this.normalizeText(representative?.contact_role),
      contact_phone: representative
        ? this.normalizePhone(representative.value)
        : null,
      contact_email: representative
        ? this.normalizeEmail(representative.value)
        : null,
      document_type: (primaryDocument?.document_type as any) ?? null,
      document_no: this.normalizeText(primaryDocument?.document_number),
      document_file_name: this.normalizeText(
        primaryDocument?.original_file_name,
      ),
      document_file_url: customer.document_file_url ?? null,
      document_mime_type: this.normalizeText(primaryDocument?.mime_type),
      document_verified:
        (primaryDocument?.status ?? '').trim().toUpperCase() === 'VERIFIED',
      document_verified_at:
        (primaryDocument?.status ?? '').trim().toUpperCase() === 'VERIFIED'
          ? new Date()
          : null,
      status: payload.dto.status ?? customer.status ?? CustomerStatus.ACTIVE,
      metadata: payload.dto.metadata ?? customer.metadata ?? null,
      identity_fingerprint: this.buildIdentityFingerprint(
        customer.company_id,
        identifierType,
        idNumber,
      ),
    };

    for (const identifier of payload.identifiers) {
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
    const [identifiers, addresses, contacts, documents] = await Promise.all([
      manager.getRepository(CustomerIdentifier).find({
        where: { customer_id: customerId, deleted_at: IsNull() },
        order: { is_primary: 'DESC', created_at: 'ASC' },
      }),
      manager.getRepository(CustomerAddress).find({
        where: { customer_id: customerId, deleted_at: IsNull() },
        order: { is_primary: 'DESC', created_at: 'ASC' },
      }),
      manager.getRepository(CustomerContact).find({
        where: { customer_id: customerId, deleted_at: IsNull() },
        order: { contact_type: 'ASC', is_primary: 'DESC', created_at: 'ASC' },
      }),
      manager.getRepository(CustomerDocument).find({
        where: { customer_id: customerId, deleted_at: IsNull() },
        order: { created_at: 'DESC' },
      }),
    ]);

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
      kycStatus: customer.kyc_status,
      kycVersion: customer.kyc_version,
      kycVerifiedAt: customer.kyc_verified_at?.toISOString() ?? null,
      kycExpiresAt: customer.kyc_expires_at?.toISOString() ?? null,
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

  private assertCustomerReadyForKycReview(relations: {
    identifiers: CustomerIdentifier[];
    addresses: CustomerAddress[];
    contacts: CustomerContact[];
    documents: CustomerDocument[];
  }): void {
    if (relations.identifiers.length < 1) {
      throw new ConflictException(
        'Customer identifiers are required before KYC review.',
      );
    }

    if (relations.addresses.length < 1) {
      throw new ConflictException(
        'Customer addresses are required before KYC review.',
      );
    }

    if (
      !relations.contacts.some(
        (contact) => contact.contact_type.trim().toUpperCase() === 'PHONE',
      )
    ) {
      throw new ConflictException(
        'At least one customer phone contact is required before KYC review.',
      );
    }

    if (relations.documents.length < 1) {
      throw new ConflictException(
        'At least one KYC document is required before KYC review.',
      );
    }
  }

  private async findOpenKycReview(
    manager: EntityManager,
    customer: Customer,
  ): Promise<CustomerKycReview> {
    const review = await manager.getRepository(CustomerKycReview).findOne({
      where: {
        customer_id: customer.id,
        kyc_version: customer.kyc_version,
        status: CustomerKycStatus.IN_REVIEW,
      },
      order: { created_at: 'DESC' },
    });

    if (!review) {
      throw new NotFoundException('Open KYC review was not found.');
    }

    return review;
  }

  private async replaceChildRecords(
    manager: DataSource['manager'],
    customer: Customer,
    payload: NormalizedCustomerPayload,
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
    await manager
      .getRepository(CustomerDocument)
      .softDelete({ customer_id: customer.id });

    const identifierRepository = manager.getRepository(CustomerIdentifier);
    const addressRepository = manager.getRepository(CustomerAddress);
    const contactRepository = manager.getRepository(CustomerContact);
    const documentRepository = manager.getRepository(CustomerDocument);

    const identifiers = payload.identifiers.map((identifier, index) => {
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
        is_primary: identifier.is_primary ?? index === 0,
        is_verified: identifier.is_verified ?? false,
        issued_at: this.normalizeDate(identifier.issued_at),
        expires_at: this.normalizeDate(identifier.expires_at),
        metadata: identifier.metadata ?? null,
        created_by: userId,
        updated_by: userId,
      });
    });

    const addresses = payload.addresses.map((address, index) =>
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
        is_primary: address.is_primary ?? index === 0,
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
        is_primary: contact.is_primary ?? false,
        is_verified: contact.is_verified ?? false,
        created_by: userId,
        updated_by: userId,
      });
    });

    const documents = payload.documents.map((document) =>
      documentRepository.create({
        company_id: customer.company_id,
        customer_id: customer.id,
        document_type: document.document_type.trim().toUpperCase(),
        document_number: this.normalizeText(document.document_number),
        original_file_name: this.normalizeText(document.original_file_name),
        mime_type: this.normalizeText(document.mime_type),
        checksum: this.normalizeText(document.checksum),
        status: this.normalizeText(document.status)?.toUpperCase() ?? 'PENDING',
        issued_at: this.normalizeDate(document.issued_at),
        expires_at: this.normalizeDate(document.expires_at),
        created_by: userId,
        updated_by: userId,
      }),
    );

    await identifierRepository.save(identifiers);
    await addressRepository.save(addresses);
    await contactRepository.save(contacts);
    if (documents.length > 0) {
      await documentRepository.save(documents);
    }

    return {
      identifiers,
      addresses,
      contacts,
      documents,
    };
  }

  private markKycUpdateRequired(customer: Customer) {
    if (customer.kyc_status === CustomerKycStatus.VERIFIED) {
      customer.kyc_status = CustomerKycStatus.REQUIRES_UPDATE;
      customer.kyc_verified_by = null;
      customer.kyc_verified_at = null;
      customer.kyc_expires_at = null;
    }
  }

  private async attachCustomerRelations(customer: Customer) {
    const [
      identifiers,
      addresses,
      contacts,
      documents,
      kycReviews,
      insuredAssets,
    ] = await Promise.all([
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
      this.customerKycReviewRepository.find({
        where: { customer_id: customer.id },
        order: { kyc_version: 'DESC', created_at: 'DESC' },
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
      kyc_reviews: kycReviews,
      insured_assets: insuredAssets,
    };
  }

  async createForUser(user: AuthenticatedUser, dto: CreateCustomerDto) {
    this.dataAccessScopeService.resolve(user);
    const payload = this.normalizeCustomerPayload(dto);

    await this.assertExactIdentifierDuplicates(
      user.companyId!,
      payload.identifiers,
    );
    await this.assertPossibleContactDuplicates(
      user,
      user.companyId!,
      payload.contacts,
      payload.possibleDuplicateOverrideReason,
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
        kyc_status: CustomerKycStatus.PENDING,
        kyc_version: 0,
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
      kyc_status,
    } = query;

    const safeSortBy = [
      'customer_no',
      'first_name',
      'last_name',
      'company_name',
      'status',
      'created_at',
      'updated_at',
    ].includes(sortBy)
      ? sortBy
      : 'created_at';

    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.deleted_at IS NULL')
      .orderBy(`customer.${safeSortBy}`, direction);

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

    if (kyc_status) {
      queryBuilder.andWhere('customer.kyc_status = :kycStatus', {
        kycStatus: kyc_status,
      });
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

  async findOneForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, false);
    return this.attachCustomerRelations(customer);
  }

  async getKycForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, false);
    const currentReview = await this.customerKycReviewRepository.findOne({
      where: { customer_id: customer.id, kyc_version: customer.kyc_version },
      order: { created_at: 'DESC' },
    });

    return {
      customerId: customer.id,
      kycStatus: customer.kyc_status,
      kycVersion: customer.kyc_version,
      kycVerifiedBy: customer.kyc_verified_by,
      kycVerifiedAt: customer.kyc_verified_at,
      kycExpiresAt: customer.kyc_expires_at,
      kycRejectionReason: customer.kyc_rejection_reason,
      currentReview,
    };
  }

  async listKycHistoryForUser(user: AuthenticatedUser, id: string) {
    const customer = await this.findScopedCustomer(user, id, false);
    return this.customerKycReviewRepository.find({
      where: { customer_id: customer.id },
      order: { kyc_version: 'DESC', created_at: 'DESC' },
    });
  }

  async submitKycReviewForUser(
    user: AuthenticatedUser,
    id: string,
    dto: SubmitCustomerKycReviewDto,
  ) {
    await this.findScopedCustomer(user, id, true);

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOneOrFail({
        where: { id, company_id: user.companyId! },
      });

      if (
        ![
          CustomerKycStatus.PENDING,
          CustomerKycStatus.REJECTED,
          CustomerKycStatus.REQUIRES_UPDATE,
          CustomerKycStatus.EXPIRED,
        ].includes(customer.kyc_status)
      ) {
        throw new ConflictException(
          'The customer cannot be submitted for KYC review from the current status.',
        );
      }

      const relations = await this.getCustomerRelations(manager, customer.id);
      this.assertCustomerReadyForKycReview(relations);

      const snapshot = this.buildFinalizedCustomerSnapshot(customer, relations);
      const nextVersion = Number(customer.kyc_version ?? 0) + 1;

      const review = await manager.getRepository(CustomerKycReview).save(
        manager.getRepository(CustomerKycReview).create({
          company_id: user.companyId!,
          customer_id: customer.id,
          kyc_version: nextVersion,
          status: CustomerKycStatus.IN_REVIEW,
          customer_snapshot: snapshot,
          customer_snapshot_hash: snapshot.snapshotHash,
          submission_notes: this.normalizeText(dto.submission_notes) ?? null,
          submitted_by: user.id,
          submitted_at: new Date(),
        }),
      );

      customer.kyc_status = CustomerKycStatus.IN_REVIEW;
      customer.kyc_version = nextVersion;
      customer.kyc_rejection_reason = null;
      customer.updated_by = user.id;
      await manager.getRepository(Customer).save(customer);

      return review;
    });
  }

  async approveKycReviewForUser(
    user: AuthenticatedUser,
    id: string,
    dto: ApproveCustomerKycReviewDto,
  ) {
    await this.findScopedCustomer(user, id, true);

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOneOrFail({
        where: { id, company_id: user.companyId! },
      });

      if (customer.kyc_status !== CustomerKycStatus.IN_REVIEW) {
        throw new ConflictException(
          'Only a customer in KYC review can be approved.',
        );
      }

      const review = await this.findOpenKycReview(manager, customer);
      if (review.submitted_by === user.id) {
        throw new ConflictException(
          'The user who submitted the KYC review cannot approve it.',
        );
      }

      review.status = CustomerKycStatus.VERIFIED;
      review.reviewed_by = user.id;
      review.reviewed_at = new Date();
      review.expires_at = this.normalizeTimestamp(dto.expires_at);
      await manager.getRepository(CustomerKycReview).save(review);

      customer.kyc_status = CustomerKycStatus.VERIFIED;
      customer.kyc_verified_by = user.id;
      customer.kyc_verified_at = new Date();
      customer.kyc_expires_at = review.expires_at;
      customer.kyc_rejection_reason = null;
      customer.updated_by = user.id;
      await manager.getRepository(Customer).save(customer);

      return {
        ...review,
        approval_comments: this.normalizeText(dto.comments) ?? null,
      };
    });
  }

  async rejectKycReviewForUser(
    user: AuthenticatedUser,
    id: string,
    dto: RejectCustomerKycReviewDto,
  ) {
    await this.findScopedCustomer(user, id, true);

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOneOrFail({
        where: { id, company_id: user.companyId! },
      });

      if (customer.kyc_status !== CustomerKycStatus.IN_REVIEW) {
        throw new ConflictException(
          'Only a customer in KYC review can be rejected.',
        );
      }

      const review = await this.findOpenKycReview(manager, customer);
      if (review.submitted_by === user.id) {
        throw new ConflictException(
          'The user who submitted the KYC review cannot reject it.',
        );
      }

      const rejectionReason = this.normalizeText(dto.rejection_reason);
      if (!rejectionReason) {
        throw new BadRequestException('rejection_reason is required');
      }

      review.status = CustomerKycStatus.REJECTED;
      review.rejection_reason = rejectionReason;
      review.reviewed_by = user.id;
      review.reviewed_at = new Date();
      await manager.getRepository(CustomerKycReview).save(review);

      customer.kyc_status = CustomerKycStatus.REJECTED;
      customer.kyc_verified_by = null;
      customer.kyc_verified_at = null;
      customer.kyc_expires_at = null;
      customer.kyc_rejection_reason = rejectionReason;
      customer.updated_by = user.id;
      await manager.getRepository(Customer).save(customer);

      return {
        ...review,
        rejection_comments: this.normalizeText(dto.comments) ?? null,
      };
    });
  }

  async requestKycUpdateForUser(
    user: AuthenticatedUser,
    id: string,
    dto: RequestCustomerKycUpdateDto,
  ) {
    const customer = await this.findScopedCustomer(user, id, true);

    if (
      ![CustomerKycStatus.VERIFIED, CustomerKycStatus.IN_REVIEW].includes(
        customer.kyc_status,
      )
    ) {
      throw new ConflictException(
        'Only a verified or in-review customer can be marked for KYC update.',
      );
    }

    customer.kyc_status = CustomerKycStatus.REQUIRES_UPDATE;
    customer.kyc_verified_by = null;
    customer.kyc_verified_at = null;
    customer.kyc_expires_at = null;
    customer.kyc_rejection_reason = this.normalizeText(dto.reason) ?? null;
    customer.updated_by = user.id;

    await this.customerRepository.save(customer);
    return this.getKycForUser(user, id);
  }

  async expireKycForUser(
    user: AuthenticatedUser,
    id: string,
    dto: RequestCustomerKycUpdateDto,
  ) {
    await this.findScopedCustomer(user, id, true);

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOneOrFail({
        where: { id, company_id: user.companyId! },
      });

      if (
        ![CustomerKycStatus.VERIFIED, CustomerKycStatus.IN_REVIEW].includes(
          customer.kyc_status,
        )
      ) {
        throw new ConflictException(
          'Only a verified or in-review customer can be expired.',
        );
      }

      const latestReview = await manager
        .getRepository(CustomerKycReview)
        .findOne({
          where: {
            customer_id: customer.id,
            kyc_version: customer.kyc_version,
          },
          order: { created_at: 'DESC' },
        });

      if (latestReview) {
        latestReview.status = CustomerKycStatus.EXPIRED;
        latestReview.rejection_reason =
          this.normalizeText(dto.reason) ?? latestReview.rejection_reason;
        latestReview.reviewed_by = user.id;
        latestReview.reviewed_at = new Date();
        await manager.getRepository(CustomerKycReview).save(latestReview);
      }

      customer.kyc_status = CustomerKycStatus.EXPIRED;
      customer.kyc_verified_by = null;
      customer.kyc_verified_at = null;
      customer.kyc_expires_at = null;
      customer.kyc_rejection_reason = this.normalizeText(dto.reason) ?? null;
      customer.updated_by = user.id;
      await manager.getRepository(Customer).save(customer);

      return {
        customerId: customer.id,
        kycStatus: customer.kyc_status,
        kycVersion: customer.kyc_version,
      };
    });
  }

  async updateForUser(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCustomerDto,
  ) {
    const current = await this.findScopedCustomer(user, id, true);
    const mergedDto = {
      ...dto,
      customer_type: dto.customer_type ?? current.customer_type,
      first_name: dto.first_name ?? current.first_name ?? undefined,
      middle_name: dto.middle_name ?? current.middle_name ?? undefined,
      last_name: dto.last_name ?? current.last_name ?? undefined,
      gender: dto.gender ?? current.gender ?? undefined,
      date_of_birth: dto.date_of_birth ?? current.date_of_birth ?? undefined,
      nationality: dto.nationality ?? current.nationality ?? undefined,
      company_name: dto.company_name ?? current.company_name ?? undefined,
      registration_no:
        dto.registration_no ?? current.registration_no ?? undefined,
      incorporation_certificate_no:
        dto.incorporation_certificate_no ??
        current.incorporation_certificate_no ??
        undefined,
      tin: dto.tin ?? current.tin ?? undefined,
      vrn: dto.vrn ?? current.vrn ?? undefined,
      id_type: dto.id_type ?? current.id_type ?? undefined,
      id_number: dto.id_number ?? current.id_number ?? undefined,
      nida_no: dto.nida_no ?? current.nida_no ?? undefined,
      voter_no: dto.voter_no ?? current.voter_no ?? undefined,
      passport_no: dto.passport_no ?? current.passport_no ?? undefined,
      driving_license_no:
        dto.driving_license_no ?? current.driving_license_no ?? undefined,
      zanid_no: dto.zanid_no ?? current.zanid_no ?? undefined,
      phone: dto.phone ?? current.phone,
      alternate_phone:
        dto.alternate_phone ?? current.alternate_phone ?? undefined,
      fax: dto.fax ?? current.fax ?? undefined,
      email: dto.email ?? current.email ?? undefined,
      country: dto.country ?? current.country ?? undefined,
      country_code: dto.country_code ?? current.country_code,
      region: dto.region ?? current.region,
      district: dto.district ?? current.district,
      ward: dto.ward ?? current.ward ?? undefined,
      street: dto.street ?? current.street ?? undefined,
      postal_address: dto.postal_address ?? current.postal_address ?? undefined,
      latitude:
        dto.latitude !== undefined
          ? dto.latitude
          : current.latitude != null
            ? Number(current.latitude)
            : undefined,
      longitude:
        dto.longitude !== undefined
          ? dto.longitude
          : current.longitude != null
            ? Number(current.longitude)
            : undefined,
      contact_name: dto.contact_name ?? current.contact_name ?? undefined,
      contact_role: dto.contact_role ?? current.contact_role ?? undefined,
      contact_phone: dto.contact_phone ?? current.contact_phone ?? undefined,
      contact_email: dto.contact_email ?? current.contact_email ?? undefined,
      document_type: dto.document_type ?? current.document_type ?? undefined,
      document_no: dto.document_no ?? current.document_no ?? undefined,
      document_file_name:
        dto.document_file_name ?? current.document_file_name ?? undefined,
      document_file_url:
        dto.document_file_url ?? current.document_file_url ?? undefined,
      document_mime_type:
        dto.document_mime_type ?? current.document_mime_type ?? undefined,
      document_verified:
        dto.document_verified ?? current.document_verified ?? undefined,
      status: dto.status ?? current.status,
      metadata: dto.metadata ?? current.metadata ?? undefined,
      identifiers: dto.identifiers,
      addresses: dto.addresses,
      contacts: dto.contacts,
      documents: dto.documents,
      duplicate_override_reason: dto.duplicate_override_reason,
      policy_holder_type: current.policy_holder_type ?? undefined,
      kyc_status: current.kyc_status,
      document_verified_by: current.document_verified_by ?? undefined,
      document_verified_at:
        current.document_verified_at?.toISOString() ?? undefined,
    } as CreateCustomerDto;

    const payload = this.normalizeCustomerPayload(mergedDto);

    await this.assertExactIdentifierDuplicates(
      user.companyId!,
      payload.identifiers,
      id,
    );
    await this.assertPossibleContactDuplicates(
      user,
      user.companyId!,
      payload.contacts,
      payload.possibleDuplicateOverrideReason,
      id,
    );

    const updatedCustomer = await this.dataSource.transaction(
      async (manager) => {
        const repository = manager.getRepository(Customer);
        const customer = await repository.findOneOrFail({
          where: { id, company_id: user.companyId! },
        });

        Object.assign(
          customer,
          this.projectCompatibilityFields(customer, payload),
        );
        customer.updated_by = user.id;
        this.markKycUpdateRequired(customer);

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

        return repository.save(savedCustomer);
      },
    );

    return this.attachCustomerRelations(updatedCustomer);
  }

  async removeForUser(user: AuthenticatedUser, id: string): Promise<void> {
    const customer = await this.findScopedCustomer(user, id, true);
    const activeAssetCount = await this.insuredAssetRepository.count({
      where: [
        { customer_id: customer.id, deleted_at: IsNull() },
        { owner_customer_id: customer.id, deleted_at: IsNull() },
      ],
    });

    if (activeAssetCount > 0) {
      throw new ConflictException(
        'Customers with insured assets cannot be archived.',
      );
    }

    await this.customerRepository.softDelete(customer.id);
  }

  async restoreForUser(user: AuthenticatedUser, id: string) {
    await this.findScopedCustomer(user, id, true, true);
    await this.customerRepository.restore(id);
    return this.findOneForUser(user, id);
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
    return {
      PolicyHolderName: customer.display_name,
      PolicyHolderBirthDate: customer.date_of_birth,
      PolicyHolderType: customer.policy_holder_type,
      PolicyHolderIdNumber: customer.id_number,
      PolicyHolderIdType: customer.id_type,
      Gender: customer.gender,
      CountryCode: customer.country_code,
      Region: customer.region,
      District: customer.district,
      Street: customer.street,
      PolicyHolderPhoneNumber: customer.phone,
      PolicyHolderFax: customer.fax,
      PostalAddress: customer.postal_address,
      EmailAddress: customer.email,
    };
  }
}
