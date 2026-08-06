import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssetOwnershipType } from '@insurance-max/contracts';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InsuredAsset } from '../customers/entities/insured-asset.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { User } from '../users/entities/user.entity';
import { CreateNonMotorPolicyDetailDto } from './dto/create-non-motor-policy-detail.dto';
import { CreateSubjectMatterFactorValueDto } from './dto/create-subject-matter-factor-value.dto';
import { CreateSubjectMatterDto } from './dto/create-subject-matter.dto';
import { FilterNonMotorDto } from './dto/filter-non-motor.dto';
import { UpdateNonMotorPolicyDetailDto } from './dto/update-non-motor-policy-detail.dto';
import { UpdateSubjectMatterDto } from './dto/update-subject-matter.dto';
import { NonMotorPolicyDetail } from './entities/non-motor-policy-detail.entity';
import { SubjectMatterFactorValue } from './entities/subject-matter-factor-value.entity';
import { SubjectMatter } from './entities/subject-matter.entity';

type NumericLike = number | string | null | undefined;

@Injectable()
export class NonMotorService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SubjectMatter)
    private readonly subjectMatterRepository: Repository<SubjectMatter>,
    @InjectRepository(SubjectMatterFactorValue)
    private readonly factorValueRepository: Repository<SubjectMatterFactorValue>,
    @InjectRepository(NonMotorPolicyDetail)
    private readonly policyDetailRepository: Repository<NonMotorPolicyDetail>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(InsuredAsset)
    private readonly insuredAssetRepository: Repository<InsuredAsset>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyRisk)
    private readonly policyRiskRepository: Repository<PolicyRisk>,
    @InjectRepository(RatingFactor)
    private readonly ratingFactorRepository: Repository<RatingFactor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly identifierGeneratorService: IdentifierGeneratorService,
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

  private normalizeMoney(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num))
      throw new BadRequestException('Invalid numeric value');
    return String(Math.round(num * 100) / 100);
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date value');
    return date.toISOString().slice(0, 10);
  }

  private normalizeUpperText(value?: string | null): string | null {
    const normalized = this.normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
  }

  private normalizeCoordinate(value: NumericLike): string | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num))
      throw new BadRequestException('Invalid numeric value');
    return String(num);
  }

  private validateSingleTypedFactorValue(
    dto: CreateSubjectMatterFactorValueDto,
  ): void {
    const provided = [
      dto.value_text !== undefined && dto.value_text !== null,
      dto.value_number !== undefined && dto.value_number !== null,
      dto.value_date !== undefined && dto.value_date !== null,
      dto.value_boolean !== undefined && dto.value_boolean !== null,
      dto.value_json !== undefined && dto.value_json !== null,
    ].filter(Boolean).length;

    if (provided !== 1) {
      throw new BadRequestException(
        'Exactly one typed subject matter factor value must be provided.',
      );
    }
  }

  private assertFactorValueMatchesType(
    factor: RatingFactor,
    dto: CreateSubjectMatterFactorValueDto,
  ): void {
    switch (factor.data_type) {
      case FactorDataType.NUMBER:
      case FactorDataType.DECIMAL:
      case FactorDataType.INTEGER:
        if (dto.value_number === undefined || dto.value_number === null) {
          throw new BadRequestException(
            `Factor ${factor.code} requires value_number`,
          );
        }
        if (
          factor.data_type === FactorDataType.INTEGER &&
          !Number.isInteger(Number(dto.value_number))
        ) {
          throw new BadRequestException(
            `Factor ${factor.code} requires an integer value`,
          );
        }
        break;
      case FactorDataType.BOOLEAN:
        if (dto.value_boolean === undefined || dto.value_boolean === null) {
          throw new BadRequestException(
            `Factor ${factor.code} requires value_boolean`,
          );
        }
        break;
      case FactorDataType.DATE:
        if (!dto.value_date) {
          throw new BadRequestException(
            `Factor ${factor.code} requires value_date`,
          );
        }
        break;
      case FactorDataType.SELECT:
      case FactorDataType.MULTI_SELECT:
      case FactorDataType.TEXT:
        if (!this.normalizeText(dto.value_text)) {
          throw new BadRequestException(
            `Factor ${factor.code} requires value_text`,
          );
        }
        break;
      default:
        break;
    }
  }

  private async ensureCompany(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) throw new BadRequestException('Company not found');
    return company;
  }

  private async ensureCustomer(
    companyId: string,
    customerId: string,
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, company_id: companyId },
    });
    if (!customer)
      throw new BadRequestException('Customer not found for this company');
    return customer;
  }

  private async ensureSubjectMatter(
    companyId: string,
    subjectMatterId: string,
  ): Promise<SubjectMatter> {
    const subjectMatter = await this.subjectMatterRepository.findOne({
      where: { id: subjectMatterId, company_id: companyId },
    });
    if (!subjectMatter)
      throw new BadRequestException(
        'Subject matter not found for this company',
      );
    return subjectMatter;
  }

  private async ensurePolicy(
    companyId: string,
    policyId: string,
  ): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, company_id: companyId },
    });
    if (!policy)
      throw new BadRequestException('Policy not found for this company');
    return policy;
  }

  private async ensurePolicyRisk(
    companyId: string,
    policyRiskId: string,
  ): Promise<PolicyRisk> {
    const risk = await this.policyRiskRepository.findOne({
      where: { id: policyRiskId },
      relations: { policy: true },
    });
    if (!risk || risk.policy.company_id !== companyId) {
      throw new BadRequestException('Policy risk not found for this company');
    }
    return risk;
  }

  private async ensureRatingFactor(
    companyId: string,
    factorId: string,
  ): Promise<RatingFactor> {
    const factor = await this.ratingFactorRepository.findOne({
      where: { id: factorId, company_id: companyId },
    });
    if (!factor)
      throw new BadRequestException('Rating factor not found for this company');
    return factor;
  }

  private async listWithPagination<T>(
    qb: any,
    query: FilterNonMotorDto,
    allowedSortFields: string[],
    defaultSortBy: string,
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = defaultSortBy,
      sortOrder = SortDirection.DESC,
    } = query;
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : defaultSortBy;
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    qb.orderBy(`${qb.alias}.${safeSortBy}`, direction);

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

  async createSubjectMatter(
    companyId: string,
    dto: CreateSubjectMatterDto,
    userId: string,
  ) {
    await this.ensureCompany(companyId);
    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const customer = await this.ensureCustomer(companyId, dto.customer_id);
        const ownerCustomer = await this.ensureCustomer(
          companyId,
          dto.owner_customer_id ?? dto.customer_id,
        );
        const subjectCode = this.normalizeUpperText(dto.subject_code);
        if (!subjectCode) {
          throw new BadRequestException('subject_code is required');
        }

        const assetNumber =
          await this.identifierGeneratorService.generateRequestId(
            companyId,
            manager,
          );
        const declaredValue = this.normalizeMoney(dto.value);
        const currency = dto.currency?.trim().toUpperCase() ?? 'TZS';

        const asset = await manager.getRepository(InsuredAsset).save(
          manager.getRepository(InsuredAsset).create({
            company_id: companyId,
            asset_number: assetNumber,
            asset_type: 'NON_MOTOR_SUBJECT',
            customer_id: customer.id,
            owner_customer_id: ownerCustomer.id,
            display_name:
              this.normalizeText(dto.description) ?? subjectCode ?? assetNumber,
            ownership_type: dto.ownership_type ?? AssetOwnershipType.OWNED,
            declared_value: declaredValue,
            currency_code: currency,
            status: 'ACTIVE',
            data_source: 'MANUAL',
            verification_status: 'NOT_VERIFIED',
            snapshot_version: 1,
            created_by: userId,
            updated_by: userId,
          }),
        );

        return manager.getRepository(SubjectMatter).save(
          manager.getRepository(SubjectMatter).create({
            company_id: companyId,
            customer_id: customer.id,
            owner_customer_id: ownerCustomer.id,
            insured_asset_id: asset.id,
            subject_type: this.normalizeText(dto.subject_type),
            subject_category: this.normalizeText(dto.subject_category),
            subject_code: subjectCode,
            description: this.normalizeText(dto.description),
            location: this.normalizeText(dto.location),
            country_code: this.normalizeUpperText(dto.country_code),
            country: this.normalizeText(dto.country),
            region: this.normalizeText(dto.region),
            district: this.normalizeText(dto.district),
            ward: this.normalizeText(dto.ward),
            latitude: this.normalizeCoordinate(dto.latitude),
            longitude: this.normalizeCoordinate(dto.longitude),
            value: declaredValue,
            currency,
            status: dto.status?.trim().toUpperCase() ?? 'ACTIVE',
            snapshot_version: 1,
            metadata: dto.metadata ?? null,
            created_by: userId,
            updated_by: userId,
          }),
        );
      });

      return this.findSubjectMatter(companyId, created.id);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A subject matter with the same code already exists in this company',
        );
      }
      throw error;
    }
  }

  async listSubjectMatters(companyId: string, query: FilterNonMotorDto) {
    const qb = this.subjectMatterRepository
      .createQueryBuilder('subjectMatter')
      .leftJoinAndSelect('subjectMatter.customer', 'customer')
      .where('subjectMatter.company_id = :companyId', { companyId });

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(subjectMatter.subject_code ILIKE :term OR subjectMatter.description ILIKE :term OR subjectMatter.location ILIKE :term)',
        { term },
      );
    }

    return this.listWithPagination(
      qb,
      query,
      ['subject_code', 'subject_type', 'created_at', 'updated_at'],
      'created_at',
    );
  }

  async findSubjectMatter(companyId: string, id: string) {
    const subjectMatter = await this.subjectMatterRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        customer: true,
        owner_customer: true,
        company: true,
        creator: true,
        updater: true,
        factor_values: true,
        insured_asset: true,
      },
    });
    if (!subjectMatter) throw new NotFoundException('Subject matter not found');
    return subjectMatter;
  }

  async updateSubjectMatter(
    companyId: string,
    id: string,
    dto: UpdateSubjectMatterDto,
    userId: string,
  ) {
    await this.findSubjectMatter(companyId, id);

    try {
      await this.dataSource.transaction(async (manager) => {
        const subjectMatter = await manager
          .getRepository(SubjectMatter)
          .findOneOrFail({
            where: { id, company_id: companyId },
            relations: { insured_asset: true },
          });

        const customer =
          dto.customer_id !== undefined
            ? await this.ensureCustomer(companyId, dto.customer_id)
            : await this.ensureCustomer(companyId, subjectMatter.customer_id);
        const ownerCustomer = await this.ensureCustomer(
          companyId,
          dto.owner_customer_id ??
            subjectMatter.owner_customer_id ??
            customer.id,
        );

        if (dto.customer_id !== undefined) {
          subjectMatter.customer_id = customer.id;
        }
        if (dto.owner_customer_id !== undefined) {
          subjectMatter.owner_customer_id = ownerCustomer.id;
        }
        if (dto.subject_type !== undefined)
          subjectMatter.subject_type = this.normalizeText(dto.subject_type);
        if (dto.subject_category !== undefined)
          subjectMatter.subject_category = this.normalizeText(
            dto.subject_category,
          );
        if (dto.subject_code !== undefined)
          subjectMatter.subject_code = this.normalizeUpperText(
            dto.subject_code,
          )!;
        if (dto.description !== undefined)
          subjectMatter.description = this.normalizeText(dto.description);
        if (dto.location !== undefined)
          subjectMatter.location = this.normalizeText(dto.location);
        if (dto.country_code !== undefined)
          subjectMatter.country_code = this.normalizeUpperText(
            dto.country_code,
          );
        if (dto.country !== undefined)
          subjectMatter.country = this.normalizeText(dto.country);
        if (dto.region !== undefined)
          subjectMatter.region = this.normalizeText(dto.region);
        if (dto.district !== undefined)
          subjectMatter.district = this.normalizeText(dto.district);
        if (dto.ward !== undefined)
          subjectMatter.ward = this.normalizeText(dto.ward);
        if (dto.latitude !== undefined)
          subjectMatter.latitude = this.normalizeCoordinate(dto.latitude);
        if (dto.longitude !== undefined)
          subjectMatter.longitude = this.normalizeCoordinate(dto.longitude);
        if (dto.value !== undefined)
          subjectMatter.value = this.normalizeMoney(dto.value);
        if (dto.currency !== undefined)
          subjectMatter.currency = dto.currency.trim().toUpperCase();
        if (dto.status !== undefined)
          subjectMatter.status = dto.status.trim().toUpperCase();
        if (dto.metadata !== undefined)
          subjectMatter.metadata = dto.metadata ?? null;
        subjectMatter.updated_by = userId;

        if (subjectMatter.insured_asset) {
          subjectMatter.insured_asset.customer_id = customer.id;
          subjectMatter.insured_asset.owner_customer_id = ownerCustomer.id;
          subjectMatter.insured_asset.display_name =
            subjectMatter.description ??
            subjectMatter.subject_code ??
            subjectMatter.insured_asset.display_name;
          subjectMatter.insured_asset.ownership_type =
            dto.ownership_type ?? subjectMatter.insured_asset.ownership_type;
          subjectMatter.insured_asset.declared_value = subjectMatter.value;
          subjectMatter.insured_asset.currency_code = subjectMatter.currency;
          subjectMatter.insured_asset.updated_by = userId;
          await manager
            .getRepository(InsuredAsset)
            .save(subjectMatter.insured_asset);
        }

        await manager.getRepository(SubjectMatter).save(subjectMatter);
      });

      return this.findSubjectMatter(companyId, id);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A subject matter with the same code already exists in this company',
        );
      }
      throw error;
    }
  }

  async removeSubjectMatter(companyId: string, id: string): Promise<void> {
    const subjectMatter = await this.findSubjectMatter(companyId, id);
    await this.subjectMatterRepository.softDelete(subjectMatter.id);
  }

  async createFactorValue(
    companyId: string,
    dto: CreateSubjectMatterFactorValueDto,
  ) {
    this.validateSingleTypedFactorValue(dto);

    return this.dataSource.transaction(async (manager) => {
      const subject = await this.ensureSubjectMatter(
        companyId,
        dto.subject_matter_id,
      );
      const factor = await this.ensureRatingFactor(companyId, dto.factor_id);
      this.assertFactorValueMatchesType(factor, dto);

      const repository = manager.getRepository(SubjectMatterFactorValue);
      const existing = await repository.findOne({
        where: {
          subject_matter_id: subject.id,
          factor_id: factor.id,
        },
      });

      const nextValue = repository.create({
        ...existing,
        subject_matter_id: subject.id,
        factor_id: factor.id,
        value_text: this.normalizeText(dto.value_text),
        value_number:
          dto.value_number === undefined || dto.value_number === null
            ? null
            : this.normalizeMoney(dto.value_number),
        value_date: this.normalizeDate(dto.value_date),
        value_boolean: dto.value_boolean ?? null,
        value_json: dto.value_json ?? null,
      });

      const valueChanged =
        !existing ||
        JSON.stringify({
          value_text: existing.value_text,
          value_number: existing.value_number,
          value_date: existing.value_date,
          value_boolean: existing.value_boolean,
          value_json: existing.value_json,
        }) !==
          JSON.stringify({
            value_text: nextValue.value_text,
            value_number: nextValue.value_number,
            value_date: nextValue.value_date,
            value_boolean: nextValue.value_boolean,
            value_json: nextValue.value_json,
          });

      const saved = await repository.save(nextValue);

      if (valueChanged) {
        await manager
          .getRepository(SubjectMatter)
          .increment({ id: subject.id }, 'snapshot_version', 1);
        const refreshed = await manager.getRepository(SubjectMatter).findOne({
          where: { id: subject.id },
        });
        if (refreshed?.insured_asset_id) {
          await manager
            .getRepository(InsuredAsset)
            .increment(
              { id: refreshed.insured_asset_id },
              'snapshot_version',
              1,
            );
        }
      }

      return saved;
    });
  }

  async listFactorValues(companyId: string, subjectMatterId?: string) {
    const qb = this.factorValueRepository
      .createQueryBuilder('value')
      .leftJoinAndSelect('value.subject_matter', 'subjectMatter')
      .leftJoinAndSelect('value.factor', 'factor')
      .where('subjectMatter.company_id = :companyId', { companyId });
    if (subjectMatterId)
      qb.andWhere('value.subject_matter_id = :subjectMatterId', {
        subjectMatterId,
      });
    return qb.orderBy('value.created_at', 'DESC').getMany();
  }

  async createPolicyDetail(
    companyId: string,
    dto: CreateNonMotorPolicyDetailDto,
  ) {
    await this.ensureSubjectMatter(companyId, dto.subject_matter_id);
    await this.ensurePolicy(companyId, dto.policy_id);
    if (dto.policy_risk_id)
      await this.ensurePolicyRisk(companyId, dto.policy_risk_id);
    return this.policyDetailRepository.save(
      this.policyDetailRepository.create({
        policy_id: dto.policy_id,
        policy_risk_id: dto.policy_risk_id,
        subject_matter_id: dto.subject_matter_id,
        cover_description: this.normalizeText(dto.cover_description),
        risk_location: this.normalizeText(dto.risk_location),
        insured_value:
          dto.insured_value === undefined || dto.insured_value === null
            ? null
            : this.normalizeMoney(dto.insured_value),
        limit_of_liability:
          dto.limit_of_liability === undefined ||
          dto.limit_of_liability === null
            ? null
            : this.normalizeMoney(dto.limit_of_liability),
      }),
    );
  }

  async listPolicyDetails(companyId: string, policyId?: string) {
    const qb = this.policyDetailRepository
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.subject_matter', 'subjectMatter')
      .where('subjectMatter.company_id = :companyId', { companyId });
    if (policyId) qb.andWhere('detail.policy_id = :policyId', { policyId });
    return qb.orderBy('detail.created_at', 'DESC').getMany();
  }
}
