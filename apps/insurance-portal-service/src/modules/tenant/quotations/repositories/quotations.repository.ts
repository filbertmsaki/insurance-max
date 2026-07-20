import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  Repository,
} from 'typeorm';
import { FilterQuotationDto } from '../dto/filter-quotation.dto';
import { Quotation } from '../entities/quotation.entity';

export interface QuotationPaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
}

export interface PaginatedQuotations {
  items: Quotation[];
  meta: QuotationPaginationMeta;
}

@Injectable()
export class QuotationsRepository {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
  ) {}

  /**
   * Load the complete quotation aggregate.
   */
  async findOneAggregate(
    companyId: string,
    id: string,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.cover_note', 'coverNote')
      .leftJoinAndSelect('coverNote.entries', 'entry')
      .leftJoinAndSelect('entry.risks', 'risk')
      .leftJoinAndSelect('risk.discounts', 'riskDiscount')
      .leftJoinAndSelect('risk.taxes', 'riskTax')
      .leftJoinAndSelect('entry.subject_matters', 'subjectMatter')
      .leftJoinAndSelect('entry.addons', 'addon')
      .leftJoinAndSelect('addon.taxes', 'addonTax')
      .leftJoinAndSelect('entry.motor_detail', 'motorDetail')
      .leftJoinAndSelect('quotation.policy_holders', 'policyHolder')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL')
      .orderBy('entry.entry_number', 'ASC')
      .addOrderBy('risk.sequence_no', 'ASC')
      .addOrderBy('riskDiscount.sequence_no', 'ASC')
      .addOrderBy('riskTax.sequence_no', 'ASC')
      .addOrderBy('subjectMatter.sequence_no', 'ASC')
      .addOrderBy('addon.sequence_no', 'ASC')
      .addOrderBy('addonTax.sequence_no', 'ASC')
      .addOrderBy('policyHolder.sequence_no', 'ASC')
      .getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!quotation.cover_note) {
      throw new NotFoundException(
        'Quotation cover-note information was not found',
      );
    }

    return quotation;
  }

  /**
   * Load only the root and cover-note header for the list screen.
   */
  async findAll(
    companyId: string,
    query: FilterQuotationDto,
  ): Promise<PaginatedQuotations> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);

    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.cover_note', 'coverNote')
      .where('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL');

    if (query.status) {
      queryBuilder.andWhere('quotation.status = :status', {
        status: query.status,
      });
    }

    if (query.quotation_type) {
      queryBuilder.andWhere('quotation.quotation_type = :quotationType', {
        quotationType: query.quotation_type,
      });
    }

    if (query.quotation_flow) {
      queryBuilder.andWhere('quotation.quotation_flow = :quotationFlow', {
        quotationFlow: query.quotation_flow,
      });
    }

    if (query.product_id) {
      queryBuilder.andWhere('quotation.product_id = :productId', {
        productId: query.product_id,
      });
    }

    if (query.customer_id) {
      queryBuilder.andWhere(
        new Brackets((customerQuery) => {
          customerQuery
            .where('quotation.customer_id = :customerId', {
              customerId: query.customer_id,
            })
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_policy_holders AS customer_holder
                WHERE
                  customer_holder.quotation_id = quotation.id
                  AND customer_holder.customer_id = :customerId
              )
            `);
        }),
      );
    }

    const search = query.search?.trim();

    if (search) {
      const searchValue = `%${search}%`;

      queryBuilder.andWhere(
        new Brackets((searchQuery) => {
          searchQuery
            .where('quotation.quotation_no ILIKE :search', {
              search: searchValue,
            })
            .orWhere('coverNote.fleet_id ILIKE :search')
            .orWhere('coverNote.product_code ILIKE :search')
            .orWhere('coverNote.officer_name ILIKE :search')
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_cover_note_entries AS entry_search
                WHERE
                  entry_search.cover_note_id = coverNote.id
                  AND (
                    entry_search.cover_note_number ILIKE :search
                    OR entry_search.prev_cover_note_reference_number ILIKE :search
                  )
              )
            `)
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_policy_holders AS holder_search
                WHERE
                  holder_search.quotation_id = quotation.id
                  AND (
                    holder_search.policy_holder_name ILIKE :search
                    OR holder_search.policy_holder_id_number ILIKE :search
                    OR holder_search.policy_holder_phone_number ILIKE :search
                    OR holder_search.email_address ILIKE :search
                  )
              )
            `)
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_cover_note_entries AS motor_entry_search
                INNER JOIN quotation_motor_details AS motor_search
                  ON motor_search.entry_id = motor_entry_search.id
                WHERE
                  motor_entry_search.cover_note_id = coverNote.id
                  AND (
                    motor_search.registration_number ILIKE :search
                    OR motor_search.chassis_number ILIKE :search
                    OR motor_search.engine_number ILIKE :search
                    OR motor_search.owner_name ILIKE :search
                  )
              )
            `)
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_cover_note_entries AS subject_entry_search
                INNER JOIN quotation_subject_matters AS subject_search
                  ON subject_search.entry_id = subject_entry_search.id
                WHERE
                  subject_entry_search.cover_note_id = coverNote.id
                  AND (
                    subject_search.subject_matter_reference ILIKE :search
                    OR subject_search.subject_matter_desc ILIKE :search
                  )
              )
            `);
        }),
      );
    }

    queryBuilder
      .orderBy('quotation.created_at', 'DESC')
      .addOrderBy('quotation.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_previous_page: page > 1,
        has_next_page: page < totalPages,
      },
    };
  }

  async exists(
    companyId: string,
    id: string,
  ): Promise<boolean> {
    return this.quotationRepository.exists({
      where: {
        id,
        company_id: companyId,
      },
    });
  }

  private normalizePage(value: unknown): number {
    const parsed = Number(value ?? 1);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }

    return Math.floor(parsed);
  }

  private normalizeLimit(value: unknown): number {
    const parsed = Number(value ?? 20);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 20;
    }

    return Math.min(100, Math.floor(parsed));
  }
}
