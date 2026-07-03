import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomerDto } from './dto/filter-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import { CustomerGender } from './enums/customer-gender.enum';
import { CustomerKycStatus } from './enums/customer-kyc-status.enum';
import { CustomerPolicyHolderType } from './enums/customer-policy-holder-type.enum';
import { CustomerStatus } from './enums/customer-status.enum';
import { CustomerType } from './enums/customer-type.enum';

type IdentifierMap = Record<string, string | null | undefined>;

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    return (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized.length ? normalized : null;
  }

  private normalizePhone(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    if (!normalized) return null;
    return normalized.replace(/\s+/g, '').replace(/-/g, '');
  }

  private normalizeEmail(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    return normalized ? normalized.toLowerCase() : null;
  }

  private normalizeCountryCode(value?: string | null): string {
    const normalized = this.normalizeText(value);
    if (!normalized || normalized.length !== 3) {
      throw new BadRequestException('country_code must be a 3-letter ISO code');
    }
    return normalized.toUpperCase();
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return date.toISOString().slice(0, 10);
  }

  private mapPolicyHolderType(
    customerType: CustomerType,
  ): CustomerPolicyHolderType {
    return customerType === CustomerType.INDIVIDUAL
      ? CustomerPolicyHolderType.INDIVIDUAL
      : CustomerPolicyHolderType.CORPORATE;
  }

  private resolveIdNumber(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): string | null {
    const fieldName = this.getIdTypeFieldName(dto.customer_type, dto.id_type);
    if (fieldName) {
      const selected = this.normalizeText(
        (dto as any)[fieldName] as string | undefined,
      );
      if (selected) {
        return selected;
      }
    }

    const normalizedIdNumber = this.normalizeText(dto.id_number);
    if (normalizedIdNumber) {
      return normalizedIdNumber;
    }

    const candidates = [
      dto.nida_no,
      dto.voter_no,
      dto.passport_no,
      dto.driving_license_no,
      dto.zanid_no,
      dto.tin,
      dto.incorporation_certificate_no,
      dto.registration_no,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeText(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  private getIdentityFields(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): IdentifierMap {
    return {
      id_number: this.normalizeText(dto.id_number),
      phone: this.normalizePhone(dto.phone),
      alternate_phone: this.normalizePhone(dto.alternate_phone),
      email: this.normalizeEmail(dto.email),
      nida_no: this.normalizeText(dto.nida_no),
      voter_no: this.normalizeText(dto.voter_no),
      passport_no: this.normalizeText(dto.passport_no),
      driving_license_no: this.normalizeText(dto.driving_license_no),
      zanid_no: this.normalizeText(dto.zanid_no),
      tin: this.normalizeText(dto.tin),
      registration_no: this.normalizeText(dto.registration_no),
      incorporation_certificate_no: this.normalizeText(
        dto.incorporation_certificate_no,
      ),
    };
  }

  private getIdTypeFieldName(
    customerType: CustomerType | undefined,
    idType: number | undefined,
  ): string | null {
    if (customerType === CustomerType.INDIVIDUAL) {
      switch (idType) {
        case 1:
          return 'nida_no';
        case 2:
          return 'voter_no';
        case 3:
          return 'passport_no';
        case 4:
          return 'driving_license_no';
        case 5:
          return 'zanid_no';
        default:
          return null;
      }
    }

    if (customerType === CustomerType.CORPORATE) {
      switch (idType) {
        case 6:
          return 'tin';
        case 7:
          return 'incorporation_certificate_no';
        default:
          return null;
      }
    }

    return null;
  }

  private syncIdentityField(
    customerType: CustomerType,
    idType: number | undefined,
    idNumber: string | null,
    dto: any,
  ): Partial<Customer> {
    const fieldName = this.getIdTypeFieldName(customerType, idType);
    if (!fieldName || !idNumber) {
      return {};
    }

    const source = this.normalizeText(dto[fieldName] as string | undefined);
    return { [fieldName]: source ?? idNumber };
  }

  private applyDtoToCustomer(
    customer: Customer,
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): void {
    if (dto.customer_type !== undefined)
      customer.customer_type = dto.customer_type;

    customer.first_name =
      dto.first_name !== undefined
        ? this.normalizeText(dto.first_name)
        : customer.first_name;
    customer.middle_name =
      dto.middle_name !== undefined
        ? this.normalizeText(dto.middle_name)
        : customer.middle_name;
    customer.last_name =
      dto.last_name !== undefined
        ? this.normalizeText(dto.last_name)
        : customer.last_name;
    customer.gender = dto.gender !== undefined ? dto.gender : customer.gender;
    customer.date_of_birth =
      dto.date_of_birth !== undefined
        ? this.normalizeDate(dto.date_of_birth)
        : customer.date_of_birth;
    customer.nationality =
      dto.nationality !== undefined
        ? this.normalizeText(dto.nationality)
        : customer.nationality;
    customer.company_name =
      dto.company_name !== undefined
        ? this.normalizeText(dto.company_name)
        : customer.company_name;
    customer.registration_no =
      dto.registration_no !== undefined
        ? this.normalizeText(dto.registration_no)
        : customer.registration_no;
    customer.incorporation_certificate_no =
      dto.incorporation_certificate_no !== undefined
        ? this.normalizeText(dto.incorporation_certificate_no)
        : customer.incorporation_certificate_no;
    customer.tin =
      dto.tin !== undefined ? this.normalizeText(dto.tin) : customer.tin;
    customer.vrn =
      dto.vrn !== undefined ? this.normalizeText(dto.vrn) : customer.vrn;
    customer.policy_holder_type =
      dto.customer_type !== undefined
        ? this.mapPolicyHolderType(dto.customer_type)
        : customer.policy_holder_type;
    customer.id_type =
      dto.id_type !== undefined ? dto.id_type : customer.id_type;
    customer.id_number =
      dto.id_number !== undefined
        ? this.normalizeText(dto.id_number)
        : customer.id_number;
    customer.nida_no =
      dto.nida_no !== undefined
        ? this.normalizeText(dto.nida_no)
        : customer.nida_no;
    customer.voter_no =
      dto.voter_no !== undefined
        ? this.normalizeText(dto.voter_no)
        : customer.voter_no;
    customer.passport_no =
      dto.passport_no !== undefined
        ? this.normalizeText(dto.passport_no)
        : customer.passport_no;
    customer.driving_license_no =
      dto.driving_license_no !== undefined
        ? this.normalizeText(dto.driving_license_no)
        : customer.driving_license_no;
    customer.zanid_no =
      dto.zanid_no !== undefined
        ? this.normalizeText(dto.zanid_no)
        : customer.zanid_no;
    customer.phone =
      dto.phone !== undefined
        ? this.normalizePhone(dto.phone)!
        : customer.phone;
    customer.alternate_phone =
      dto.alternate_phone !== undefined
        ? this.normalizePhone(dto.alternate_phone)
        : customer.alternate_phone;
    customer.fax =
      dto.fax !== undefined ? this.normalizePhone(dto.fax) : customer.fax;
    customer.email =
      dto.email !== undefined ? this.normalizeEmail(dto.email) : customer.email;
    customer.country =
      dto.country !== undefined
        ? this.normalizeText(dto.country)
        : customer.country;
    customer.country_code =
      dto.country_code !== undefined
        ? this.normalizeCountryCode(dto.country_code)
        : customer.country_code;
    customer.region =
      dto.region !== undefined
        ? (this.normalizeText(dto.region) ?? customer.region)
        : customer.region;
    customer.district =
      dto.district !== undefined
        ? (this.normalizeText(dto.district) ?? customer.district)
        : customer.district;
    customer.ward =
      dto.ward !== undefined ? this.normalizeText(dto.ward) : customer.ward;
    customer.street =
      dto.street !== undefined
        ? this.normalizeText(dto.street)
        : customer.street;
    customer.postal_address =
      dto.postal_address !== undefined
        ? this.normalizeText(dto.postal_address)
        : customer.postal_address;
    customer.latitude =
      dto.latitude !== undefined && dto.latitude !== null
        ? String(dto.latitude)
        : customer.latitude;
    customer.longitude =
      dto.longitude !== undefined && dto.longitude !== null
        ? String(dto.longitude)
        : customer.longitude;
    customer.contact_name =
      dto.contact_name !== undefined
        ? this.normalizeText(dto.contact_name)
        : customer.contact_name;
    customer.contact_role =
      dto.contact_role !== undefined
        ? this.normalizeText(dto.contact_role)
        : customer.contact_role;
    customer.contact_phone =
      dto.contact_phone !== undefined
        ? this.normalizePhone(dto.contact_phone)
        : customer.contact_phone;
    customer.contact_email =
      dto.contact_email !== undefined
        ? this.normalizeEmail(dto.contact_email)
        : customer.contact_email;
    customer.kyc_status =
      dto.kyc_status !== undefined ? dto.kyc_status : customer.kyc_status;
    customer.document_type =
      dto.document_type !== undefined
        ? dto.document_type
        : customer.document_type;
    customer.document_no =
      dto.document_no !== undefined
        ? this.normalizeText(dto.document_no)
        : customer.document_no;
    customer.document_file_name =
      dto.document_file_name !== undefined
        ? this.normalizeText(dto.document_file_name)
        : customer.document_file_name;
    customer.document_file_url =
      dto.document_file_url !== undefined
        ? this.normalizeText(dto.document_file_url)
        : customer.document_file_url;
    customer.document_mime_type =
      dto.document_mime_type !== undefined
        ? this.normalizeText(dto.document_mime_type)
        : customer.document_mime_type;
    customer.document_verified =
      dto.document_verified !== undefined
        ? dto.document_verified
        : customer.document_verified;
    customer.document_verified_by =
      dto.document_verified_by !== undefined
        ? dto.document_verified_by
        : customer.document_verified_by;
    customer.document_verified_at =
      dto.document_verified_at !== undefined
        ? this.normalizeDate(dto.document_verified_at)
          ? new Date(this.normalizeDate(dto.document_verified_at) as string)
          : null
        : customer.document_verified_at;
    customer.status = dto.status !== undefined ? dto.status : customer.status;
    customer.metadata =
      dto.metadata !== undefined ? (dto.metadata ?? null) : customer.metadata;
  }

  private assertCustomerRules(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): void {
    if (dto.customer_type === CustomerType.INDIVIDUAL) {
      const missing: string[] = [];
      if (!this.normalizeText(dto.first_name)) missing.push('first_name');
      if (!this.normalizeText(dto.last_name)) missing.push('last_name');
      if (!dto.gender) missing.push('gender');
      if (!dto.date_of_birth) missing.push('date_of_birth');
      if (!dto.id_type && dto.id_type !== 0) missing.push('id_type');
      if (!this.normalizeText(dto.id_number)) missing.push('id_number');
      if (!this.normalizePhone(dto.phone)) missing.push('phone');
      if (!this.normalizeText(dto.country_code)) missing.push('country_code');
      if (!this.normalizeText(dto.region)) missing.push('region');
      if (!this.normalizeText(dto.district)) missing.push('district');
      if (missing.length) {
        throw new BadRequestException(
          `Missing required fields for individual customer: ${missing.join(', ')}`,
        );
      }
    }

    if (dto.customer_type === CustomerType.CORPORATE) {
      const missing: string[] = [];
      if (!this.normalizeText(dto.company_name)) missing.push('company_name');
      if (!dto.id_type && dto.id_type !== 0) missing.push('id_type');
      if (!this.normalizeText(dto.id_number)) missing.push('id_number');
      if (!this.normalizePhone(dto.phone)) missing.push('phone');
      if (!this.normalizeText(dto.country_code)) missing.push('country_code');
      if (!this.normalizeText(dto.region)) missing.push('region');
      if (!this.normalizeText(dto.district)) missing.push('district');
      if (missing.length) {
        throw new BadRequestException(
          `Missing required fields for corporate customer: ${missing.join(', ')}`,
        );
      }
    }
  }

  private assertIdTypeConsistency(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): void {
    const normalizedIdNumber = this.resolveIdNumber(dto);
    if (!normalizedIdNumber) {
      throw new BadRequestException(
        'id_number or a specific identification number must be provided',
      );
    }
    const fieldName = this.getIdTypeFieldName(dto.customer_type, dto.id_type);
    if (!fieldName) {
      throw new BadRequestException(
        'id_type is not valid for the selected customer type',
      );
    }

    const sourceValue = this.normalizeText(
      (dto as Record<string, string | undefined>)[fieldName],
    );

    if (dto.customer_type === CustomerType.CORPORATE && !sourceValue) {
      throw new BadRequestException(
        `${fieldName} is required for the selected id_type`,
      );
    }

    if (
      dto.customer_type === CustomerType.INDIVIDUAL &&
      !sourceValue &&
      !normalizedIdNumber
    ) {
      throw new BadRequestException(
        `${fieldName} is required for the selected id_type`,
      );
    }
  }

  private async assertUniqueIdentifiers(
    companyId: string,
    identifiers: IdentifierMap,
    excludeCustomerId?: string,
  ): Promise<void> {
    const uniqueFields = [
      'customer_no',
      'phone',
      'email',
      'id_number',
      'nida_no',
      'voter_no',
      'passport_no',
      'driving_license_no',
      'zanid_no',
      'tin',
      'registration_no',
      'incorporation_certificate_no',
    ] as const;

    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.deleted_at IS NULL');

    if (excludeCustomerId) {
      qb.andWhere('customer.id != :excludeCustomerId', { excludeCustomerId });
    }

    qb.andWhere(
      new Brackets((subQb) => {
        let first = true;
        for (const field of uniqueFields) {
          const value = identifiers[field];
          if (!value) continue;
          const param = `${field}_value`;
          if (first) {
            subQb.where(`customer.${field} = :${param}`, { [param]: value });
            first = false;
          } else {
            subQb.orWhere(`customer.${field} = :${param}`, { [param]: value });
          }
        }
      }),
    );

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException(
        'A customer with the same identifier already exists in this company',
      );
    }
  }

  private buildCustomerNoSeed(): string {
    const year = new Date().getFullYear();
    return `CUST-${year}-`;
  }

  async create(
    companyId: string,
    dto: CreateCustomerDto,
    userId: string,
  ): Promise<Customer> {
    this.assertCustomerRules(dto);
    this.assertIdTypeConsistency(dto);

    const customerNo = await this.generateCustomerNo(companyId);
    const identifiers = this.getIdentityFields(dto);
    await this.assertUniqueIdentifiers(companyId, {
      ...identifiers,
      customer_no: customerNo,
    });
    const normalizedIdNumber = this.resolveIdNumber(dto);
    const identityFieldPatch = this.syncIdentityField(
      dto.customer_type,
      dto.id_type,
      normalizedIdNumber,
      dto,
    );

    const customer = this.customerRepository.create({
      company_id: companyId,
      customer_no: customerNo,
      customer_type: dto.customer_type,
      first_name: this.normalizeText(dto.first_name),
      middle_name: this.normalizeText(dto.middle_name),
      last_name: this.normalizeText(dto.last_name),
      gender: dto.gender ?? null,
      date_of_birth: this.normalizeDate(dto.date_of_birth),
      nationality: this.normalizeText(dto.nationality),
      company_name: this.normalizeText(dto.company_name),
      registration_no: this.normalizeText(dto.registration_no),
      incorporation_certificate_no: this.normalizeText(
        dto.incorporation_certificate_no,
      ),
      tin: this.normalizeText(dto.tin),
      vrn: this.normalizeText(dto.vrn),
      policy_holder_type: this.mapPolicyHolderType(dto.customer_type),
      id_type: dto.id_type,
      id_number: normalizedIdNumber,
      voter_no: this.normalizeText(dto.voter_no),
      passport_no: this.normalizeText(dto.passport_no),
      driving_license_no: this.normalizeText(dto.driving_license_no),
      zanid_no: this.normalizeText(dto.zanid_no),
      phone: this.normalizePhone(dto.phone)!,
      alternate_phone: this.normalizePhone(dto.alternate_phone),
      fax: this.normalizePhone(dto.fax),
      email: this.normalizeEmail(dto.email),
      country: this.normalizeText(dto.country),
      country_code: this.normalizeCountryCode(dto.country_code),
      region: this.normalizeText(dto.region) ?? dto.region,
      district: this.normalizeText(dto.district) ?? dto.district,
      ward: this.normalizeText(dto.ward),
      street: this.normalizeText(dto.street),
      postal_address: this.normalizeText(dto.postal_address),
      latitude:
        dto.latitude !== undefined && dto.latitude !== null
          ? String(dto.latitude)
          : null,
      longitude:
        dto.longitude !== undefined && dto.longitude !== null
          ? String(dto.longitude)
          : null,
      contact_name: this.normalizeText(dto.contact_name),
      contact_role: this.normalizeText(dto.contact_role),
      contact_phone: this.normalizePhone(dto.contact_phone),
      contact_email: this.normalizeEmail(dto.contact_email),
      kyc_status: dto.kyc_status ?? CustomerKycStatus.PENDING,
      document_type: dto.document_type ?? null,
      document_no: this.normalizeText(dto.document_no),
      document_file_name: this.normalizeText(dto.document_file_name),
      document_file_url: this.normalizeText(dto.document_file_url),
      document_mime_type: this.normalizeText(dto.document_mime_type),
      document_verified: dto.document_verified ?? false,
      document_verified_by: dto.document_verified_by ?? null,
      document_verified_at: dto.document_verified_at
        ? new Date(dto.document_verified_at)
        : null,
      status: dto.status ?? CustomerStatus.ACTIVE,
      metadata: dto.metadata ?? null,
      created_by: userId,
      updated_by: userId,
      ...identityFieldPatch,
    });

    try {
      return await this.customerRepository.save(customer);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A customer with this identifier already exists in this company',
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterCustomerDto) {
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

    const allowedSortFields = [
      'customer_no',
      'first_name',
      'last_name',
      'company_name',
      'status',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .orderBy(`customer.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(customer.customer_no ILIKE :term OR customer.first_name ILIKE :term OR customer.last_name ILIKE :term OR customer.company_name ILIKE :term OR customer.phone ILIKE :term OR customer.email ILIKE :term OR customer.id_number ILIKE :term)',
        { term },
      );
    }

    if (customer_type)
      qb.andWhere('customer.customer_type = :customer_type', { customer_type });
    if (status) qb.andWhere('customer.status = :status', { status });
    if (kyc_status)
      qb.andWhere('customer.kyc_status = :kyc_status', { kyc_status });

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

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

  async findOne(companyId: string, id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateCustomerDto,
    userId: string,
  ): Promise<Customer> {
    const customer = await this.findOne(companyId, id);
    const updatedPreview = { ...customer };
    this.applyDtoToCustomer(updatedPreview, dto);
    const merged = { ...updatedPreview, ...dto } as CreateCustomerDto;
    this.assertCustomerRules(merged);
    this.assertIdTypeConsistency(merged);

    const identifiers = this.getIdentityFields(merged);
    if (dto.id_number === undefined) {
      identifiers.id_number = updatedPreview.id_number;
    }
    await this.assertUniqueIdentifiers(companyId, identifiers, id);

    this.applyDtoToCustomer(customer, dto);
    Object.assign(
      customer,
      this.syncIdentityField(
        customer.customer_type,
        customer.id_type ?? undefined,
        customer.id_number,
        customer,
      ),
    );
    customer.updated_by = userId;

    try {
      return await this.customerRepository.save(customer);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A customer with this identifier already exists in this company',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const customer = await this.findOne(companyId, id);
    await this.customerRepository.softDelete(customer.id);
  }

  async restore(companyId: string, id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id, company_id: companyId },
      withDeleted: true,
    });
    if (!customer) throw new NotFoundException('Customer not found');
    await this.customerRepository.restore(customer.id);
    return this.findOne(companyId, id);
  }

  async generatePolicyHolderPayload(companyId: string, id: string) {
    const customer = await this.findOne(companyId, id);
    return this.toPolicyHolderPayload(customer);
  }

  toPolicyHolderPayload(customer: Customer) {
    const policyHolderName =
      customer.customer_type === CustomerType.INDIVIDUAL
        ? [customer.first_name, customer.middle_name, customer.last_name]
            .filter(Boolean)
            .join(' ')
        : (customer.company_name ?? '');

    return {
      PolicyHolderName: policyHolderName,
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

  private async generateCustomerNo(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CUST-${year}-`;

    const lastCustomer = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.customer_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('customer.customer_no', 'DESC')
      .limit(1)
      .getOne();

    const next = lastCustomer?.customer_no
      ? Number(lastCustomer.customer_no.substring(prefix.length)) + 1
      : 1;

    return `${prefix}${String(next).padStart(5, '0')}`;
  }
}
