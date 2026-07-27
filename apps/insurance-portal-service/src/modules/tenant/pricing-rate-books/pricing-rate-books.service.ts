import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { ClonePricingRateBookDto } from './dto/clone-pricing-rate-book.dto';
import { CreatePricingRateBookDto } from './dto/create-pricing-rate-book.dto';
import { FilterPricingRateBookDto } from './dto/filter-pricing-rate-book.dto';
import { UpdatePricingRateBookDto } from './dto/update-pricing-rate-book.dto';
import { PricingRateBookStatus } from './enums/pricing-rate-book-status.enum';
import { PricingRateBook } from './entities/pricing-rate-book.entity';

@Injectable()
export class PricingRateBooksService {
  constructor(
    @InjectRepository(PricingRateBook)
    private readonly rateBookRepository: Repository<PricingRateBook>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    @InjectRepository(RiskRuleCondition)
    private readonly conditionRepository: Repository<RiskRuleCondition>,
  ) {}

  async create(
    companyId: string,
    dto: CreatePricingRateBookDto,
    userId: string,
  ): Promise<PricingRateBook> {
    await this.assertActiveProduct(companyId, dto.product_id);
    this.assertEffectiveDateRange(dto.effective_from, dto.effective_to ?? null);

    const entity = this.rateBookRepository.create({
      company_id: companyId,
      product_id: dto.product_id,
      code: dto.code.trim().toUpperCase(),
      version: dto.version.trim(),
      name: dto.name?.trim() ?? null,
      currency_code: dto.currency_code?.trim().toUpperCase() ?? null,
      status: PricingRateBookStatus.DRAFT,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to ?? null,
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.rateBookRepository.save(entity);
    } catch (error) {
      this.rethrowDuplicate(error, entity.code, entity.version);
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterPricingRateBookDto) {
    const qb = this.rateBookRepository
      .createQueryBuilder('rate_book')
      .leftJoinAndSelect('rate_book.product', 'product')
      .where('rate_book.company_id = :companyId', { companyId })
      .orderBy('rate_book.created_at', 'DESC');

    if (query.product_id) {
      qb.andWhere('rate_book.product_id = :productId', {
        productId: query.product_id,
      });
    }
    if (query.status) {
      qb.andWhere('rate_book.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  async findOne(companyId: string, id: string): Promise<PricingRateBook> {
    const rateBook = await this.rateBookRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        product: true,
        rules: {
          risk: true,
          conditions: true,
        },
      },
      order: {
        rules: {
          priority: 'ASC',
          created_at: 'ASC',
        },
      },
    });
    if (!rateBook) {
      throw new NotFoundException('Pricing rate book not found');
    }
    return rateBook;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdatePricingRateBookDto,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    this.assertEditable(rateBook);

    if (dto.product_id !== undefined) {
      await this.assertActiveProduct(companyId, dto.product_id);
      rateBook.product_id = dto.product_id;
    }
    if (dto.code !== undefined) {
      rateBook.code = dto.code.trim().toUpperCase();
    }
    if (dto.version !== undefined) {
      rateBook.version = dto.version.trim();
    }
    if (dto.name !== undefined) {
      rateBook.name = dto.name?.trim() ?? null;
    }
    if (dto.currency_code !== undefined) {
      rateBook.currency_code = dto.currency_code?.trim().toUpperCase() ?? null;
    }
    if (dto.effective_from !== undefined) {
      rateBook.effective_from = dto.effective_from;
    }
    if (dto.effective_to !== undefined) {
      rateBook.effective_to = dto.effective_to ?? null;
    }
    this.assertEffectiveDateRange(
      rateBook.effective_from,
      rateBook.effective_to ?? null,
    );
    rateBook.updated_by = userId;

    try {
      return await this.rateBookRepository.save(rateBook);
    } catch (error) {
      this.rethrowDuplicate(error, rateBook.code, rateBook.version);
      throw error;
    }
  }

  async clone(
    companyId: string,
    dto: ClonePricingRateBookDto,
    userId: string,
  ): Promise<PricingRateBook> {
    const source = await this.rateBookRepository.findOne({
      where: { id: dto.source_rate_book_id, company_id: companyId },
      relations: {
        rules: {
          conditions: true,
        },
      },
      order: {
        rules: {
          priority: 'ASC',
          created_at: 'ASC',
        },
      },
    });
    if (!source) {
      throw new NotFoundException('Source pricing rate book not found');
    }

    const draft = await this.create(
      companyId,
      {
        product_id: source.product_id,
        code: dto.code ?? source.code,
        version: dto.version,
        name: dto.name ?? source.name ?? undefined,
        currency_code: source.currency_code ?? undefined,
        effective_from: dto.effective_from ?? source.effective_from,
        effective_to: dto.effective_to ?? source.effective_to,
      },
      userId,
    );

    const clonedRateBook = await this.rateBookRepository.manager.transaction(
      async (manager) => {
        const ruleRepo = manager.getRepository(RiskRatingRule);
        const conditionRepo = manager.getRepository(RiskRuleCondition);

        for (const rule of source.rules ?? []) {
          const clonedRule = await ruleRepo.save(
            ruleRepo.create({
              company_id: companyId,
              risk_id: rule.risk_id,
              rate_book_id: draft.id,
              rule_name: rule.rule_name,
              rate_type: rule.rate_type,
              percentage_rate: rule.percentage_rate,
              fixed_amount: rule.fixed_amount,
              per_unit_amount: rule.per_unit_amount,
              per_unit_factor_code: rule.per_unit_factor_code,
              minimum_amount: rule.minimum_amount,
              formula: rule.formula,
              priority: rule.priority,
              is_active: rule.is_active,
              rule_version: (rule.rule_version ?? 1) + 1,
              created_by: userId,
              updated_by: userId,
            }),
          );

          for (const condition of rule.conditions ?? []) {
            await conditionRepo.save(
              conditionRepo.create({
                company_id: companyId,
                rule_id: clonedRule.id,
                factor_code: condition.factor_code,
                operator: condition.operator,
                value_from: condition.value_from,
                value_to: condition.value_to,
                logical_operator: condition.logical_operator,
                created_by: userId,
                updated_by: userId,
              }),
            );
          }
        }

        return manager.getRepository(PricingRateBook).findOneOrFail({
          where: { id: draft.id, company_id: companyId },
          relations: {
            rules: {
              conditions: true,
            },
          },
        });
      },
    );

    return clonedRateBook;
  }

  async submitForReview(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (
      ![PricingRateBookStatus.DRAFT, PricingRateBookStatus.REJECTED].includes(
        rateBook.status,
      )
    ) {
      throw new ConflictException(
        'Only DRAFT or REJECTED rate books can be submitted for review',
      );
    }
    await this.assertHasRules(rateBook.id);
    rateBook.status = PricingRateBookStatus.UNDER_REVIEW;
    rateBook.reviewed_by = userId;
    rateBook.reviewed_at = new Date();
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async approve(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (rateBook.status !== PricingRateBookStatus.UNDER_REVIEW) {
      throw new ConflictException(
        'Only UNDER_REVIEW rate books can be approved',
      );
    }
    await this.assertHasRules(rateBook.id);
    rateBook.status = PricingRateBookStatus.APPROVED;
    rateBook.approved_by = userId;
    rateBook.approved_at = new Date();
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async reject(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (
      ![
        PricingRateBookStatus.UNDER_REVIEW,
        PricingRateBookStatus.APPROVED,
      ].includes(rateBook.status)
    ) {
      throw new ConflictException(
        'Only UNDER_REVIEW or APPROVED rate books can be rejected',
      );
    }
    rateBook.status = PricingRateBookStatus.REJECTED;
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async publish(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (rateBook.status !== PricingRateBookStatus.APPROVED) {
      throw new ConflictException('Only APPROVED rate books can be published');
    }
    await this.assertHasRules(rateBook.id);

    const overlappingPublishedQuery = this.rateBookRepository
      .createQueryBuilder('rate_book')
      .where('rate_book.company_id = :companyId', { companyId })
      .andWhere('rate_book.product_id = :productId', {
        productId: rateBook.product_id,
      })
      .andWhere('rate_book.status = :status', {
        status: PricingRateBookStatus.PUBLISHED,
      });

    if (rateBook.currency_code) {
      overlappingPublishedQuery.andWhere(
        'rate_book.currency_code = :currencyCode',
        {
          currencyCode: rateBook.currency_code,
        },
      );
    } else {
      overlappingPublishedQuery.andWhere('rate_book.currency_code IS NULL');
    }

    const overlappingPublished = await overlappingPublishedQuery.getMany();

    const conflictingBooks = overlappingPublished.filter(
      (candidate) =>
        candidate.id !== rateBook.id &&
        this.dateRangesOverlap(
          rateBook.effective_from,
          rateBook.effective_to,
          candidate.effective_from,
          candidate.effective_to,
        ),
    );

    for (const previous of conflictingBooks) {
      previous.status = PricingRateBookStatus.RETIRED;
      previous.updated_by = userId;
      await this.rateBookRepository.save(previous);
    }

    rateBook.status = PricingRateBookStatus.PUBLISHED;
    rateBook.published_by = userId;
    rateBook.published_at = new Date();
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async retire(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (rateBook.status !== PricingRateBookStatus.PUBLISHED) {
      throw new ConflictException('Only PUBLISHED rate books can be retired');
    }
    rateBook.status = PricingRateBookStatus.RETIRED;
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const rateBook = await this.requireRateBook(companyId, id);
    this.assertEditable(rateBook);
    await this.rateBookRepository.softDelete(rateBook.id);
  }

  async requireRateBook(companyId: string, id: string): Promise<PricingRateBook> {
    const rateBook = await this.rateBookRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!rateBook) {
      throw new NotFoundException('Pricing rate book not found');
    }
    return rateBook;
  }

  private assertEditable(rateBook: PricingRateBook) {
    if (rateBook.status === PricingRateBookStatus.PUBLISHED) {
      throw new ConflictException(
        'Published rate books cannot be edited directly. Clone a new version instead.',
      );
    }
    if (
      ![PricingRateBookStatus.DRAFT, PricingRateBookStatus.REJECTED].includes(
        rateBook.status,
      )
    ) {
      throw new ConflictException(
        `Rate books in ${rateBook.status} status are not directly editable`,
      );
    }
  }

  private async assertActiveProduct(companyId: string, productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, company_id: companyId },
    });
    if (!product) {
      throw new BadRequestException(
        'Product not found or does not belong to this company',
      );
    }
    if (!product.is_active) {
      throw new ConflictException('Cannot create a rate book for an inactive product');
    }
  }

  private assertEffectiveDateRange(
    effectiveFrom: string,
    effectiveTo: string | null,
  ) {
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effective_to must be on or after effective_from',
      );
    }
  }

  private async assertHasRules(rateBookId: string) {
    const count = await this.ruleRepository.count({
      where: { rate_book_id: rateBookId },
    });
    if (count === 0) {
      throw new ConflictException(
        'A rate book must contain at least one rating rule before lifecycle progression',
      );
    }
  }

  private dateRangesOverlap(
    startA: string,
    endA: string | null,
    startB: string,
    endB: string | null,
  ) {
    const normalizedEndA = endA ?? '9999-12-31';
    const normalizedEndB = endB ?? '9999-12-31';
    return startA <= normalizedEndB && startB <= normalizedEndA;
  }

  private rethrowDuplicate(
    error: unknown,
    code: string,
    version: string,
  ): never | void {
    if (!(error instanceof QueryFailedError)) {
      return;
    }
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    if (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    ) {
      throw new ConflictException(
        `A pricing rate book with code "${code}" and version "${version}" already exists`,
      );
    }
  }
}
