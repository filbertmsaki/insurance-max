import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { CreateProductCommissionRuleDto } from './dto/create-product-commission-rule.dto';
import { CreateProductDistributionChannelDto } from './dto/create-product-distribution-channel.dto';
import { CreateProductDocumentRequirementDto } from './dto/create-product-document-requirement.dto';
import { CreateProductTaxRuleDto } from './dto/create-product-tax-rule.dto';
import { ProductChannelType } from './enums/product-channel-type.enum';
import { ProductDistributionChannel } from './entities/product-distribution-channel.entity';
import { ProductCommissionRule } from './entities/product-commission-rule.entity';
import { ProductDocumentRequirement } from './entities/product-document-requirement.entity';
import { ProductTaxRule } from './entities/product-tax-rule.entity';
import { ProductRuleStatus } from './enums/product-rule-status.enum';

@Injectable()
export class ProductDistributionService {
  constructor(
    @InjectRepository(ProductDistributionChannel)
    private readonly channelRepository: Repository<ProductDistributionChannel>,

    @InjectRepository(ProductCommissionRule)
    private readonly commissionRepository: Repository<ProductCommissionRule>,

    @InjectRepository(ProductTaxRule)
    private readonly taxRepository: Repository<ProductTaxRule>,

    @InjectRepository(ProductDocumentRequirement)
    private readonly documentRepository: Repository<ProductDocumentRequirement>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    @InjectRepository(InsuranceCategory)
    private readonly categoryRepository: Repository<InsuranceCategory>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(InsuranceSubClass)
    private readonly subClassRepository: Repository<InsuranceSubClass>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

  async createChannel(
    companyId: string,
    dto: CreateProductDistributionChannelDto,
    userId: string,
  ): Promise<ProductDistributionChannel> {
    this.assertCompanyScope(companyId, dto.insurer_company_id);
    await this.ensureCompanyExists(dto.insurer_company_id);
    await this.ensureOptionalCompanyExists(dto.intermediary_company_id);
    await this.ensureProductBelongsToCompany(
      dto.insurer_company_id,
      dto.product_id,
    );
    await this.ensureOptionalCategoryBelongsToCompany(
      dto.insurer_company_id,
      dto.category_id,
    );
    await this.ensureOptionalSubClassBelongsToProduct(
      dto.insurer_company_id,
      dto.sub_class_id,
      dto.product_id,
    );

    this.assertDateRange(dto.effective_from, dto.effective_to);
    this.assertChannelScope(dto.channel_type, dto.intermediary_company_id);

    const record = this.channelRepository.create({
      insurer_company_id: dto.insurer_company_id,
      intermediary_company_id: dto.intermediary_company_id ?? null,
      category_id: dto.category_id ?? null,
      product_id: dto.product_id,
      sub_class_id: dto.sub_class_id ?? null,
      channel_type: dto.channel_type,
      can_quote: dto.can_quote ?? false,
      can_bind: dto.can_bind ?? false,
      can_issue_policy: dto.can_issue_policy ?? false,
      can_collect_premium: dto.can_collect_premium ?? false,
      requires_underwriting: dto.requires_underwriting ?? false,
      requires_insurer_approval: dto.requires_insurer_approval ?? false,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to,
      status: dto.status ?? ProductRuleStatus.ACTIVE,
      metadata: dto.metadata ?? null,
      created_by: userId,
      updated_by: userId,
    });

    return this.channelRepository.save(record);
  }

  async listChannels(companyId: string): Promise<ProductDistributionChannel[]> {
    return this.channelRepository.find({
      where: { insurer_company_id: companyId },
      relations: {
        insurer_company: true,
        intermediary_company: true,
        category: true,
        product: true,
        sub_class: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async listChannelsForIntermediary(
    intermediaryCompanyId: string,
  ): Promise<ProductDistributionChannel[]> {
    return this.channelRepository.find({
      where: { intermediary_company_id: intermediaryCompanyId },
      relations: {
        insurer_company: true,
        category: true,
        product: true,
        sub_class: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async removeChannel(companyId: string, id: string): Promise<void> {
    const record = await this.channelRepository.findOne({
      where: { id, insurer_company_id: companyId },
    });
    if (!record) throw new NotFoundException('Distribution channel not found');
    await this.channelRepository.softDelete(record.id);
  }

  async restoreChannel(companyId: string, id: string): Promise<void> {
    const record = await this.channelRepository.findOne({
      where: { id, insurer_company_id: companyId },
      withDeleted: true,
    });
    if (!record) throw new NotFoundException('Distribution channel not found');
    await this.channelRepository.restore(record.id);
  }

  async createCommissionRule(
    companyId: string,
    dto: CreateProductCommissionRuleDto,
  ): Promise<ProductCommissionRule> {
    this.assertCompanyScope(companyId, dto.insurer_company_id);
    await this.ensureCompanyExists(dto.insurer_company_id);
    await this.ensureOptionalCompanyExists(dto.intermediary_company_id);
    await this.ensureProductBelongsToCompany(
      dto.insurer_company_id,
      dto.product_id,
    );
    await this.ensureOptionalCategoryBelongsToCompany(
      dto.insurer_company_id,
      dto.category_id,
    );
    await this.ensureOptionalRiskBelongsToProduct(
      dto.insurer_company_id,
      dto.risk_id,
      dto.product_id,
    );
    this.assertDateRange(dto.effective_from, dto.effective_to);

    const record = this.commissionRepository.create({
      insurer_company_id: dto.insurer_company_id,
      intermediary_company_id: dto.intermediary_company_id ?? null,
      category_id: dto.category_id ?? null,
      product_id: dto.product_id,
      risk_id: dto.risk_id ?? null,
      channel_type: dto.channel_type,
      commission_type: dto.commission_type,
      commission_rate:
        dto.commission_rate !== undefined && dto.commission_rate !== null
          ? String(dto.commission_rate)
          : null,
      commission_amount:
        dto.commission_amount !== undefined && dto.commission_amount !== null
          ? String(dto.commission_amount)
          : null,
      minimum_commission:
        dto.minimum_commission !== undefined && dto.minimum_commission !== null
          ? String(dto.minimum_commission)
          : null,
      maximum_commission:
        dto.maximum_commission !== undefined && dto.maximum_commission !== null
          ? String(dto.maximum_commission)
          : null,
      calculation_base: dto.calculation_base ?? undefined,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to,
      status: dto.status ?? ProductRuleStatus.ACTIVE,
      metadata: null,
    });

    return this.commissionRepository.save(record);
  }

  async listCommissionRules(
    companyId: string,
  ): Promise<ProductCommissionRule[]> {
    return this.commissionRepository.find({
      where: { insurer_company_id: companyId },
      relations: {
        insurer_company: true,
        intermediary_company: true,
        category: true,
        product: true,
        risk: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async removeCommissionRule(companyId: string, id: string): Promise<void> {
    const record = await this.commissionRepository.findOne({
      where: { id, insurer_company_id: companyId },
    });
    if (!record) throw new NotFoundException('Commission rule not found');
    await this.commissionRepository.softDelete(record.id);
  }

  async restoreCommissionRule(companyId: string, id: string): Promise<void> {
    const record = await this.commissionRepository.findOne({
      where: { id, insurer_company_id: companyId },
      withDeleted: true,
    });
    if (!record) throw new NotFoundException('Commission rule not found');
    await this.commissionRepository.restore(record.id);
  }

  async createTaxRule(
    companyId: string,
    dto: CreateProductTaxRuleDto,
  ): Promise<ProductTaxRule> {
    this.assertCompanyScope(companyId, dto.company_id);
    await this.ensureCompanyExists(dto.company_id);
    await this.ensureOptionalCategoryBelongsToCompany(
      dto.company_id,
      dto.category_id,
    );
    await this.ensureOptionalProductBelongsToCompany(
      dto.company_id,
      dto.product_id,
    );
    await this.ensureOptionalRiskBelongsToProduct(
      dto.company_id,
      dto.risk_id,
      dto.product_id,
    );
    this.assertDateRange(dto.effective_from, dto.effective_to);

    const record = this.taxRepository.create({
      company_id: dto.company_id,
      category_id: dto.category_id ?? null,
      product_id: dto.product_id ?? null,
      risk_id: dto.risk_id ?? null,
      tax_name: dto.tax_name.trim(),
      tax_code: dto.tax_code.trim().toUpperCase(),
      tax_type: dto.tax_type,
      tax_rate:
        dto.tax_rate !== undefined && dto.tax_rate !== null
          ? String(dto.tax_rate)
          : null,
      tax_amount:
        dto.tax_amount !== undefined && dto.tax_amount !== null
          ? String(dto.tax_amount)
          : null,
      calculation_base: dto.calculation_base ?? undefined,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to,
      status: dto.status ?? ProductRuleStatus.ACTIVE,
    });

    return this.taxRepository.save(record);
  }

  async listTaxRules(companyId: string): Promise<ProductTaxRule[]> {
    return this.taxRepository.find({
      where: { company_id: companyId },
      relations: { company: true, category: true, product: true, risk: true },
      order: { created_at: 'DESC' },
    });
  }

  async removeTaxRule(companyId: string, id: string): Promise<void> {
    const record = await this.taxRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!record) throw new NotFoundException('Tax rule not found');
    await this.taxRepository.softDelete(record.id);
  }

  async restoreTaxRule(companyId: string, id: string): Promise<void> {
    const record = await this.taxRepository.findOne({
      where: { id, company_id: companyId },
      withDeleted: true,
    });
    if (!record) throw new NotFoundException('Tax rule not found');
    await this.taxRepository.restore(record.id);
  }

  async createDocumentRequirement(
    companyId: string,
    dto: CreateProductDocumentRequirementDto,
  ): Promise<ProductDocumentRequirement> {
    this.assertCompanyScope(companyId, dto.company_id);
    await this.ensureCompanyExists(dto.company_id);
    await this.ensureProductBelongsToCompany(dto.company_id, dto.product_id);
    await this.ensureOptionalRiskBelongsToProduct(
      dto.company_id,
      dto.risk_id,
      dto.product_id,
    );

    const record = this.documentRepository.create({
      company_id: dto.company_id,
      product_id: dto.product_id,
      risk_id: dto.risk_id ?? null,
      document_type: dto.document_type.trim(),
      document_name: dto.document_name.trim(),
      is_required: dto.is_required ?? false,
      is_required_before_quote: dto.is_required_before_quote ?? false,
      is_required_before_policy: dto.is_required_before_policy ?? false,
      is_required_before_claim: dto.is_required_before_claim ?? false,
      status: dto.status ?? ProductRuleStatus.ACTIVE,
    });

    return this.documentRepository.save(record);
  }

  async listDocumentRequirements(
    companyId: string,
  ): Promise<ProductDocumentRequirement[]> {
    return this.documentRepository.find({
      where: { company_id: companyId },
      relations: { company: true, product: true, risk: true },
      order: { created_at: 'DESC' },
    });
  }

  async removeDocumentRequirement(
    companyId: string,
    id: string,
  ): Promise<void> {
    const record = await this.documentRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!record) throw new NotFoundException('Document requirement not found');
    await this.documentRepository.softDelete(record.id);
  }

  async restoreDocumentRequirement(
    companyId: string,
    id: string,
  ): Promise<void> {
    const record = await this.documentRepository.findOne({
      where: { id, company_id: companyId },
      withDeleted: true,
    });
    if (!record) throw new NotFoundException('Document requirement not found');
    await this.documentRepository.restore(record.id);
  }

  async assertCanQuote(
    requestingCompanyId: string,
    companyType: CompanyType | undefined,
    insurerCompanyId: string,
    productId: string,
    riskId?: string | null,
  ): Promise<ProductDistributionChannel | null> {
    if (!companyType || companyType === CompanyType.INSURANCE_COMPANY) {
      return null;
    }

    const channelType = this.mapCompanyTypeToChannelType(companyType);
    if (!channelType) {
      throw new ForbiddenException(
        'This company type cannot quote distribution products',
      );
    }

    const product = await this.productRepository.findOne({
      where: { id: productId, company_id: insurerCompanyId },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found for insurer');
    }

    const risk = riskId
      ? await this.riskRepository.findOne({
          where: {
            id: riskId,
            company_id: insurerCompanyId,
            product_id: productId,
          },
        })
      : null;

    const channel = await this.channelRepository
      .createQueryBuilder('channel')
      .where('channel.insurer_company_id = :insurerCompanyId', {
        insurerCompanyId,
      })
      .andWhere('channel.intermediary_company_id = :requestingCompanyId', {
        requestingCompanyId,
      })
      .andWhere('channel.product_id = :productId', { productId })
      .andWhere('channel.channel_type = :channelType', { channelType })
      .andWhere('channel.status = :status', {
        status: ProductRuleStatus.ACTIVE,
      })
      .andWhere('channel.can_quote = true')
      .andWhere('channel.deleted_at IS NULL')
      .andWhere('channel.effective_from <= :today', { today: this.today() })
      .andWhere('channel.effective_to >= :today', { today: this.today() })
      .andWhere(
        new Brackets((qb) => {
          qb.where('channel.category_id IS NULL').orWhere(
            'channel.category_id = :categoryId',
            { categoryId: product.category_id },
          );
        }),
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('channel.sub_class_id IS NULL').orWhere(
            'channel.sub_class_id = :subClassId',
            { subClassId: risk?.sub_class_id ?? null },
          );
        }),
      )
      .getOne();

    if (!channel) {
      throw new ForbiddenException(
        'You are not authorised to quote this product',
      );
    }

    return channel;
  }

  private async ensureCompanyExists(companyId: string): Promise<void> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) throw new BadRequestException('Company not found');
  }

  private async ensureOptionalCompanyExists(
    companyId?: string | null,
  ): Promise<void> {
    if (!companyId) return;
    await this.ensureCompanyExists(companyId);
  }

  private async ensureCategoryBelongsToCompany(
    companyId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, company_id: companyId },
    });
    if (!category) {
      throw new BadRequestException('Category not found for this company');
    }
  }

  private async ensureOptionalCategoryBelongsToCompany(
    companyId: string,
    categoryId?: string | null,
  ): Promise<void> {
    if (!categoryId) return;
    await this.ensureCategoryBelongsToCompany(companyId, categoryId);
  }

  private async ensureProductBelongsToCompany(
    companyId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId, company_id: companyId },
    });
    if (!product) {
      throw new BadRequestException('Product not found for this company');
    }
  }

  private async ensureOptionalProductBelongsToCompany(
    companyId: string,
    productId?: string | null,
  ): Promise<void> {
    if (!productId) return;
    await this.ensureProductBelongsToCompany(companyId, productId);
  }

  private async ensureSubClassBelongsToProduct(
    companyId: string,
    subClassId: string,
    productId: string,
  ): Promise<void> {
    const subClass = await this.subClassRepository.findOne({
      where: { id: subClassId, company_id: companyId, product_id: productId },
    });
    if (!subClass) {
      throw new BadRequestException('Sub class not found for this product');
    }
  }

  private async ensureOptionalSubClassBelongsToProduct(
    companyId: string,
    subClassId?: string | null,
    productId?: string | null,
  ): Promise<void> {
    if (!subClassId) return;
    if (!productId) {
      throw new BadRequestException(
        'product_id is required when sub_class_id is provided',
      );
    }
    await this.ensureSubClassBelongsToProduct(companyId, subClassId, productId);
  }

  private async ensureRiskBelongsToProduct(
    companyId: string,
    riskId: string,
    productId: string,
  ): Promise<void> {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, company_id: companyId, product_id: productId },
    });
    if (!risk) {
      throw new BadRequestException('Risk not found for this product');
    }
  }

  private async ensureOptionalRiskBelongsToProduct(
    companyId: string,
    riskId?: string | null,
    productId?: string | null,
  ): Promise<void> {
    if (!riskId) return;
    if (!productId) {
      throw new BadRequestException(
        'product_id is required when risk_id is provided',
      );
    }
    await this.ensureRiskBelongsToProduct(companyId, riskId, productId);
  }

  private assertCompanyScope(
    expectedCompanyId: string,
    payloadCompanyId: string,
  ): void {
    if (expectedCompanyId !== payloadCompanyId) {
      throw new ForbiddenException(
        'Company scope does not match the authenticated company',
      );
    }
  }

  private assertDateRange(effectiveFrom: string, effectiveTo: string): void {
    if (new Date(effectiveFrom) > new Date(effectiveTo)) {
      throw new BadRequestException(
        'effective_from must be on or before effective_to',
      );
    }
  }

  private assertChannelScope(
    channelType: ProductChannelType,
    intermediaryCompanyId?: string | null,
  ): void {
    if (channelType === ProductChannelType.DIRECT) {
      return;
    }

    if (!intermediaryCompanyId) {
      throw new BadRequestException(
        `${channelType} channels require intermediary_company_id`,
      );
    }
  }

  private mapCompanyTypeToChannelType(
    companyType: CompanyType,
  ): ProductChannelType | null {
    switch (companyType) {
      case CompanyType.BROKER:
        return ProductChannelType.BROKER;
      case CompanyType.AGENCY:
        return ProductChannelType.AGENCY;
      case CompanyType.BANCASSURANCE:
        return ProductChannelType.BANCASSURANCE;
      case CompanyType.SERVICE_PROVIDER:
        return ProductChannelType.API;
      default:
        return null;
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
