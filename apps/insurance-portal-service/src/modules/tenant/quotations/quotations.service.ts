import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  DataSource,
  EntityManager,
  Brackets,
  In,
  QueryFailedError,
} from 'typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { TiramisRequestType } from '../../tiramis/enums/tiramis-request-type.enum';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { Branch } from '../branches/entities/branch.entity';
import { CustomerKycStatus } from '../customers/enums/customer-kyc-status.enum';
import { CustomerGender } from '../customers/enums/customer-gender.enum';
import { CustomerPolicyHolderType } from '../customers/enums/customer-policy-holder-type.enum';
import { CustomerType } from '../customers/enums/customer-type.enum';
import { CustomerStatus } from '../customers/enums/customer-status.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceBusinessLine } from '../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import {
  CoverNoteAddonDto,
  CreateQuotationDto,
  MotorDetailDto,
  PolicyHolderDto,
  RiskCoveredDto,
  SubjectMatterCoveredDto,
  UpdateQuotationDto,
  SubmitQuotationDto,
} from './dto/quotation-payload.dto';
import { FilterQuotationDto } from './dto/filter-quotation.dto';
import { TransitionQuotationStatusDto } from './dto/transition-quotation-status.dto';
import { Quotation } from './entities/quotation.entity';
import { QuotationStatusHistory } from './entities/quotation-status-history.entity';
import { QuotationCoverNoteEntry } from './entities/structured/quotation-cover-note-entry.entity';
import { QuotationCoverNote } from './entities/structured/quotation-cover-note.entity';
import { QuotationEntryAddonTax } from './entities/structured/quotation-entry-addon-tax.entity';
import { QuotationEntryAddon } from './entities/structured/quotation-entry-addon.entity';
import { QuotationEntryRisk } from './entities/structured/quotation-entry-risk.entity';
import { QuotationMotorDetail } from './entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from './entities/structured/quotation-policy-holder.entity';
import { QuotationRiskDiscount } from './entities/structured/quotation-risk-discount.entity';
import { QuotationRiskTax } from './entities/structured/quotation-risk-tax.entity';
import { QuotationSubjectMatter } from './entities/structured/quotation-subject-matter.entity';
import { QuotationEntryType } from './enums/quotation-entry-type.enum';
import { QuotationFlow } from './enums/quotation-flow.enum';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from './enums/quotation-status-transition-action.enum';
import { QuotationType } from './enums/quotation-type.enum';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationPreviewMapper } from './mappers/quotation-preview.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { parseTiramisDateTime } from './utils/tiramis-date.util';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { PaymentTransaction } from '../billing-commission/entities/payment-transaction.entity';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionEvent } from '../tiramis-integration/entities/portal-tira-submission-event.entity';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import {
  assertQuotationStatusTransition,
  EDITABLE_QUOTATION_STATUSES,
  TERMINAL_QUOTATION_STATUSES,
} from './utils/quotation-status-transition.util';

type NumericValue = number | string | null | undefined;

interface ScopeValidationResult {
  product: InsuranceProduct;
  customerId: string | null;
  riskByCode: Map<string, InsuranceRisk>;
}

interface ResolvedHeader {
  sale_point_code: string;
  cover_note_start_date: string;
  cover_note_end_date: string;
  payment_mode: number;
  currency_code: string;
  exchange_rate: number;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  commision_paid: number;
  commision_rate: number;
  officer_name: string;
  officer_title: string;
  product_code: string;
  policy_holders: PolicyHolderDto[];
  fleet_id?: string;
  fleet_type?: number;
  fleet_size?: number;
  comprehensive_insured?: number;
}

interface ResolvedEntry {
  fleet_entry: number;
  cover_note_number: string;
  prev_cover_note_reference_number: string | null;
  cover_note_desc: string;
  operative_clause: string;
  endorsement_type: number | null;
  endorsement_reason: string | null;
  endorsement_premium_earned: number | null;
  risks_covered: RiskCoveredDto[];
  subject_matters_covered: SubjectMatterCoveredDto[];
  cover_note_addons: CoverNoteAddonDto[];
  motor_dtl?: MotorDetailDto;
}

interface PostgreSqlDriverError {
  code?: string;
  constraint?: string;
  detail?: string;
}

const DIRECT_PAYMENT_MODE = 1;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly quotationsRepository: QuotationsRepository,
    private readonly payloadMapper: QuotationPayloadMapper,
    private readonly previewMapper: QuotationPreviewMapper,
    private readonly tiramisPayloadMapper: QuotationTiramisPayloadMapper,
    private readonly payloadValidator: QuotationPayloadValidator,
    private readonly tiramisBusinessSubmitService: TiramisBusinessSubmitService,
    private readonly tiramisSubmissionTrackingRepository: TiramisSubmissionTrackingRepository,
    private readonly identifierGeneratorService: IdentifierGeneratorService,
  ) {}

  async create(companyId: string, payload: CreateQuotationDto, userId: string) {
    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      payload,
    );

    this.payloadValidator.assertValid(preparedPayload);

    const scope = await this.validateScope(companyId, preparedPayload);

    try {
      const quotationId = await this.dataSource.transaction(async (manager) => {
        const customerId = await this.resolveOrCreateCustomerId(
          manager,
          companyId,
          payload,
          scope.customerId,
          userId,
        );

        const quotationNo = await this.identifierGeneratorService.generateQuotationNumber(
          companyId,
          manager,
        );

        const quotation = await this.persistRoot(
          manager,
          companyId,
          quotationNo,
          preparedPayload,
          userId,
          customerId,
          null,
        );

        await this.persistAggregate(
          manager,
          quotation,
          preparedPayload,
          scope.riskByCode,
          customerId,
          userId,
        );

        return quotation.id;
      });

      return this.findOne(companyId, quotationId);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async replace(
    companyId: string,
    id: string,
    payload: UpdateQuotationDto,
    userId: string,
  ) {
    const existing = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    this.assertQuotationEditable(existing);

    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      payload,
      existing,
    );

    this.payloadValidator.assertValid(preparedPayload);
    const scope = await this.validateScope(companyId, preparedPayload);

    try {
      await this.dataSource.transaction(async (manager) => {
        const lockedQuotation = await this.lockQuotationForUpdate(
          manager,
          companyId,
          id,
        );

        this.assertQuotationEditable(lockedQuotation);

        if (
          payload.expected_updated_at &&
          lockedQuotation.updated_at.toISOString() !== payload.expected_updated_at
        ) {
          throw new ConflictException(
            'This quotation was updated by another user. Reload the latest version before saving your changes.',
          );
        }

        const previousStatus = lockedQuotation.status;
          const customerId = await this.resolveOrCreateCustomerId(
          manager,
          companyId,
          preparedPayload,
          scope.customerId,
          userId,
        );

        await manager.getRepository(QuotationCoverNote).delete({
          quotation_id: id,
        });

        await manager.getRepository(QuotationPolicyHolder).delete({
          quotation_id: id,
        });

        const quotation = await this.persistRoot(
          manager,
          companyId,
          lockedQuotation.quotation_no,
          preparedPayload,
          userId,
          customerId,
          lockedQuotation,
        );

        await this.persistAggregate(
          manager,
          quotation,
          preparedPayload,
          scope.riskByCode,
          customerId,
          userId,
        );

        if (previousStatus !== QuotationStatus.DRAFT) {
          await this.recordQuotationStatusHistory(manager, {
            quotationId: quotation.id,
            previousStatus,
            nextStatus: QuotationStatus.DRAFT,
            reason: 'Quotation payload was replaced',
            changedBy: userId,
          });
        }
      });

      return this.findOne(companyId, id);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async findAll(companyId: string, query: FilterQuotationDto) {
    const result = await this.quotationsRepository.findAll(companyId, query);

    return {
      items: result.items.map((quotation) =>
        this.payloadMapper.toListItem(quotation),
      ),
      meta: result.meta,
    };
  }

  async findOne(companyId: string, id: string) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    return this.payloadMapper.toResponse(quotation);
  }

  async getAuthoritativePayload(companyId: string, id: string) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    return this.payloadMapper.toAuthoritativePayload(quotation);
  }

  async getPreview(companyId: string, id: string) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    const [
      invoice,
      receipt,
      paymentTransaction,
      portalSubmission,
      tiramisTracking,
      tiramisTrackingByEntry,
    ] =
      await Promise.all([
        this.findLatestInvoice(companyId, quotation.id),
        this.findLatestReceipt(companyId, quotation.id),
        this.findLatestPaymentTransaction(companyId, quotation.id),
        this.findLatestPortalSubmission(companyId, quotation.id),
        this.findLatestTiramisTracking(companyId, quotation),
        this.findTiramisTrackingByEntry(companyId, quotation),
      ]);

    return this.previewMapper.toResponse(quotation, {
      invoice,
      receipt,
      paymentTransaction,
      portalSubmission,
      portalSubmissionEvents: portalSubmission?.events ?? [],
      tiramisTracking,
      tiramisTrackingByEntry,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    if (quotation.submitted_at) {
      throw new ConflictException('A submitted quotation cannot be deleted');
    }

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new ConflictException('Only draft quotations can be deleted');
    }

    const result = await this.dataSource.getRepository(Quotation).softDelete({
      id,
      company_id: companyId,
    });

    if (!result.affected) {
      throw new NotFoundException('Quotation not found');
    }
  }

  async submit(
    companyId: string,
    id: string,
    dto: SubmitQuotationDto | undefined,
    user: AuthenticatedUser,
  ) {
    const submitOptions = dto ?? {};

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    if (TERMINAL_QUOTATION_STATUSES.includes(quotation.status)) {
      throw new ConflictException(
        `Quotation in ${quotation.status} status cannot be submitted`,
      );
    }

    if (
      quotation.submitted_at &&
      !submitOptions.force_resubmit &&
      !submitOptions.return_existing
    ) {
      throw new ConflictException(
        'Quotation has already been submitted. Use return_existing to return the existing submission or force_resubmit to send it again.',
      );
    }

    const payload = this.payloadMapper.toAuthoritativePayload(quotation);
    this.payloadValidator.assertValid(payload);
    const tiramisPayload = this.tiramisPayloadMapper.toTiramisPayload(payload);
    await this.assertPaymentReady(quotation);

    const requestType = this.toTiramisRequestType(quotation.quotation_flow);

    const result =
      await this.tiramisBusinessSubmitService.submitAnyBusinessRecord({
        requestType,
        sourceModule: 'quotations',
        sourceRecordId: quotation.id,
        businessReference: this.payloadMapper.businessReference(quotation),
        payload: tiramisPayload as Record<string, unknown>,
        forceResubmit: submitOptions.force_resubmit,
        returnExisting: submitOptions.return_existing,
        authContext: {
          ...user,
          userId: user.id,
          companyId,
          branchId:
            quotation.branch_id ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).branchId ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).activeBranchId ??
            null,
          activeBranchId:
            quotation.branch_id ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).branchId ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).activeBranchId ??
            null,
        },
      });

    const submittedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      const lockedQuotation = await this.lockQuotationForUpdate(
        manager,
        companyId,
        quotation.id,
      );

      const shouldSetSubmittedAt =
        !lockedQuotation.submitted_at || submitOptions.force_resubmit;
      let nextStatus = lockedQuotation.status;

      if (
        lockedQuotation.status !== QuotationStatus.APPROVED &&
        lockedQuotation.status !== QuotationStatus.PENDING_APPROVAL
      ) {
        nextStatus = assertQuotationStatusTransition({
          currentStatus: lockedQuotation.status,
          action: QuotationStatusTransitionAction.REQUEST_APPROVAL,
          reason: 'Quotation submitted to TIRAMIS',
        });
      }

      await this.applyQuotationStatusUpdate(manager, lockedQuotation, {
        nextStatus,
        reason:
          lockedQuotation.status === nextStatus
            ? 'Quotation resubmitted to TIRAMIS'
            : 'Quotation submitted to TIRAMIS',
        changedBy: user.id,
        submittedBy: user.id,
        submittedAt: shouldSetSubmittedAt
          ? submittedAt
          : lockedQuotation.submitted_at,
      });
    });

    return {
      quotation_id: quotation.id,
      quotation_no: quotation.quotation_no,
      request_type: requestType,
      submitted_at: submittedAt.toISOString(),
      submission: result,
    };
  }

  async transitionStatus(
    companyId: string,
    id: string,
    dto: TransitionQuotationStatusDto,
    userId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const lockedQuotation = await this.lockQuotationForUpdate(
        manager,
        companyId,
        id,
      );

      const nextStatus = assertQuotationStatusTransition({
        currentStatus: lockedQuotation.status,
        action: dto.action,
        reason: dto.reason,
      });

      await this.applyQuotationStatusUpdate(manager, lockedQuotation, {
        nextStatus,
        reason:
          dto.reason?.trim() ||
          this.defaultTransitionReason(dto.action, nextStatus),
        changedBy: userId,
      });
    });

    return this.findOne(companyId, id);
  }

  private async validateScope(
    companyId: string,
    payload: CreateQuotationDto,
  ): Promise<ScopeValidationResult> {
    const internal = payload.internal_quotation;
    const header = this.resolveHeader(payload);

    const companyRepository = this.dataSource.getRepository(Company);
    const branchRepository = this.dataSource.getRepository(Branch);
    const departmentRepository = this.dataSource.getRepository(Department);
    const categoryRepository = this.dataSource.getRepository(InsuranceCategory);
    const productRepository = this.dataSource.getRepository(InsuranceProduct);
    const subClassRepository = this.dataSource.getRepository(InsuranceSubClass);
    const riskRepository = this.dataSource.getRepository(InsuranceRisk);

    const [tenantCompany, insurerCompany, category, product] =
      await Promise.all([
        companyRepository.findOne({ where: { id: companyId } }),
        companyRepository.findOne({
          where: { id: internal.insurer_company_id },
        }),
        categoryRepository.findOne({
          where: {
            id: internal.category_id,
            company_id: internal.insurer_company_id,
          },
        }),
        productRepository.findOne({
          where: {
            id: internal.product_id,
            company_id: internal.insurer_company_id,
          },
        }),
      ]);

    if (!tenantCompany) {
      throw new BadRequestException('Current company was not found');
    }

    if (tenantCompany.status !== 'active') {
      throw new BadRequestException('Current company is not active');
    }

    if (!insurerCompany) {
      throw new BadRequestException('Insurer company was not found');
    }

    if (insurerCompany.status !== 'active') {
      throw new BadRequestException('Insurer company is not active');
    }

    if (!category) {
      throw new BadRequestException(
        'Insurance category was not found for the selected insurer',
      );
    }

    if (!category.is_active) {
      throw new BadRequestException('Selected insurance category is inactive');
    }

    if (!product) {
      throw new BadRequestException(
        'Insurance product was not found for the selected insurer',
      );
    }

    if (!product.is_active) {
      throw new BadRequestException('Selected insurance product is inactive');
    }

    if (product.category_id !== category.id) {
      throw new BadRequestException(
        'Selected product does not belong to the selected category',
      );
    }

    const expectedBusinessLine =
      internal.quotation_flow === QuotationFlow.NON_MOTOR
        ? InsuranceBusinessLine.NON_MOTOR
        : InsuranceBusinessLine.MOTOR;

    if (
      category.business_line !== expectedBusinessLine ||
      product.business_line !== expectedBusinessLine
    ) {
      throw new BadRequestException(
        `Category and product must support ${expectedBusinessLine}`,
      );
    }

    if (
      internal.quotation_flow === QuotationFlow.MOTOR_FLEET &&
      !product.supports_fleet
    ) {
      throw new BadRequestException(
        'Selected product does not support motor fleet quotations',
      );
    }

    if (
      product.tiramis_product_code &&
      this.normalizeUppercase(product.tiramis_product_code) !==
        this.normalizeUppercase(header.product_code)
    ) {
      throw new BadRequestException(
        `cover note product_code must be ${product.tiramis_product_code}`,
      );
    }

    if (internal.intermediary_company_id) {
      const intermediary = await companyRepository.findOne({
        where: {
          id: internal.intermediary_company_id,
        },
      });

      if (!intermediary) {
        throw new BadRequestException('Intermediary company was not found');
      }

      if (intermediary.status !== 'active') {
        throw new BadRequestException('Intermediary company is not active');
      }
    }

    if (internal.branch_id) {
      const branch = await branchRepository.findOne({
        where: {
          id: internal.branch_id,
          company_id: companyId,
        },
      });

      if (!branch) {
        throw new BadRequestException(
          'Branch was not found for the current company',
        );
      }

      if (branch.status !== 'active') {
        throw new BadRequestException('Selected branch is inactive');
      }

      if (
        branch.sale_point_code &&
        this.normalizeUppercase(branch.sale_point_code) !==
          this.normalizeUppercase(header.sale_point_code)
      ) {
        throw new BadRequestException(
          `cover note sale_point_code must be ${branch.sale_point_code} for the selected branch`,
        );
      }
    }

    if (internal.department_id) {
      const department = await departmentRepository.findOne({
        where: {
          id: internal.department_id,
          company_id: companyId,
        },
      });

      if (!department) {
        throw new BadRequestException(
          'Department was not found for the current company',
        );
      }

      if (department.status !== 'active') {
        throw new BadRequestException('Selected department is inactive');
      }

      if (
        internal.branch_id &&
        department.branch_id &&
        department.branch_id !== internal.branch_id
      ) {
        throw new BadRequestException(
          'Selected department does not belong to the selected branch',
        );
      }
    }

    let selectedSubClass: InsuranceSubClass | null = null;

    if (internal.sub_class_id) {
      selectedSubClass = await subClassRepository.findOne({
        where: {
          id: internal.sub_class_id,
          company_id: internal.insurer_company_id,
          product_id: internal.product_id,
        },
      });

      if (!selectedSubClass) {
        throw new BadRequestException(
          'Sub-class was not found for the selected product',
        );
      }

      if (!selectedSubClass.is_active) {
        throw new BadRequestException('Selected sub-class is inactive');
      }
    }

    const requestedRiskCodes = Array.from(
      new Set(this.collectRiskCodes(payload)),
    );
    const risks =
      requestedRiskCodes.length > 0
        ? await riskRepository.find({
            where: {
              company_id: internal.insurer_company_id,
              product_id: internal.product_id,
              risk_code: In(requestedRiskCodes),
              is_active: true,
            },
          })
        : [];

    const riskByCode = new Map<string, InsuranceRisk>();
    risks.forEach((risk) => {
      riskByCode.set(this.normalizeUppercase(risk.risk_code), risk);
    });

    const missingRiskCodes = requestedRiskCodes.filter(
      (riskCode) => !riskByCode.has(riskCode),
    );

    if (missingRiskCodes.length > 0) {
      throw new BadRequestException(
        'The following risk codes are not configured for the selected product: ' +
          missingRiskCodes.join(', '),
      );
    }

    for (const risk of risks) {
      if (
        selectedSubClass &&
        risk.sub_class_id &&
        risk.sub_class_id !== selectedSubClass.id
      ) {
        throw new BadRequestException(
          `Risk ${risk.risk_code} does not belong to the selected sub-class`,
        );
      }

      if (!selectedSubClass && risk.sub_class_id) {
        throw new BadRequestException(
          `Risk ${risk.risk_code} requires a sub_class_id`,
        );
      }
    }

    const primaryPolicyHolder = header.policy_holders[0];
    const customerId = primaryPolicyHolder
      ? await this.resolveExistingCustomerId(companyId, primaryPolicyHolder)
      : null;

    return {
      product,
      customerId,
      riskByCode,
    };
  }

  private async resolveExistingCustomerId(
    companyId: string,
    holder: PolicyHolderDto,
  ): Promise<string | null> {
    const identityNumber = holder.policy_holder_id_number.trim().toUpperCase();

    const customer = await this.dataSource
      .getRepository(Customer)
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.deleted_at IS NULL')
      .andWhere('customer.id_type = :idType', {
        idType: holder.policy_holder_id_type,
      })
      .andWhere('UPPER(TRIM(customer.id_number)) = :identityNumber', {
        identityNumber,
      })
      .getOne();

    return customer?.id ?? null;
  }

  private async resolveOrCreateCustomerId(
    manager: EntityManager,
    companyId: string,
    payload: CreateQuotationDto,
    existingCustomerId: string | null,
    userId: string,
  ): Promise<string | null> {
    if (existingCustomerId) {
      return existingCustomerId;
    }

    const holder =
      payload.cover_note_dtl.policy_holders?.[0] ??
      payload.cover_note_dtl.fleet_hdr?.policy_holders?.[0] ??
      null;

    if (!holder) {
      return null;
    }

    const customerType =
      holder.policy_holder_type === 1
        ? CustomerType.INDIVIDUAL
        : CustomerType.CORPORATE;
    const customerRepository = manager.getRepository(Customer);
    const customerNo = await this.generateCustomerNo(manager, companyId);
    const nameParts = holder.policy_holder_name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const customer = customerRepository.create({
      company_id: companyId,
      customer_no: customerNo,
      customer_type: customerType,
      first_name:
        customerType === CustomerType.INDIVIDUAL
          ? (nameParts[0] ?? holder.policy_holder_name.trim())
          : null,
      middle_name:
        customerType === CustomerType.INDIVIDUAL && nameParts.length > 2
          ? nameParts.slice(1, -1).join(' ')
          : null,
      last_name:
        customerType === CustomerType.INDIVIDUAL
          ? nameParts.length > 1
            ? nameParts[nameParts.length - 1]
            : holder.policy_holder_name.trim()
          : null,
      gender:
        customerType === CustomerType.INDIVIDUAL
          ? (holder.gender as CustomerGender | null)
          : null,
      date_of_birth: holder.policy_holder_birth_date ?? null,
      nationality: null,
      company_name:
        customerType === CustomerType.CORPORATE
          ? holder.policy_holder_name.trim()
          : null,
      registration_no: null,
      incorporation_certificate_no: null,
      tin:
        holder.policy_holder_id_type === 6
          ? holder.policy_holder_id_number.trim()
          : null,
      vrn: null,
      policy_holder_type:
        holder.policy_holder_type === 1
          ? CustomerPolicyHolderType.INDIVIDUAL
          : CustomerPolicyHolderType.CORPORATE,
      id_type: holder.policy_holder_id_type,
      id_number: holder.policy_holder_id_number.trim().toUpperCase(),
      nida_no: null,
      voter_no: null,
      passport_no: null,
      driving_license_no: null,
      zanid_no: null,
      phone: holder.policy_holder_phone_number.trim(),
      alternate_phone: null,
      fax: holder.policy_holder_fax?.trim() ?? null,
      email: holder.email_address?.trim().toLowerCase() ?? null,
      country: null,
      country_code: holder.country_code.trim().toUpperCase(),
      region: holder.region.trim(),
      district: holder.district.trim(),
      ward: null,
      street: holder.street?.trim() ?? null,
      postal_address: holder.postal_address?.trim() ?? null,
      latitude: null,
      longitude: null,
      contact_name: null,
      contact_role: null,
      contact_phone: null,
      contact_email: null,
      kyc_status: CustomerKycStatus.PENDING,
      document_type: null,
      document_no: null,
      document_file_name: null,
      document_file_url: null,
      document_mime_type: null,
      document_verified: false,
      document_verified_by: null,
      document_verified_at: null,
      status: CustomerStatus.ACTIVE,
      metadata: {
        source: 'quotation',
        quotation_flow: payload.internal_quotation.quotation_flow,
      },
      created_by: userId,
      updated_by: userId,
    });

    const savedCustomer = await customerRepository.save(customer);
    return savedCustomer.id;
  }

  private async persistRoot(
    manager: EntityManager,
    companyId: string,
    quotationNumber: string,
    payload: CreateQuotationDto,
    userId: string,
    customerId: string | null,
    current: Quotation | null,
  ): Promise<Quotation> {
    const internal = payload.internal_quotation;
    const repository = manager.getRepository(Quotation);
    const quotation = current ?? repository.create();

    Object.assign(quotation, {
      company_id: companyId,
      insurer_company_id: internal.insurer_company_id,
      intermediary_company_id: internal.intermediary_company_id ?? null,
      branch_id: internal.branch_id ?? null,
      department_id: internal.department_id ?? null,
      created_by: current?.created_by ?? userId,
      updated_by: userId,
      customer_id: customerId,
      category_id: internal.category_id,
      product_id: internal.product_id,
      sub_class_id: internal.sub_class_id ?? null,
      quotation_no: quotationNumber,
      quotation_type: internal.quotation_type,
      quotation_flow: internal.quotation_flow,
      is_fleet: internal.is_fleet,
      channel_type: internal.channel_type,
      status: QuotationStatus.DRAFT,
      rejection_reason: null,
      submitted_by: current?.submitted_by ?? null,
      submitted_at: current?.submitted_at ?? null,
    });

    return repository.save(quotation);
  }

  private async persistAggregate(
    manager: EntityManager,
    quotation: Quotation,
    payload: CreateQuotationDto,
    riskByCode: Map<string, InsuranceRisk>,
    customerId: string | null,
    userId: string,
  ): Promise<void> {
    const header = this.resolveHeader(payload);
    const fleetHeader = payload.cover_note_dtl.fleet_hdr;
    const coverNoteRepository = manager.getRepository(QuotationCoverNote);

    const coverNote = await coverNoteRepository.save(
      coverNoteRepository.create({
        quotation_id: quotation.id,
        cover_note_type: payload.cover_note_hdr.cover_note_type,
        sale_point_code: header.sale_point_code.trim().toUpperCase(),
        cover_note_start_date: parseTiramisDateTime(
          header.cover_note_start_date,
        ),
        cover_note_end_date: parseTiramisDateTime(header.cover_note_end_date),
        payment_mode: header.payment_mode,
        currency_code: header.currency_code.trim().toUpperCase(),
        exchange_rate: this.numeric(header.exchange_rate, 6),
        total_premium_excluding_tax: this.numeric(
          header.total_premium_excluding_tax,
          2,
        ),
        total_premium_including_tax: this.numeric(
          header.total_premium_including_tax,
          2,
        ),
        commission_paid: this.numeric(header.commision_paid, 2),
        commission_rate: this.numeric(header.commision_rate, 6),
        officer_name: header.officer_name.trim(),
        officer_title: header.officer_title.trim(),
        product_code: header.product_code.trim().toUpperCase(),
        fleet_id: fleetHeader?.fleet_id?.trim().toUpperCase() ?? null,
        fleet_type: fleetHeader?.fleet_type ?? null,
        fleet_size: fleetHeader?.fleet_size ?? null,
        comprehensive_insured: fleetHeader?.comprehensive_insured ?? null,
      }),
    );

    await this.persistPolicyHolders(
      manager,
      quotation.id,
      header.policy_holders,
      customerId,
    );

    const entries = this.resolveEntries(payload);

    for (let index = 0; index < entries.length; index += 1) {
      const input = entries[index];
      const entryRepository = manager.getRepository(QuotationCoverNoteEntry);

      const entry = await entryRepository.save(
        entryRepository.create({
          cover_note_id: coverNote.id,
          entry_type: quotation.is_fleet
            ? QuotationEntryType.FLEET_ITEM
            : QuotationEntryType.STANDARD,
          entry_number: index + 1,
          fleet_entry: quotation.is_fleet ? input.fleet_entry : null,
          cover_note_number: input.cover_note_number.trim().toUpperCase(),
          prev_cover_note_reference_number:
            input.prev_cover_note_reference_number?.trim().toUpperCase() ??
            null,
          cover_note_desc: input.cover_note_desc.trim(),
          operative_clause: input.operative_clause.trim(),
          endorsement_type: input.endorsement_type ?? null,
          endorsement_reason: input.endorsement_reason?.trim() ?? null,
          endorsement_premium_earned:
            input.endorsement_premium_earned === null ||
            input.endorsement_premium_earned === undefined
              ? null
              : this.numeric(input.endorsement_premium_earned, 2),
        }),
      );

      await this.persistEntryChildren(
        manager,
        entry,
        input,
        riskByCode,
        customerId,
        quotation,
        userId,
        header.currency_code,
      );
    }
  }

  private async persistPolicyHolders(
    manager: EntityManager,
    quotationId: string,
    holders: PolicyHolderDto[],
    customerId: string | null,
  ): Promise<void> {
    const repository = manager.getRepository(QuotationPolicyHolder);
    const entities = holders.map((holder, index) =>
      repository.create({
        quotation_id: quotationId,
        customer_id: index === 0 ? customerId : null,
        sequence_no: index + 1,
        policy_holder_name: holder.policy_holder_name.trim(),
        policy_holder_birth_date: holder.policy_holder_birth_date,
        policy_holder_type: holder.policy_holder_type,
        policy_holder_id_number: holder.policy_holder_id_number
          .trim()
          .toUpperCase(),
        policy_holder_id_type: holder.policy_holder_id_type,
        gender: holder.gender ?? null,
        country_code: holder.country_code.trim().toUpperCase(),
        region: holder.region.trim(),
        district: holder.district.trim(),
        street: holder.street?.trim() ?? null,
        policy_holder_phone_number: holder.policy_holder_phone_number.trim(),
        policy_holder_fax: holder.policy_holder_fax?.trim() ?? null,
        postal_address: holder.postal_address?.trim() ?? null,
        email_address: holder.email_address?.trim().toLowerCase() ?? null,
      }),
    );

    if (entities.length > 0) {
      await repository.save(entities);
    }
  }

  private async persistEntryChildren(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
    riskByCode: Map<string, InsuranceRisk>,
    customerId: string | null,
    quotation: Quotation,
    userId: string,
    currencyCode: string,
  ): Promise<void> {
    await this.persistEntryRisks(manager, entry, input, riskByCode);
    await this.persistSubjectMatters(manager, entry, input);
    await this.persistAddons(manager, entry, input);

    if (input.motor_dtl) {
      const motorRepository = manager.getRepository(QuotationMotorDetail);

      await motorRepository.save(
        motorRepository.create({
          entry_id: entry.id,
          ...this.mapMotorForPersistence(input.motor_dtl),
        }),
      );

      if (customerId) {
        await this.persistMotorVehicle(
          manager,
          quotation,
          customerId,
          input.motor_dtl,
          userId,
          currencyCode,
        );
      }
    }
  }

  private async persistMotorVehicle(
    manager: EntityManager,
    quotation: Quotation,
    customerId: string,
    motor: MotorDetailDto,
    userId: string,
    currencyCode: string,
  ): Promise<void> {
    const repository = manager.getRepository(MotorVehicle);
    const registrationNumber = this.normalizeUppercase(
      motor.registration_number,
    );
    const chassisNumber = this.normalizeUppercase(motor.chassis_number);
    const engineNumber = this.normalizeUppercase(motor.engine_number);

    const existingVehicle = await repository
      .createQueryBuilder('vehicle')
      .where('vehicle.company_id = :companyId', {
        companyId: quotation.company_id,
      })
      .andWhere('vehicle.customer_id = :customerId', { customerId })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'UPPER(TRIM(vehicle.registration_no)) = :registrationNumber',
            {
              registrationNumber,
            },
          );
          qb.orWhere('UPPER(TRIM(vehicle.chassis_no)) = :chassisNumber', {
            chassisNumber,
          });
          qb.orWhere('UPPER(TRIM(vehicle.engine_no)) = :engineNumber', {
            engineNumber,
          });
        }),
      )
      .getOne();

    const vehicle = existingVehicle ?? repository.create();

    Object.assign(vehicle, {
      company_id: quotation.company_id,
      customer_id: customerId,
      registration_no: registrationNumber,
      chassis_no: chassisNumber,
      engine_no: engineNumber,
      make: motor.make.trim(),
      model: motor.model.trim(),
      body_type: motor.body_type.trim(),
      color: motor.color.trim(),
      manufacture_year: motor.year_of_manufacture,
      usage_type: motor.fuel_used.trim(),
      seating_capacity: motor.sitting_capacity,
      cubic_capacity: Number.isFinite(Number(motor.engine_capacity))
        ? Number(motor.engine_capacity)
        : null,
      fuel_type: motor.fuel_used.trim(),
      model_no: motor.model_number?.trim() ?? null,
      number_of_axles: motor.number_of_axles,
      axle_distance: this.numeric(motor.axle_distance, 2),
      tare_weight: this.numeric(motor.tare_weight, 2),
      gross_weight: this.numeric(motor.gross_weight, 2),
      motor_category: motor.motor_category,
      motor_type: motor.motor_type,
      motor_usage: motor.motor_usage,
      owner_name: motor.owner_name.trim(),
      owner_category: motor.owner_category,
      owner_address: motor.owner_address.trim(),
      vehicle_value: '0',
      currency: currencyCode.trim().toUpperCase(),
      status: 'ACTIVE',
      metadata: {
        source: 'quotation',
        quotation_id: quotation.id,
        quotation_no: quotation.quotation_no,
        quotation_flow: quotation.quotation_flow,
      },
      created_by: existingVehicle?.created_by ?? userId,
      updated_by: userId,
    });

    await repository.save(vehicle);
  }

  private async generateCustomerNo(
    manager: EntityManager,
    companyId: string,
  ): Promise<string> {
    const year = this.getEastAfricaYear();
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

  private async persistEntryRisks(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
    riskByCode: Map<string, InsuranceRisk>,
  ): Promise<void> {
    const riskRepository = manager.getRepository(QuotationEntryRisk);
    const discountRepository = manager.getRepository(QuotationRiskDiscount);
    const taxRepository = manager.getRepository(QuotationRiskTax);

    for (
      let riskIndex = 0;
      riskIndex < input.risks_covered.length;
      riskIndex += 1
    ) {
      const inputRisk = input.risks_covered[riskIndex];
      const normalizedRiskCode = this.normalizeUppercase(inputRisk.risk_code);
      const configuredRisk = riskByCode.get(normalizedRiskCode);

      const risk = await riskRepository.save(
        riskRepository.create({
          entry_id: entry.id,
          insurance_risk_id: configuredRisk?.id ?? null,
          sequence_no: riskIndex + 1,
          risk_code: normalizedRiskCode,
          sum_insured: this.numeric(inputRisk.sum_insured, 2),
          sum_insured_equivalent: this.numeric(
            inputRisk.sum_insured_equivalent,
            2,
          ),
          premium_rate: this.numeric(inputRisk.premium_rate, 6),
          premium_before_discount: this.numeric(
            inputRisk.premium_before_discount,
            2,
          ),
          premium_after_discount: this.numeric(
            inputRisk.premium_after_discount,
            2,
          ),
          premium_excluding_tax_equivalent: this.numeric(
            inputRisk.premium_excluding_tax_equivalent,
            2,
          ),
          premium_including_tax: this.numeric(
            inputRisk.premium_including_tax,
            2,
          ),
        }),
      );

      const discounts = inputRisk.discounts_offered.map((discount, index) =>
        discountRepository.create({
          risk_id: risk.id,
          sequence_no: index + 1,
          discount_type: discount.discount_type,
          discount_rate: this.numeric(discount.discount_rate, 6),
          discount_amount: this.numeric(discount.discount_amount, 2),
        }),
      );

      if (discounts.length > 0) {
        await discountRepository.save(discounts);
      }

      const taxes = inputRisk.taxes_charged.map((tax, index) =>
        taxRepository.create({
          risk_id: risk.id,
          sequence_no: index + 1,
          tax_code: tax.tax_code.trim().toUpperCase(),
          is_tax_exempted: tax.is_tax_exempted,
          tax_exemption_type: tax.tax_exemption_type?.trim() ?? null,
          tax_exemption_reference: tax.tax_exemption_reference?.trim() ?? null,
          tax_rate: this.numeric(tax.tax_rate, 6),
          tax_amount: this.numeric(tax.tax_amount, 2),
        }),
      );

      if (taxes.length > 0) {
        await taxRepository.save(taxes);
      }
    }
  }

  private async persistSubjectMatters(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
  ): Promise<void> {
    const repository = manager.getRepository(QuotationSubjectMatter);
    const subjects = input.subject_matters_covered.map((subject, index) =>
      repository.create({
        entry_id: entry.id,
        sequence_no: index + 1,
        subject_matter_reference: subject.subject_matter_reference
          .trim()
          .toUpperCase(),
        subject_matter_desc: subject.subject_matter_desc.trim(),
      }),
    );

    if (subjects.length > 0) {
      await repository.save(subjects);
    }
  }

  private async persistAddons(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
  ): Promise<void> {
    const addonRepository = manager.getRepository(QuotationEntryAddon);
    const taxRepository = manager.getRepository(QuotationEntryAddonTax);

    for (
      let addonIndex = 0;
      addonIndex < input.cover_note_addons.length;
      addonIndex += 1
    ) {
      const inputAddon = input.cover_note_addons[addonIndex];

      const addon = await addonRepository.save(
        addonRepository.create({
          entry_id: entry.id,
          sequence_no: addonIndex + 1,
          addon_reference: inputAddon.addon_reference.trim().toUpperCase(),
          addon_desc: inputAddon.addon_desc.trim(),
          addon_amount: this.numeric(inputAddon.addon_amount, 2),
          addon_premium_rate: this.numeric(inputAddon.addon_premium_rate, 6),
          premium_excluding_tax: this.numeric(
            inputAddon.premium_excluding_tax,
            2,
          ),
          premium_excluding_tax_equivalent: this.numeric(
            inputAddon.premium_excluding_tax_equivalent,
            2,
          ),
          premium_including_tax: this.numeric(
            inputAddon.premium_including_tax,
            2,
          ),
        }),
      );

      const taxes = inputAddon.taxes_charged.map((tax, index) =>
        taxRepository.create({
          addon_id: addon.id,
          sequence_no: index + 1,
          tax_code: tax.tax_code.trim().toUpperCase(),
          is_tax_exempted: tax.is_tax_exempted,
          tax_exemption_type: tax.tax_exemption_type?.trim() ?? null,
          tax_exemption_reference: tax.tax_exemption_reference?.trim() ?? null,
          tax_rate: this.numeric(tax.tax_rate, 6),
          tax_amount: this.numeric(tax.tax_amount, 2),
        }),
      );

      if (taxes.length > 0) {
        await taxRepository.save(taxes);
      }
    }
  }

  private mapMotorForPersistence(motor: MotorDetailDto) {
    return {
      motor_category: motor.motor_category,
      motor_type: motor.motor_type,
      registration_number: motor.registration_number.trim().toUpperCase(),
      chassis_number: motor.chassis_number.trim().toUpperCase(),
      make: motor.make.trim(),
      model: motor.model.trim(),
      model_number: motor.model_number?.trim() ?? null,
      body_type: motor.body_type.trim(),
      color: motor.color.trim(),
      engine_number: motor.engine_number.trim().toUpperCase(),
      engine_capacity: motor.engine_capacity.trim(),
      fuel_used: motor.fuel_used.trim(),
      number_of_axles: motor.number_of_axles,
      axle_distance: this.numeric(motor.axle_distance, 2),
      sitting_capacity: motor.sitting_capacity,
      year_of_manufacture: motor.year_of_manufacture,
      tare_weight: this.numeric(motor.tare_weight, 2),
      gross_weight: this.numeric(motor.gross_weight, 2),
      motor_usage: motor.motor_usage,
      owner_name: motor.owner_name.trim(),
      owner_category: motor.owner_category,
      owner_address: motor.owner_address.trim(),
    };
  }

  private resolveHeader(payload: CreateQuotationDto): ResolvedHeader {
    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      const fleetHeader = payload.cover_note_dtl.fleet_hdr!;

      return {
        sale_point_code: fleetHeader.sale_point_code,
        cover_note_start_date: fleetHeader.cover_note_start_date,
        cover_note_end_date: fleetHeader.cover_note_end_date,
        payment_mode: fleetHeader.payment_mode,
        currency_code: fleetHeader.currency_code,
        exchange_rate: fleetHeader.exchange_rate,
        total_premium_excluding_tax: fleetHeader.total_premium_excluding_tax,
        total_premium_including_tax: fleetHeader.total_premium_including_tax,
        commision_paid: fleetHeader.commision_paid,
        commision_rate: fleetHeader.commision_rate,
        officer_name: fleetHeader.officer_name,
        officer_title: fleetHeader.officer_title,
        product_code: fleetHeader.product_code,
        policy_holders: fleetHeader.policy_holders,
        fleet_id: fleetHeader.fleet_id,
        fleet_type: fleetHeader.fleet_type,
        fleet_size: fleetHeader.fleet_size,
        comprehensive_insured: fleetHeader.comprehensive_insured,
      };
    }

    const detail = payload.cover_note_dtl;

    return {
      sale_point_code: detail.sale_point_code!,
      cover_note_start_date: detail.cover_note_start_date!,
      cover_note_end_date: detail.cover_note_end_date!,
      payment_mode: detail.payment_mode!,
      currency_code: detail.currency_code!,
      exchange_rate: detail.exchange_rate!,
      total_premium_excluding_tax: detail.total_premium_excluding_tax!,
      total_premium_including_tax: detail.total_premium_including_tax!,
      commision_paid: detail.commision_paid!,
      commision_rate: detail.commision_rate!,
      officer_name: detail.officer_name!,
      officer_title: detail.officer_title!,
      product_code: detail.product_code!,
      policy_holders: detail.policy_holders!,
    };
  }

  private resolveEntries(payload: CreateQuotationDto): ResolvedEntry[] {
    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      return (payload.cover_note_dtl.fleet_dtls ?? []).map((entry) => ({
        fleet_entry: entry.fleet_entry,
        cover_note_number: entry.cover_note_number ?? '',
        prev_cover_note_reference_number:
          entry.prev_cover_note_reference_number ?? null,
        cover_note_desc: entry.cover_note_desc,
        operative_clause: entry.operative_clause,
        endorsement_type: entry.endorsement_type ?? null,
        endorsement_reason: entry.endorsement_reason ?? null,
        endorsement_premium_earned: entry.endorsement_premium_earned ?? null,
        risks_covered: entry.risks_covered,
        subject_matters_covered: entry.subject_matters_covered,
        cover_note_addons: entry.cover_note_addons,
        motor_dtl: entry.motor_dtl,
      }));
    }

    const detail = payload.cover_note_dtl;

    return [
      {
        fleet_entry: 1,
        cover_note_number: detail.cover_note_number!,
        prev_cover_note_reference_number:
          detail.prev_cover_note_reference_number ?? null,
        cover_note_desc: detail.cover_note_desc!,
        operative_clause: detail.operative_clause!,
        endorsement_type: detail.endorsement_type ?? null,
        endorsement_reason: detail.endorsement_reason ?? null,
        endorsement_premium_earned: detail.endorsement_premium_earned ?? null,
        risks_covered: detail.risks_covered ?? [],
        subject_matters_covered: detail.subject_matters_covered ?? [],
        cover_note_addons: detail.cover_note_addons ?? [],
        motor_dtl: detail.motor_dtl,
      },
    ];
  }

  private async preparePayloadWithGeneratedIdentifiers(
    companyId: string,
    payload: CreateQuotationDto | UpdateQuotationDto,
    currentQuotation?: Quotation | null,
  ): Promise<CreateQuotationDto | UpdateQuotationDto> {
    const prepared = JSON.parse(JSON.stringify(payload)) as
      | CreateQuotationDto
      | UpdateQuotationDto;

    const flow = prepared.internal_quotation.quotation_flow;
    const existingEntries = currentQuotation?.cover_note?.entries ?? [];

    if (flow === QuotationFlow.MOTOR_FLEET) {
      const fleetDetails = prepared.cover_note_dtl.fleet_dtls ?? [];
      const existingNumbers = new Map<number, string>();

      for (const entry of existingEntries) {
        const key = Number(entry.fleet_entry ?? entry.entry_number);
        if (Number.isFinite(key) && entry.cover_note_number) {
          existingNumbers.set(key, entry.cover_note_number);
        }
      }

      const missingCount = fleetDetails.filter((item, index) => {
        const key = Number(item.fleet_entry ?? index + 1);
        return !existingNumbers.has(key);
      }).length;

      const generatedNumbers = await this.identifierGeneratorService.generateFleetCoverNoteNumbers(
        companyId,
        missingCount,
      );

      let generatedIndex = 0;
      fleetDetails.forEach((item, index) => {
        const key = Number(item.fleet_entry ?? index + 1);
        const existingNumber = existingNumbers.get(key);
        item.cover_note_number =
          existingNumber ||
          generatedNumbers[generatedIndex++] ||
          item.cover_note_number ||
          '';
      });
    } else {
      const existingNumber = existingEntries[0]?.cover_note_number ?? null;
      prepared.cover_note_dtl.cover_note_number =
        existingNumber ||
        (await this.identifierGeneratorService.generateCoverNoteNumber(
          companyId,
        ));
    }

    return prepared;
  }

  private collectRiskCodes(payload: CreateQuotationDto): string[] {
    return this.resolveEntries(payload).flatMap((entry) =>
      entry.risks_covered.map((risk) =>
        this.normalizeUppercase(risk.risk_code),
      ),
    );
  }

  private async lockQuotationForUpdate(
    manager: EntityManager,
    companyId: string,
    id: string,
  ): Promise<Quotation> {
    const quotation = await manager
      .getRepository(Quotation)
      .createQueryBuilder('quotation')
      .setLock('pessimistic_write')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL')
      .getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  private async applyQuotationStatusUpdate(
    manager: EntityManager,
    quotation: Quotation,
    params: {
      nextStatus: QuotationStatus;
      reason: string;
      changedBy: string | null;
      submittedBy?: string | null;
      submittedAt?: Date | null;
    },
  ) {
    const updates: Partial<Quotation> = {
      status: params.nextStatus,
      updated_by: params.changedBy,
      rejection_reason:
        params.nextStatus === QuotationStatus.REJECTED
          ? params.reason
          : null,
    };

    if (params.submittedBy !== undefined) {
      updates.submitted_by = params.submittedBy;
    }

    if (params.submittedAt !== undefined) {
      updates.submitted_at = params.submittedAt;
    }

    await manager.getRepository(Quotation).update(
      {
        id: quotation.id,
        company_id: quotation.company_id,
      },
      updates as any,
    );

    if (quotation.status !== params.nextStatus) {
      await this.recordQuotationStatusHistory(manager, {
        quotationId: quotation.id,
        previousStatus: quotation.status,
        nextStatus: params.nextStatus,
        reason: params.reason,
        changedBy: params.changedBy,
      });
    }
  }

  private async recordQuotationStatusHistory(
    manager: EntityManager,
    params: {
      quotationId: string;
      previousStatus: QuotationStatus;
      nextStatus: QuotationStatus;
      reason: string | null;
      changedBy: string | null;
    },
  ) {
    await manager.getRepository(QuotationStatusHistory).save({
      quotation_id: params.quotationId,
      old_status: params.previousStatus,
      new_status: params.nextStatus,
      reason: params.reason,
      changed_by: params.changedBy,
    });
  }

  private defaultTransitionReason(
    action: QuotationStatusTransitionAction,
    nextStatus: QuotationStatus,
  ) {
    switch (action) {
      case QuotationStatusTransitionAction.RATE:
        return 'Quotation rated successfully';
      case QuotationStatusTransitionAction.REFER:
        return 'Quotation referred for review';
      case QuotationStatusTransitionAction.REQUEST_APPROVAL:
        return 'Quotation sent for approval';
      case QuotationStatusTransitionAction.APPROVE:
        return 'Quotation approved';
      case QuotationStatusTransitionAction.REJECT:
        return 'Quotation rejected';
      case QuotationStatusTransitionAction.CANCEL:
        return 'Quotation cancelled';
      case QuotationStatusTransitionAction.EXPIRE:
        return 'Quotation expired';
      case QuotationStatusTransitionAction.RESET_TO_DRAFT:
        return 'Quotation returned to draft';
      case QuotationStatusTransitionAction.CONVERT:
        return `Quotation transitioned to ${nextStatus}`;
      default:
        return `Quotation transitioned to ${nextStatus}`;
    }
  }

  private assertQuotationEditable(quotation: Quotation): void {
    if (quotation.submitted_at) {
      throw new ConflictException(
        'A submitted quotation cannot be replaced. Create an endorsement or a new quotation.',
      );
    }

    if (!EDITABLE_QUOTATION_STATUSES.includes(quotation.status)) {
      throw new ConflictException(
        `Quotation in ${quotation.status} status cannot be replaced`,
      );
    }
  }

  private async assertPaymentReady(quotation: Quotation): Promise<void> {
    const paymentMode = quotation.cover_note?.payment_mode;

    if (paymentMode === DIRECT_PAYMENT_MODE) {
      return;
    }

    const invoices: Array<{
      id: string;
      status: string;
      total_amount: string;
      paid_amount: string;
      balance_amount: string;
    }> = await this.dataSource.query(
      `
        SELECT
          id,
          status,
          total_amount,
          paid_amount,
          balance_amount
        FROM invoices
        WHERE quotation_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `,
      [quotation.id],
    );

    const settled = invoices.some((invoice) => {
      const status = String(invoice.status).toUpperCase();
      const totalAmount = Number(invoice.total_amount ?? 0);
      const paidAmount = Number(invoice.paid_amount ?? 0);
      const balanceAmount = Number(invoice.balance_amount ?? 0);

      if (['PAID', 'SETTLED'].includes(status)) {
        return true;
      }

      return totalAmount > 0 && balanceAmount <= 0 && paidAmount >= totalAmount;
    });

    if (!settled) {
      throw new ConflictException(
        'Quotation payment is not settled. Only direct payment mode can be submitted without a settled invoice.',
      );
    }
  }

  private async findLatestInvoice(companyId: string, quotationId: string) {
    return this.dataSource
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .where('invoice.company_id = :companyId', { companyId })
      .andWhere('invoice.quotation_id = :quotationId', { quotationId })
      .andWhere('invoice.deleted_at IS NULL')
      .orderBy('invoice.created_at', 'DESC')
      .getOne();
  }

  private async findLatestReceipt(companyId: string, quotationId: string) {
    const invoice = await this.findLatestInvoice(companyId, quotationId);

    if (!invoice) {
      return null;
    }

    return this.dataSource
      .getRepository(Receipt)
      .createQueryBuilder('receipt')
      .where('receipt.company_id = :companyId', { companyId })
      .andWhere('receipt.invoice_id = :invoiceId', { invoiceId: invoice.id })
      .andWhere('receipt.deleted_at IS NULL')
      .orderBy('receipt.created_at', 'DESC')
      .getOne();
  }

  private async findLatestPaymentTransaction(
    companyId: string,
    quotationId: string,
  ) {
    const invoice = await this.findLatestInvoice(companyId, quotationId);

    if (!invoice) {
      return null;
    }

    return this.dataSource
      .getRepository(PaymentTransaction)
      .createQueryBuilder('paymentTransaction')
      .where('paymentTransaction.company_id = :companyId', { companyId })
      .andWhere('paymentTransaction.invoice_id = :invoiceId', {
        invoiceId: invoice.id,
      })
      .andWhere('paymentTransaction.deleted_at IS NULL')
      .orderBy('paymentTransaction.created_at', 'DESC')
      .getOne();
  }

  private async findLatestPortalSubmission(
    companyId: string,
    quotationId: string,
  ) {
    return this.dataSource.getRepository(PortalTiraSubmission)
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.events', 'event')
      .where('submission.company_id = :companyId', { companyId })
      .andWhere('submission.quotation_id = :quotationId', { quotationId })
      .andWhere('submission.deleted_at IS NULL')
      .orderBy('submission.created_at', 'DESC')
      .addOrderBy('event.created_at', 'ASC')
      .getOne();
  }

  private async findLatestTiramisTracking(
    companyId: string,
    quotation: Quotation,
  ) {
    const trackingRepository = this.dataSource.getRepository(
      TiramisSubmissionTrackingEntity,
    );

    const entries = quotation.cover_note?.entries ?? [];
    const businessReferences = Array.from(
      new Set(
        [
          quotation.id,
          quotation.quotation_no,
          quotation.cover_note?.fleet_id,
          ...entries.map((entry) => entry.cover_note_number),
        ].filter((value): value is string => Boolean(value && value.trim())),
      ),
    );

    const trackings = await trackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.source_company_id = :companyId', { companyId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_module = :module', {
            module: 'quotations',
          }).orWhere('tracking.source_module ILIKE :fleetModule', {
            fleetModule: '%quotation%',
          });
        }),
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_record_id IN (:...references)', {
            references: businessReferences,
          }).orWhere('tracking.business_reference IN (:...references)', {
            references: businessReferences,
          });
        }),
      )
      .orderBy('tracking.created_at', 'DESC')
      .getMany();

    return trackings[0] ?? null;
  }

  private async findTiramisTrackingByEntry(
    companyId: string,
    quotation: Quotation,
  ) {
    const trackingRepository = this.dataSource.getRepository(
      TiramisSubmissionTrackingEntity,
    );
    const entries = quotation.cover_note?.entries ?? [];
    const references = Array.from(
      new Set(
        entries
          .map((entry) => entry.cover_note_number)
          .filter((value): value is string => Boolean(value && value.trim())),
      ),
    );

    if (references.length === 0) {
      return new Map<string, TiramisSubmissionTrackingEntity | null>();
    }

    const trackings = await trackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.source_company_id = :companyId', { companyId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_record_id IN (:...references)', {
            references,
          }).orWhere('tracking.business_reference IN (:...references)', {
            references,
          });
        }),
      )
      .orderBy('tracking.created_at', 'DESC')
      .getMany();

    const byReference = new Map<string, TiramisSubmissionTrackingEntity | null>();
    for (const tracking of trackings) {
      const key = tracking.sourceRecordId || tracking.businessReference || '';
      if (key && !byReference.has(key)) {
        byReference.set(key, tracking);
      }
    }

    for (const reference of references) {
      if (!byReference.has(reference)) {
        byReference.set(reference, null);
      }
    }

    return byReference;
  }

  private toTiramisRequestType(flow: QuotationFlow): TiramisRequestType {
    switch (flow) {
      case QuotationFlow.NON_MOTOR:
        return TiramisRequestType.NON_MOTOR;
      case QuotationFlow.MOTOR_SINGLE:
        return TiramisRequestType.MOTOR;
      case QuotationFlow.MOTOR_FLEET:
        return TiramisRequestType.MOTOR_FLEET;
      default:
        throw new BadRequestException(
          `Unsupported quotation flow: ${String(flow)}`,
        );
    }
  }

  private numeric(value: NumericValue, scale: number): string {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      throw new BadRequestException(
        'Quotation contains an invalid numeric value',
      );
    }

    return numberValue.toFixed(scale);
  }

  private normalizeUppercase(value: string): string {
    return value.trim().toUpperCase();
  }

  private getEastAfricaYear(): number {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Dar_es_Salaam',
        year: 'numeric',
      }).format(new Date()),
    );
  }

  private rethrowConstraintError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (
        error as QueryFailedError & {
          driverError?: PostgreSqlDriverError;
        }
      ).driverError;

      const code = String(driverError?.code ?? '');
      const constraint = driverError?.constraint ?? '';

      if (code === '23505') {
        if (constraint.includes('cover_note_number')) {
          throw new ConflictException(
            'The supplied cover-note number already exists',
          );
        }

        if (constraint.includes('fleet_id')) {
          throw new ConflictException('The supplied fleet ID already exists');
        }

        if (constraint.includes('quotation_no')) {
          throw new ConflictException(
            'The generated quotation number already exists. Retry the request.',
          );
        }

        if (constraint.includes('registration_number')) {
          throw new ConflictException(
            'The supplied registration number already exists',
          );
        }

        throw new ConflictException('A unique quotation value already exists');
      }

      if (code === '23503') {
        throw new BadRequestException(
          'Quotation contains an invalid relationship reference',
        );
      }

      if (code === '23514') {
        throw new BadRequestException({
          message: 'Quotation violates a database validation constraint',
          constraint: constraint || undefined,
          detail: driverError?.detail || undefined,
        });
      }

      if (code === '22P02') {
        throw new BadRequestException(
          'Quotation contains an invalid identifier or enum value',
        );
      }

      if (code === '22003') {
        throw new BadRequestException(
          'Quotation contains a numeric value outside the supported range',
        );
      }
    }

    throw error;
  }
}
