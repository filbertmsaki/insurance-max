import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DocumentStatus } from '@insurance-max/contracts';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { ProductDefinitionService } from '../../insurance-products/product-definition.service';
import { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import {
  CreateRiskFieldDto,
  SaveRiskDetailsDto,
  UpdateRiskFieldDto,
} from './dto/non-motor-risk.dto';
import { ProductRiskField } from './entities/product-risk-field.entity';
import { QuotationNonMotorDetail } from './entities/quotation-non-motor-detail.entity';
import {
  validateRiskData,
  type RiskFieldDefinition,
  type RiskFieldError,
} from './risk-field.types';

const OPTION_TYPES = new Set(['SELECT', 'MULTI_SELECT']);
const QUOTATION_DOCUMENT_OWNER_TYPES = ['QUOTATION', 'quotation', 'quotations'];
/** Document statuses that satisfy a mandatory document requirement. */
const ATTACHED_DOCUMENT_STATUSES: string[] = [
  DocumentStatus.UPLOADED,
  DocumentStatus.SCAN_PENDING,
  DocumentStatus.SCANNING,
  DocumentStatus.AVAILABLE,
];
/** resolvePublishedDefinition codes meaning "no definition to check". */
const DEFINITION_UNAVAILABLE_CODES = new Set([
  'PRODUCT_DEFINITION_NOT_AVAILABLE',
  'PRODUCT_SUB_CLASS_NOT_AVAILABLE',
]);

function isDefinitionUnavailable(error: unknown): boolean {
  if (error instanceof NotFoundException) return true;
  if (!(error instanceof ForbiddenException)) return false;
  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    DEFINITION_UNAVAILABLE_CODES.has(
      String((response as { code?: unknown }).code),
    )
  );
}

function resolveEffectiveDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export interface QuotationRiskDetailsView {
  quotation_id: string;
  product_id: string | null;
  sub_class_id: string | null;
  /** Current schema for the quotation's product (what the wizard renders). */
  fields: ProductRiskField[];
  risk_data: Record<string, unknown>;
  risk_location: string | null;
  limit_of_liability: number | null;
  /** Schema the stored data was captured against, when different. */
  schema_snapshot: RiskFieldDefinition[];
  updated_at: string | null;
}

export interface QuotationDocumentView {
  id: string;
  title: string | null;
  document_type: string | null;
  file_name: string;
  status: string;
  uploaded_at: string;
}

function toDefinition(field: ProductRiskField): RiskFieldDefinition {
  return {
    field_key: field.field_key,
    label: field.label,
    data_type: field.data_type,
    is_required: field.is_required,
    options: field.options,
    validation_rules: field.validation_rules,
  };
}

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } })
      .driverError?.code === '23505'
  );
}

/**
 * Non-Motor risk schemas and risk data.
 *
 * Schemas are product configuration (per product, optionally per sub-class).
 * Risk data is stored per quotation alongside — not inside — the quotation
 * aggregate, so the existing quotation engine, pricing and TIRA payloads are
 * untouched. Finalizing a Non-Motor quotation through Underwrite requires
 * the data to satisfy the product schema.
 */
@Injectable()
export class NonMotorRiskService {
  constructor(
    @InjectRepository(ProductRiskField)
    private readonly fieldRepository: Repository<ProductRiskField>,
    @InjectRepository(QuotationNonMotorDetail)
    private readonly detailRepository: Repository<QuotationNonMotorDetail>,
    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,
    @InjectRepository(InsuranceSubClass)
    private readonly subClassRepository: Repository<InsuranceSubClass>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly productDefinitionService: ProductDefinitionService,
  ) {}

  // ─── Schema ──────────────────────────────────────────────────────────────

  async listFields(
    companyId: string,
    productId: string,
    subClassId?: string | null,
    includeInactive = false,
  ): Promise<ProductRiskField[]> {
    const query = this.fieldRepository
      .createQueryBuilder('field')
      .where('field.company_id = :companyId', { companyId })
      .andWhere('field.product_id = :productId', { productId })
      .andWhere('field.deleted_at IS NULL')
      .orderBy("COALESCE(field.section, '')", 'ASC')
      .addOrderBy('field.sort_order', 'ASC')
      .addOrderBy('field.label', 'ASC');

    if (subClassId) {
      query.andWhere(
        '(field.sub_class_id IS NULL OR field.sub_class_id = :subClassId)',
        { subClassId },
      );
    } else {
      query.andWhere('field.sub_class_id IS NULL');
    }
    if (!includeInactive) {
      query.andWhere('field.is_active = true');
    }

    return query.getMany();
  }

  async createField(user: AuthenticatedUser, dto: CreateRiskFieldDto) {
    const companyId = user.companyId!;
    await this.assertNonMotorProduct(companyId, dto.product_id);
    if (dto.sub_class_id) {
      await this.assertSubClass(dto.product_id, dto.sub_class_id);
    }
    this.assertFieldShape(dto.data_type, dto.options, dto.validation_rules);

    try {
      return await this.fieldRepository.save(
        this.fieldRepository.create({
          company_id: companyId,
          product_id: dto.product_id,
          sub_class_id: dto.sub_class_id ?? null,
          field_key: dto.field_key,
          label: dto.label.trim(),
          data_type: dto.data_type,
          section: dto.section?.trim() || null,
          options: OPTION_TYPES.has(dto.data_type) ? (dto.options ?? []) : null,
          is_required: dto.is_required ?? false,
          sort_order: dto.sort_order ?? 0,
          help_text: dto.help_text?.trim() || null,
          validation_rules: dto.validation_rules ?? null,
          is_active: dto.is_active ?? true,
          created_by: user.id,
          updated_by: user.id,
        }),
      );
    } catch (error) {
      if (isDuplicate(error)) {
        throw new ConflictException(
          `A risk field with key "${dto.field_key}" already exists for this product`,
        );
      }
      throw error;
    }
  }

  async updateField(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateRiskFieldDto,
  ) {
    const field = await this.findField(user.companyId!, id);
    const dataType = dto.data_type ?? field.data_type;
    const options = dto.options !== undefined ? dto.options : field.options;
    const rules =
      dto.validation_rules !== undefined
        ? dto.validation_rules
        : field.validation_rules;
    this.assertFieldShape(dataType, options, rules);

    Object.assign(field, {
      label: dto.label?.trim() ?? field.label,
      data_type: dataType,
      section:
        dto.section !== undefined ? dto.section?.trim() || null : field.section,
      options: OPTION_TYPES.has(dataType) ? (options ?? []) : null,
      is_required: dto.is_required ?? field.is_required,
      sort_order: dto.sort_order ?? field.sort_order,
      help_text:
        dto.help_text !== undefined
          ? dto.help_text?.trim() || null
          : field.help_text,
      validation_rules: rules ?? null,
      is_active: dto.is_active ?? field.is_active,
      updated_by: user.id,
    });
    return this.fieldRepository.save(field);
  }

  async removeField(user: AuthenticatedUser, id: string) {
    const field = await this.findField(user.companyId!, id);
    // Soft delete: quotations keep their schema snapshot either way.
    await this.fieldRepository.softDelete({ id: field.id });
    return { message: 'Risk field removed' };
  }

  // ─── Quotation risk data ─────────────────────────────────────────────────

  async getQuotationDetails(
    companyId: string,
    quotationId: string,
  ): Promise<QuotationRiskDetailsView> {
    const quotation = await this.requireNonMotorQuotation(
      companyId,
      quotationId,
    );
    const [fields, detail] = await Promise.all([
      this.listFields(companyId, quotation.product_id, quotation.sub_class_id),
      this.detailRepository.findOne({ where: { quotation_id: quotationId } }),
    ]);
    return this.toView(quotation, fields, detail);
  }

  async saveQuotationDetails(
    user: AuthenticatedUser,
    quotationId: string,
    dto: SaveRiskDetailsDto,
  ): Promise<QuotationRiskDetailsView> {
    const companyId = user.companyId!;
    const quotation = await this.requireNonMotorQuotation(
      companyId,
      quotationId,
    );
    const fields = await this.listFields(
      companyId,
      quotation.product_id,
      quotation.sub_class_id,
    );
    const { data, errors } = validateRiskData(
      fields.map(toDefinition),
      dto.risk_data,
      { enforceRequired: false },
    );
    this.throwIfInvalid(errors, 'NON_MOTOR_RISK_DETAILS_INVALID');

    const existing = await this.detailRepository.findOne({
      where: { quotation_id: quotationId },
    });
    const saved = await this.detailRepository.save(
      this.detailRepository.create({
        ...(existing ?? {}),
        company_id: companyId,
        quotation_id: quotationId,
        product_id: quotation.product_id,
        sub_class_id: quotation.sub_class_id,
        risk_data: data,
        schema_snapshot: fields.map(toDefinition),
        risk_location: dto.risk_location?.trim() || null,
        limit_of_liability:
          dto.limit_of_liability === null ||
          dto.limit_of_liability === undefined
            ? null
            : dto.limit_of_liability.toFixed(2),
        updated_by: user.id,
      }),
    );

    return this.toView(quotation, fields, saved);
  }

  /**
   * Finalize gate: the stored risk data must satisfy the schema of the
   * product being finalized (required fields included). Re-snapshots the
   * schema so the completed quotation records exactly what it was checked
   * against.
   */
  async assertCompleteForFinalize(
    companyId: string,
    quotationId: string,
    productId: string,
    subClassId?: string | null,
  ): Promise<void> {
    const fields = await this.listFields(companyId, productId, subClassId);
    if (!fields.length) return;

    const detail = await this.detailRepository.findOne({
      where: { quotation_id: quotationId },
    });
    const { data, errors } = validateRiskData(
      fields.map(toDefinition),
      detail?.risk_data ?? {},
      { enforceRequired: true },
    );
    this.throwIfInvalid(errors, 'NON_MOTOR_RISK_DETAILS_INCOMPLETE');

    if (detail) {
      await this.detailRepository.update(
        { id: detail.id },
        {
          risk_data: data,
          schema_snapshot: fields.map(toDefinition),
          product_id: productId,
          sub_class_id: subClassId ?? null,
        },
      );
    }
  }

  /**
   * Finalize gate: every mandatory quotation document of the product's
   * published definition (what the wizard's Documents step lists) must be
   * attached. Without a published definition there is nothing to check here;
   * pricing reports that on its own.
   */
  async assertDocumentsCompleteForFinalize(
    companyId: string,
    quotationId: string,
    productId: string,
    subClassId?: string | null,
  ): Promise<void> {
    let requirements: Array<{
      code: string;
      name: string;
      appliesTo: string;
      isMandatory: boolean;
    }>;
    // The definition effective on the quotation's cover start date, owned by
    // the insurer (as quotation pricing resolves it).
    const [quotation] = await this.dataSource.query<
      Array<{
        insurer_company_id: string | null;
        cover_note_start_date: Date | string | null;
      }>
    >(
      `SELECT quotation.insurer_company_id, cover_note.cover_note_start_date
         FROM quotations quotation
         LEFT JOIN quotation_cover_notes cover_note
           ON cover_note.quotation_id = quotation.id
        WHERE quotation.id = $1 AND quotation.company_id = $2`,
      [quotationId, companyId],
    );
    try {
      const definition =
        await this.productDefinitionService.resolvePublishedDefinition(
          quotation?.insurer_company_id ?? companyId,
          productId,
          subClassId ?? null,
          resolveEffectiveDate(quotation?.cover_note_start_date),
        );
      requirements = definition.documentRequirements;
    } catch (error) {
      if (isDefinitionUnavailable(error)) return;
      throw error;
    }

    const mandatory = requirements.filter(
      (item) => item.isMandatory && item.appliesTo === 'QUOTATION',
    );
    if (!mandatory.length) return;

    const attached = new Set(
      (
        await this.listQuotationDocuments(companyId, quotationId, {
          attachedOnly: true,
        })
      ).map((document) => document.document_type),
    );
    const missing = mandatory.filter((item) => !attached.has(item.code));
    if (!missing.length) return;

    throw new BadRequestException({
      code: 'NON_MOTOR_DOCUMENTS_INCOMPLETE',
      message: `Attach the mandatory documents before completing: ${missing
        .map((item) => item.name)
        .join(', ')}`,
      details: {
        missing: missing.map(({ code, name }) => ({ code, name })),
      },
    });
  }

  async getPolicyDetails(
    companyId: string,
    policyId: string,
  ): Promise<QuotationRiskDetailsView | null> {
    const [policy] = await this.dataSource.query<
      Array<{ quotation_id: string | null }>
    >(`SELECT quotation_id FROM policies WHERE id = $1 AND company_id = $2`, [
      policyId,
      companyId,
    ]);
    if (!policy?.quotation_id) return null;

    const quotation = await this.quotationRepository.findOne({
      where: { id: policy.quotation_id, company_id: companyId },
    });
    if (!quotation) return null;

    // What the policy was issued with; policies issued before the snapshot
    // existed fall back to the quotation's details.
    const [issued] = await this.dataSource.query<
      Array<
        Pick<
          QuotationNonMotorDetail,
          | 'risk_data'
          | 'schema_snapshot'
          | 'risk_location'
          | 'limit_of_liability'
          | 'created_at'
        >
      >
    >(
      `SELECT risk_data, schema_snapshot, risk_location, limit_of_liability,
              created_at
         FROM policy_non_motor_risk_details
        WHERE policy_id = $1 AND company_id = $2`,
      [policyId, companyId],
    );
    const detail: QuotationNonMotorDetail | null = issued
      ? ({
          ...issued,
          updated_at: new Date(issued.created_at),
        } as QuotationNonMotorDetail)
      : await this.detailRepository.findOne({
          where: { quotation_id: quotation.id },
        });
    // A policy shows what was quoted, so prefer the stored snapshot.
    const fields = detail?.schema_snapshot?.length
      ? []
      : await this.listFields(
          companyId,
          quotation.product_id,
          quotation.sub_class_id,
        );
    return this.toView(quotation, fields, detail);
  }

  /**
   * Documents attached to a quotation. Deleted documents are never listed;
   * `attachedOnly` further keeps only documents that count as attached
   * (uploaded, being scanned or available — not pending upload, quarantined,
   * rejected, superseded, revoked or archived).
   */
  async listQuotationDocuments(
    companyId: string,
    quotationId: string,
    { attachedOnly = false }: { attachedOnly?: boolean } = {},
  ): Promise<QuotationDocumentView[]> {
    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(
      `SELECT id, title, document_type, file_name, status, uploaded_at
         FROM documents
        WHERE company_id = $1
          AND owner_id = $2
          AND owner_type = ANY($3::text[])
          AND deleted_at IS NULL
          AND status <> $4
          AND ($5::text[] IS NULL OR status = ANY($5::text[]))
        ORDER BY uploaded_at DESC`,
      [
        companyId,
        quotationId,
        QUOTATION_DOCUMENT_OWNER_TYPES,
        DocumentStatus.DELETED,
        attachedOnly ? ATTACHED_DOCUMENT_STATUSES : null,
      ],
    );
    return rows.map((row) => ({
      id: String(row.id),
      title: row.title == null ? null : String(row.title),
      document_type:
        row.document_type == null ? null : String(row.document_type),
      file_name: String(row.file_name),
      status: String(row.status),
      uploaded_at: new Date(String(row.uploaded_at)).toISOString(),
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private toView(
    quotation: Pick<Quotation, 'id' | 'product_id' | 'sub_class_id'>,
    fields: ProductRiskField[],
    detail: QuotationNonMotorDetail | null,
  ): QuotationRiskDetailsView {
    return {
      quotation_id: quotation.id,
      product_id: quotation.product_id,
      sub_class_id: quotation.sub_class_id ?? null,
      fields,
      risk_data: detail?.risk_data ?? {},
      risk_location: detail?.risk_location ?? null,
      limit_of_liability:
        detail?.limit_of_liability == null
          ? null
          : Number(detail.limit_of_liability),
      schema_snapshot: detail?.schema_snapshot ?? [],
      updated_at: detail?.updated_at?.toISOString() ?? null,
    };
  }

  private throwIfInvalid(errors: RiskFieldError[], code: string) {
    if (!errors.length) return;
    throw new BadRequestException({
      code,
      message: errors[0].message,
      details: { errors },
    });
  }

  private async requireNonMotorQuotation(companyId: string, id: string) {
    const quotation = await this.quotationRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!quotation || quotation.quotation_flow !== QuotationFlow.NON_MOTOR) {
      throw new NotFoundException('Quotation not found');
    }
    return quotation;
  }

  private async findField(companyId: string, id: string) {
    const field = await this.fieldRepository.findOne({
      where: { id, company_id: companyId, deleted_at: IsNull() },
    });
    if (!field) throw new NotFoundException('Risk field not found');
    return field;
  }

  private async assertNonMotorProduct(companyId: string, productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, company_id: companyId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.business_line !== InsuranceBusinessLine.NON_MOTOR) {
      throw new BadRequestException(
        'Risk schemas are configured for non-motor products only',
      );
    }
  }

  private async assertSubClass(productId: string, subClassId: string) {
    const subClass = await this.subClassRepository.findOne({
      where: { id: subClassId, product_id: productId },
    });
    if (!subClass) {
      throw new BadRequestException('Sub-class does not belong to the product');
    }
  }

  private assertFieldShape(
    dataType: string,
    options: Array<{ value: string }> | null | undefined,
    rules: { pattern?: string } | null | undefined,
  ) {
    if (OPTION_TYPES.has(dataType)) {
      const values = (options ?? []).map((option) => option.value);
      if (!values.length) {
        throw new BadRequestException('Select fields need at least one option');
      }
      if (new Set(values).size !== values.length) {
        throw new BadRequestException('Option values must be unique');
      }
    }
    if (rules?.pattern) {
      try {
        new RegExp(rules.pattern);
      } catch {
        throw new BadRequestException(
          'Validation pattern is not a valid regular expression',
        );
      }
    }
  }
}
