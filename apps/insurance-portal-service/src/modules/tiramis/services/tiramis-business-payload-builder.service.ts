import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { resolveTiramisBusinessRecordMapping } from '../constants/tiramis-business-record-map.constant';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

type BuilderContext = {
  companyId: string | null;
  branchId: string | null;
  companyCode: string | null;
  systemCode: string | null;
  systemName: string | null;
  insurerCompanyCode: string | null;
  tranCompanyCode: string | null;
  clientCode: string | null;
  salePointCode: string | null;
  callbackUrl: string | null;
};

@Injectable()
export class TiramisBusinessPayloadBuilderService {
  constructor(private readonly dataSource: DataSource) {}

  async buildPayload(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId?: string | null;
    sourceCompanyId?: string | null;
    sourceBranchId?: string | null;
    overridePayload?: Record<string, any> | null;
  }) {
    const mapping = resolveTiramisBusinessRecordMapping({
      sourceModule: params.sourceModule,
      requestType: params.requestType,
    });

    if (!mapping) {
      throw new BadRequestException(
        `No business record mapping found for ${params.requestType}`,
      );
    }

    const context = await this.resolveBuilderContext({
      record: null,
      sourceCompanyId: params.sourceCompanyId,
      sourceBranchId: params.sourceBranchId,
    });

    if (
      params.overridePayload &&
      typeof params.overridePayload === 'object' &&
      Object.keys(params.overridePayload).length > 0
    ) {
      return {
        payload: this.cleanObject({
          ...this.buildCommonPayload(context),
          ...params.overridePayload,
        }),
        source: 'override_payload_with_tiramis_context',
      };
    }

    let record: any = null;

    if (params.sourceRecordId) {
      record = await this.findBusinessRecord({
        tableName: mapping.tableName,
        idColumn: mapping.idColumn,
        id: params.sourceRecordId,
      });
    }

    const resolvedContext =
      record === null
        ? context
        : await this.resolveBuilderContext({
            record,
            sourceCompanyId: params.sourceCompanyId,
            sourceBranchId: params.sourceBranchId,
          });

    const storedPayload = this.extractStoredPayload(record, params.requestType);

    if (storedPayload) {
      return {
        payload: this.cleanObject({
          ...this.buildCommonPayload(resolvedContext),
          ...storedPayload,
        }),
        source: 'stored_json_payload_with_tiramis_context',
      };
    }

    switch (params.requestType) {
      case TiramisRequestType.NON_MOTOR:
      case TiramisRequestType.MOTOR:
      case TiramisRequestType.MOTOR_FLEET:
        return {
          payload: this.buildCoverNotePayload(
            record,
            params.requestType,
            resolvedContext,
          ),
          source: 'auto_cover_note_builder',
        };

      case TiramisRequestType.REINSURANCE:
        return {
          payload: this.buildReinsurancePayload(record, resolvedContext),
          source: 'auto_reinsurance_builder',
        };

      case TiramisRequestType.POLICY:
        return {
          payload: this.buildPolicyPayload(record, resolvedContext),
          source: 'auto_policy_builder',
        };

      case TiramisRequestType.CLAIM_NOTIFICATION:
        return {
          payload: this.buildClaimNotificationPayload(record, resolvedContext),
          source: 'auto_claim_notification_builder',
        };

      case TiramisRequestType.CLAIM_INTIMATION:
        return {
          payload: this.buildClaimIntimationPayload(record, resolvedContext),
          source: 'auto_claim_intimation_builder',
        };

      case TiramisRequestType.CLAIM_ASSESSMENT:
        return {
          payload: this.buildClaimAssessmentPayload(record, resolvedContext),
          source: 'auto_claim_assessment_builder',
        };

      case TiramisRequestType.DISCHARGE_VOUCHER:
        return {
          payload: this.buildDischargeVoucherPayload(record, resolvedContext),
          source: 'auto_discharge_voucher_builder',
        };

      case TiramisRequestType.CLAIM_PAYMENT:
        return {
          payload: this.buildClaimPaymentPayload(record, resolvedContext),
          source: 'auto_claim_payment_builder',
        };

      case TiramisRequestType.CLAIM_REJECTION:
        return {
          payload: this.buildClaimRejectionPayload(record, resolvedContext),
          source: 'auto_claim_rejection_builder',
        };

      case TiramisRequestType.COVER_NOTE_VERIFICATION:
        return {
          payload: this.buildCoverNoteVerificationPayload(
            record,
            resolvedContext,
          ),
          source: 'auto_cover_note_verification_builder',
        };

      case TiramisRequestType.MOTOR_VERIFICATION:
        return {
          payload: this.buildMotorVerificationPayload(record, resolvedContext),
          source: 'auto_motor_verification_builder',
        };

      case TiramisRequestType.NIN_VERIFICATION:
        return {
          payload: this.buildNinVerificationPayload(record, resolvedContext),
          source: 'auto_nin_verification_builder',
        };

      case TiramisRequestType.COMPANY_VERIFICATION:
        return {
          payload: this.buildCompanyVerificationPayload(
            record,
            resolvedContext,
          ),
          source: 'auto_company_verification_builder',
        };

      default:
        return {
          payload: this.buildFallbackPayload(
            record,
            params.requestType,
            resolvedContext,
          ),
          source: 'auto_record_fallback_builder',
        };
    }
  }

  private async findBusinessRecord(params: {
    tableName: string;
    idColumn: string;
    id: string;
  }) {
    const tableName = this.quoteIdentifier(params.tableName);
    const idColumn = this.quoteIdentifier(params.idColumn);

    const rows = await this.dataSource.query(
      `SELECT * FROM ${tableName} WHERE ${idColumn} = $1 LIMIT 1`,
      [params.id],
    );

    if (!rows?.[0]) {
      throw new NotFoundException(
        `Business record not found in ${params.tableName}`,
      );
    }

    return rows[0];
  }

  private async resolveBuilderContext(params: {
    record?: any;
    sourceCompanyId?: string | null;
    sourceBranchId?: string | null;
  }): Promise<BuilderContext> {
    const companyId =
      params.sourceCompanyId ||
      this.value(params.record, 'company_id', 'companyId') ||
      null;

    const branchId =
      params.sourceBranchId ||
      this.value(params.record, 'branch_id', 'branchId') ||
      null;

    let config: any = null;

    if (companyId) {
      const configRows = await this.dataSource.query(
        `
          SELECT *
          FROM tiramis_company_configurations
          WHERE company_id = $1
            AND is_active = true
          ORDER BY
            CASE WHEN environment = 'test' THEN 1 ELSE 2 END,
            created_at DESC
          LIMIT 1
        `,
        [companyId],
      );

      config = configRows?.[0] || null;
    }

    let company: any = null;

    if (companyId) {
      const companyRows = await this.dataSource.query(
        `
          SELECT *
          FROM companies
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [companyId],
      );

      company = companyRows?.[0] || null;
    }

    const salePointCode = await this.resolveSalePointCode({
      companyId,
      branchId,
      record: params.record,
    });

    return {
      companyId,
      branchId,
      companyCode:
        config?.company_code ||
        company?.tira_company_code ||
        this.value(params.record, 'company_code', 'companyCode') ||
        null,
      systemCode:
        config?.system_code ||
        company?.tira_system_code ||
        this.value(params.record, 'system_code', 'systemCode') ||
        null,
      systemName:
        config?.system_name ||
        company?.tira_system_name ||
        this.value(params.record, 'system_name', 'systemName') ||
        null,
      insurerCompanyCode:
        config?.insurer_company_code ||
        company?.tira_insurer_company_code ||
        company?.tira_company_code ||
        this.value(
          params.record,
          'insurer_company_code',
          'insurerCompanyCode',
        ) ||
        null,
      tranCompanyCode:
        config?.tran_company_code ||
        this.value(params.record, 'tran_company_code', 'tranCompanyCode') ||
        config?.insurer_company_code ||
        company?.tira_insurer_company_code ||
        company?.tira_company_code ||
        this.value(
          params.record,
          'insurer_company_code',
          'insurerCompanyCode',
        ) ||
        null,
      clientCode:
        config?.client_code ||
        company?.tira_client_code ||
        this.value(params.record, 'client_code', 'clientCode') ||
        null,
      salePointCode,
      callbackUrl:
        config?.callback_url ||
        company?.tira_callback_url ||
        this.value(params.record, 'callback_url', 'callbackUrl') ||
        null,
    };
  }

  private async resolveSalePointCode(params: {
    companyId: string | null;
    branchId: string | null;
    record?: any;
  }): Promise<string | null> {
    const recordSalePoint =
      this.value(params.record, 'sale_point_code', 'salePointCode') ||
      this.value(
        params.record,
        'branch_sale_point_code',
        'branchSalePointCode',
      );

    if (recordSalePoint) {
      return recordSalePoint;
    }

    if (!params.companyId) {
      return null;
    }

    if (params.branchId) {
      const branchRows = await this.dataSource.query(
        `
          SELECT sale_point_code, is_default
          FROM tiramis_sale_points
          WHERE company_id = $1
            AND branch_id = $2
            AND is_active = true
          ORDER BY is_default DESC, created_at ASC
        `,
        [params.companyId, params.branchId],
      );

      if (branchRows.length === 1) {
        return branchRows[0].sale_point_code;
      }

      if (branchRows.length > 1) {
        const defaults = branchRows.filter(
          (row: { is_default: boolean }) => row.is_default,
        );

        if (defaults.length === 1) {
          return defaults[0].sale_point_code;
        }

        throw new BadRequestException(
          'Selected branch has multiple active TIRA sale points. Provide sale_point_code explicitly.',
        );
      }
    }

    const companyRows = await this.dataSource.query(
      `
        SELECT sale_point_code, is_default
        FROM tiramis_sale_points
        WHERE company_id = $1
          AND is_active = true
        ORDER BY
          is_default DESC,
          CASE WHEN sale_point_code = 'SP500' THEN 1 ELSE 2 END,
          created_at ASC
      `,
      [params.companyId],
    );

    if (companyRows.length === 0) {
      return null;
    }

    if (companyRows.length === 1) {
      return companyRows[0].sale_point_code;
    }

    const defaults = companyRows.filter(
      (row: { is_default: boolean }) => row.is_default,
    );

    if (defaults.length === 1) {
      return defaults[0].sale_point_code;
    }

    throw new BadRequestException(
      'Company has multiple active TIRA sale points. Provide sale_point_code explicitly.',
    );
  }

  private buildCommonPayload(context: BuilderContext) {
    return this.cleanObject({
      companyCode: context.companyCode,
      systemCode: context.systemCode,
      systemName: context.systemName,
      insurerCompanyCode: context.insurerCompanyCode,
      tranCompanyCode: context.tranCompanyCode || context.insurerCompanyCode,
      clientCode: context.clientCode,
      salePointCode: context.salePointCode,
      callbackUrl: context.callbackUrl,
    });
  }

  private buildCoverNotePayload(
    record: any,
    requestType: TiramisRequestType,
    context: BuilderContext,
  ) {
    const common = this.buildCommonPayload(context);

    const coverNoteNumber =
      this.value(record, 'cover_note_no', 'coverNoteNo') ||
      this.value(record, 'cover_note_number', 'coverNoteNumber') ||
      this.value(record, 'policy_no', 'policyNumber') ||
      this.value(record, 'fleet_no', 'fleetNo') ||
      this.value(record, 'business_reference', 'businessReference');

    const startDate =
      this.value(record, 'start_date', 'startDate', 'cover_start_date') ||
      this.value(record, 'coverNoteStartDate');

    const endDate =
      this.value(record, 'end_date', 'endDate', 'cover_end_date') ||
      this.value(record, 'coverNoteEndDate');

    const basePayload = {
      ...common,
      coverNoteType: this.requiredNumber(
        'coverNoteType',
        this.value(record, 'cover_note_type', 'coverNoteType'),
      ),
      coverNoteNumber: this.required('coverNoteNumber', coverNoteNumber),
      prevCoverNoteReferenceNumber: this.value(
        record,
        'prev_cover_note_reference_number',
        'prevCoverNoteReferenceNumber',
      ),
      salePointCode: this.required('salePointCode', common.salePointCode),
      coverNoteStartDate: this.required('coverNoteStartDate', startDate),
      coverNoteEndDate: this.required('coverNoteEndDate', endDate),
      coverNoteDesc: this.required(
        'coverNoteDesc',
        this.value(record, 'description', 'coverNoteDesc'),
      ),
      operativeClause: this.required(
        'operativeClause',
        this.value(record, 'operative_clause', 'operativeClause') ||
          this.value(
            record,
            'policy_operative_clause',
            'policyOperativeClause',
          ),
      ),
      paymentMode: this.requiredNumber(
        'paymentMode',
        this.value(record, 'payment_mode', 'paymentMode'),
      ),
      currencyCode: this.required(
        'currencyCode',
        this.value(record, 'currency_code', 'currencyCode'),
      ),
      exchangeRate: this.requiredMoney(
        'exchangeRate',
        this.value(record, 'exchange_rate', 'exchangeRate'),
      ),
      totalPremiumExcludingTax: this.requiredMoney(
        'totalPremiumExcludingTax',
        this.value(
          record,
          'premium_excluding_tax',
          'totalPremiumExcludingTax',
          'basic_premium',
        ),
      ),
      totalPremiumIncludingTax: this.requiredMoney(
        'totalPremiumIncludingTax',
        this.value(
          record,
          'premium_including_tax',
          'totalPremiumIncludingTax',
          'gross_premium',
        ),
      ),
      commissionPaid: this.optionalMoney(
        this.value(record, 'commission_paid', 'commissionPaid'),
      ),
      commissionRate: this.optionalMoney(
        this.value(record, 'commission_rate', 'commissionRate'),
      ),
      officerName: this.required(
        'officerName',
        this.value(record, 'officer_name', 'officerName'),
      ),
      officerTitle: this.required(
        'officerTitle',
        this.value(record, 'officer_title', 'officerTitle'),
      ),
      productCode: this.required(
        'productCode',
        this.value(record, 'product_code', 'productCode'),
      ),
      endorsementType: this.value(
        record,
        'endorsement_type',
        'endorsementType',
      ),
      endorsementReason: this.value(
        record,
        'endorsement_reason',
        'endorsementReason',
      ),
      endorsementPremiumEarned: this.value(
        record,
        'endorsement_premium_earned',
        'endorsementPremiumEarned',
      ),
      risks: this.toArrayOrDefault(this.value(record, 'risks'), [
        this.defaultRisks(record),
      ]),
      subjectMatters: this.toArrayOrDefault(
        this.value(record, 'subject_matters', 'subjectMatters'),
        [this.defaultSubjectMatter(record, coverNoteNumber)],
      ),
      addons: this.toArrayOrDefault(this.value(record, 'addons'), []),
      policyHolders: this.toArrayOrDefault(
        this.value(record, 'policy_holders', 'policyHolders'),
        [this.defaultPolicyHolder(record)],
      ),
    };

    if (requestType === TiramisRequestType.MOTOR) {
      return this.cleanObject({
        ...basePayload,
        isFleet: false,
        motorDetail: this.buildMotorDetail(record),
      });
    }

    if (requestType === TiramisRequestType.MOTOR_FLEET) {
      return this.cleanObject({
        ...basePayload,
        isFleet: true,
        fleet: this.buildFleet(record, coverNoteNumber),
      });
    }

    return this.cleanObject(basePayload);
  }

  private buildPolicyPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    const policyNumber =
      this.value(record, 'policy_no', 'policyNumber') ||
      this.value(record, 'policy_number') ||
      this.value(record, 'business_reference', 'businessReference');

    return this.cleanObject({
      ...common,
      policyNumber: this.required('policyNumber', policyNumber),
      policyOperativeClause: this.required(
        'policyOperativeClause',
        this.value(
          record,
          'policy_operative_clause',
          'policyOperativeClause',
          'operative_clause',
        ),
      ),
      specialConditions:
        this.value(record, 'special_conditions', 'specialConditions') ?? '',
      exclusions: this.value(record, 'exclusions') ?? '',
      coverNoteReferenceNumbers: this.toArray(
        this.value(
          record,
          'cover_note_reference_numbers',
          'coverNoteReferenceNumbers',
        ) ||
          this.value(
            record,
            'cover_note_reference_number',
            'coverNoteReferenceNumber',
          ) ||
          this.value(record, 'cover_note_no', 'coverNoteNo'),
      ),
    });
  }

  private buildReinsurancePayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
          'cover_note_no',
          'coverNoteNo',
        ),
      ),
      premiumIncludingTax: this.requiredMoney(
        'premiumIncludingTax',
        this.value(record, 'premium_including_tax', 'premiumIncludingTax'),
      ),
      currencyCode: this.required(
        'currencyCode',
        this.value(record, 'currency_code', 'currencyCode'),
      ),
      exchangeRate: this.requiredMoney(
        'exchangeRate',
        this.value(record, 'exchange_rate', 'exchangeRate'),
      ),
      authorizingOfficerName: this.required(
        'authorizingOfficerName',
        this.value(
          record,
          'authorizing_officer_name',
          'authorizingOfficerName',
        ) || this.value(record, 'officer_name', 'officerName'),
      ),
      authorizingOfficerTitle: this.required(
        'authorizingOfficerTitle',
        this.value(
          record,
          'authorizing_officer_title',
          'authorizingOfficerTitle',
        ) || this.value(record, 'officer_title', 'officerTitle'),
      ),
      reinsuranceCategory: this.requiredNumber(
        'reinsuranceCategory',
        this.value(record, 'reinsurance_category', 'reinsuranceCategory'),
      ),
      participants: this.requiredArray(
        'participants',
        this.value(record, 'participants'),
      ),
    });
  }

  private buildClaimNotificationPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      claimNotificationNumber: this.required(
        'claimNotificationNumber',
        this.value(
          record,
          'claim_notification_number',
          'claimNotificationNumber',
          'business_reference',
          'businessReference',
        ),
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      claimReportDate: this.required(
        'claimReportDate',
        this.value(record, 'claim_report_date', 'claimReportDate'),
      ),
      claimFormDullyFilled: this.required(
        'claimFormDullyFilled',
        this.value(record, 'claim_form_dully_filled', 'claimFormDullyFilled'),
      ),
      lossDate: this.required(
        'lossDate',
        this.value(record, 'loss_date', 'lossDate'),
      ),
      lossNature: this.required(
        'lossNature',
        this.value(record, 'loss_nature', 'lossNature'),
      ),
      lossType: this.required(
        'lossType',
        this.value(record, 'loss_type', 'lossType'),
      ),
      lossLocation: this.required(
        'lossLocation',
        this.value(record, 'loss_location', 'lossLocation'),
      ),
      officerName: this.required(
        'officerName',
        this.value(record, 'officer_name', 'officerName'),
      ),
      officerTitle: this.required(
        'officerTitle',
        this.value(record, 'officer_title', 'officerTitle'),
      ),
    });
  }

  private buildClaimIntimationPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      claimIntimationNumber: this.required(
        'claimIntimationNumber',
        this.value(
          record,
          'claim_intimation_number',
          'claimIntimationNumber',
          'business_reference',
          'businessReference',
        ),
      ),
      claimReferenceNumber: this.required(
        'claimReferenceNumber',
        this.value(record, 'claim_reference_number', 'claimReferenceNumber'),
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      claimIntimationDate: this.required(
        'claimIntimationDate',
        this.value(record, 'claim_intimation_date', 'claimIntimationDate'),
      ),
      currencyCode: this.required(
        'currencyCode',
        this.value(record, 'currency_code', 'currencyCode'),
      ),
      exchangeRate: this.requiredMoney(
        'exchangeRate',
        this.value(record, 'exchange_rate', 'exchangeRate'),
      ),
      claimEstimatedAmount: this.requiredMoney(
        'claimEstimatedAmount',
        this.value(record, 'claim_estimated_amount', 'claimEstimatedAmount'),
      ),
      claimReserveAmount: this.requiredMoney(
        'claimReserveAmount',
        this.value(record, 'claim_reserve_amount', 'claimReserveAmount'),
      ),
      claimReserveMethod: this.required(
        'claimReserveMethod',
        this.value(record, 'claim_reserve_method', 'claimReserveMethod'),
      ),
      lossAssessmentOption: this.requiredNumber(
        'lossAssessmentOption',
        this.value(record, 'loss_assessment_option', 'lossAssessmentOption'),
      ),
      assessorName: this.required(
        'assessorName',
        this.value(record, 'assessor_name', 'assessorName'),
      ),
      assessorIdNumber: this.required(
        'assessorIdNumber',
        this.value(record, 'assessor_id_number', 'assessorIdNumber'),
      ),
      assessorIdType: this.requiredNumber(
        'assessorIdType',
        this.value(record, 'assessor_id_type', 'assessorIdType'),
      ),
      claimants: this.requiredArray(
        'claimants',
        this.value(record, 'claimants'),
      ),
    });
  }

  private buildClaimAssessmentPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      claimAssessmentNumber: this.required(
        'claimAssessmentNumber',
        this.value(
          record,
          'claim_assessment_number',
          'claimAssessmentNumber',
          'business_reference',
          'businessReference',
        ),
      ),
      claimIntimationNumber: this.required(
        'claimIntimationNumber',
        this.value(record, 'claim_intimation_number', 'claimIntimationNumber'),
      ),
      claimReferenceNumber: this.required(
        'claimReferenceNumber',
        this.value(record, 'claim_reference_number', 'claimReferenceNumber'),
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      assessmentReceivedDate: this.required(
        'assessmentReceivedDate',
        this.value(
          record,
          'assessment_received_date',
          'assessmentReceivedDate',
        ),
      ),
      assessmentReportSummary: this.required(
        'assessmentReportSummary',
        this.value(
          record,
          'assessment_report_summary',
          'assessmentReportSummary',
        ),
      ),
      currencyCode: this.required(
        'currencyCode',
        this.value(record, 'currency_code', 'currencyCode'),
      ),
      exchangeRate: this.requiredMoney(
        'exchangeRate',
        this.value(record, 'exchange_rate', 'exchangeRate'),
      ),
      assessmentAmount: this.requiredMoney(
        'assessmentAmount',
        this.value(record, 'assessment_amount', 'assessmentAmount'),
      ),
      approvedClaimAmount: this.requiredMoney(
        'approvedClaimAmount',
        this.value(record, 'approved_claim_amount', 'approvedClaimAmount'),
      ),
      claimApprovalDate: this.required(
        'claimApprovalDate',
        this.value(record, 'claim_approval_date', 'claimApprovalDate'),
      ),
      claimApprovalAuthority: this.required(
        'claimApprovalAuthority',
        this.value(
          record,
          'claim_approval_authority',
          'claimApprovalAuthority',
        ),
      ),
      isReAssessment: this.required(
        'isReAssessment',
        this.value(record, 'is_re_assessment', 'isReAssessment'),
      ),
      claimants: this.requiredArray(
        'claimants',
        this.value(record, 'claimants'),
      ),
    });
  }

  private buildDischargeVoucherPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      dischargeVoucherNumber: this.required(
        'dischargeVoucherNumber',
        this.value(
          record,
          'discharge_voucher_number',
          'dischargeVoucherNumber',
          'business_reference',
          'businessReference',
        ),
      ),
      claimAssessmentNumber: this.required(
        'claimAssessmentNumber',
        this.value(record, 'claim_assessment_number', 'claimAssessmentNumber'),
      ),
      claimReferenceNumber: this.required(
        'claimReferenceNumber',
        this.value(record, 'claim_reference_number', 'claimReferenceNumber'),
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      dischargeVoucherDate: this.required(
        'dischargeVoucherDate',
        this.value(record, 'discharge_voucher_date', 'dischargeVoucherDate'),
      ),
      currencyCode: this.required(
        'currencyCode',
        this.value(record, 'currency_code', 'currencyCode'),
      ),
      exchangeRate: this.requiredMoney(
        'exchangeRate',
        this.value(record, 'exchange_rate', 'exchangeRate'),
      ),
      claimOfferCommunicationDate: this.required(
        'claimOfferCommunicationDate',
        this.value(
          record,
          'claim_offer_communication_date',
          'claimOfferCommunicationDate',
        ),
      ),
      claimOfferAmount: this.requiredMoney(
        'claimOfferAmount',
        this.value(record, 'claim_offer_amount', 'claimOfferAmount'),
      ),
      claimantResponseDate: this.required(
        'claimantResponseDate',
        this.value(record, 'claimant_response_date', 'claimantResponseDate'),
      ),
      offerAccepted: this.required(
        'offerAccepted',
        this.value(record, 'offer_accepted', 'offerAccepted'),
      ),
      claimants: this.requiredArray(
        'claimants',
        this.value(record, 'claimants'),
      ),
    });
  }

  private buildClaimPaymentPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      claimPaymentNumber: this.required(
        'claimPaymentNumber',
        this.value(
          record,
          'claim_payment_number',
          'claimPaymentNumber',
          'business_reference',
          'businessReference',
        ),
      ),
      claimReferenceNumber: this.required(
        'claimReferenceNumber',
        this.value(record, 'claim_reference_number', 'claimReferenceNumber'),
      ),
      claimIntimationNumber: this.required(
        'claimIntimationNumber',
        this.value(record, 'claim_intimation_number', 'claimIntimationNumber'),
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      paymentDate: this.required(
        'paymentDate',
        this.value(record, 'payment_date', 'paymentDate'),
      ),
      paidAmount: this.requiredMoney(
        'paidAmount',
        this.value(record, 'paid_amount', 'paidAmount'),
      ),
      paymentMode: this.requiredNumber(
        'paymentMode',
        this.value(record, 'payment_mode', 'paymentMode'),
      ),
      partiesNotified: this.required(
        'partiesNotified',
        this.value(record, 'parties_notified', 'partiesNotified'),
      ),
      netPremiumEarned: this.requiredMoney(
        'netPremiumEarned',
        this.value(record, 'net_premium_earned', 'netPremiumEarned'),
      ),
      claimResultedLitigation: this.required(
        'claimResultedLitigation',
        this.value(
          record,
          'claim_resulted_litigation',
          'claimResultedLitigation',
        ),
      ),
      litigationReason: this.value(
        record,
        'litigation_reason',
        'litigationReason',
      ),
      currencyCode: this.required(
        'currencyCode',
        this.value(record, 'currency_code', 'currencyCode'),
      ),
      exchangeRate: this.requiredMoney(
        'exchangeRate',
        this.value(record, 'exchange_rate', 'exchangeRate'),
      ),
      claimants: this.requiredArray(
        'claimants',
        this.value(record, 'claimants'),
      ),
    });
  }

  private buildClaimRejectionPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      claimRejectionNumber: this.required(
        'claimRejectionNumber',
        this.value(
          record,
          'claim_rejection_number',
          'claimRejectionNumber',
          'business_reference',
          'businessReference',
        ),
      ),
      claimReferenceNumber: this.required(
        'claimReferenceNumber',
        this.value(record, 'claim_reference_number', 'claimReferenceNumber'),
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      rejectionDate: this.required(
        'rejectionDate',
        this.value(record, 'rejection_date', 'rejectionDate'),
      ),
      rejectionReason: this.required(
        'rejectionReason',
        this.value(record, 'rejection_reason', 'rejectionReason'),
      ),
    });
  }

  private buildCoverNoteVerificationPayload(
    record: any,
    context: BuilderContext,
  ) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      coverNoteReferenceNumber:
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ) || null,
      stickerNumber: this.value(record, 'sticker_no', 'stickerNumber'),
      motorRegistrationNumber: this.value(
        record,
        'registration_no',
        'registrationNumber',
        'motorRegistrationNumber',
      ),
      motorChassisNumber: this.value(
        record,
        'chassis_no',
        'chassisNumber',
        'motorChassisNumber',
      ),
    });
  }

  private buildMotorVerificationPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);
    const motorRegistrationNumber = this.value(
      record,
      'registration_no',
      'registrationNumber',
      'motorRegistrationNumber',
    );
    const motorChassisNumber = this.value(
      record,
      'chassis_no',
      'chassisNumber',
      'motorChassisNumber',
    );

    return this.cleanObject({
      ...common,
      motorCategory: this.requiredMotorCategory(
        this.value(record, 'motor_category', 'motorCategory'),
      ),
      motorRegistrationNumber: this.trimOptionalMotorField(
        motorRegistrationNumber,
      ),
      motorChassisNumber: this.trimOptionalMotorField(motorChassisNumber),
      engineNumber: this.value(record, 'engine_no', 'engineNumber'),
      make: this.value(record, 'make'),
      model: this.value(record, 'model'),
    });
  }

  private buildNinVerificationPayload(record: any, context: BuilderContext) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      nin: this.required(
        'nin',
        this.value(record, 'nida_no', 'nidaNo', 'nin', 'NIN', 'id_number'),
      ),
      customerName: this.buildCustomerName(record),
      customerNumber: this.value(record, 'customer_no', 'customerNo'),
    });
  }

  private buildCompanyVerificationPayload(
    record: any,
    context: BuilderContext,
  ) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      companyName: this.required(
        'companyName',
        this.value(record, 'company_name', 'companyName', 'name'),
      ),
      tin: this.value(record, 'tin', 'TIN'),
      registrationNumber: this.value(
        record,
        'registration_no',
        'registrationNumber',
      ),
      incorporationCertificateNumber: this.value(
        record,
        'incorporation_certificate_no',
        'incorporationCertificateNumber',
      ),
      customerNumber: this.value(record, 'customer_no', 'customerNo'),
    });
  }

  private buildFallbackPayload(
    record: any,
    requestType: TiramisRequestType,
    context: BuilderContext,
  ) {
    const storedPayload = this.extractStoredPayload(record, requestType);

    if (storedPayload) {
      return this.cleanObject({
        ...this.buildCommonPayload(context),
        ...storedPayload,
      });
    }

    throw new BadRequestException(
      `Automatic payload builder could not infer a payload for ${requestType}. Store a ready payload in payload/tiramis_payload or pass an override payload.`,
    );
  }

  private extractStoredPayload(
    record: any,
    requestType: TiramisRequestType,
  ): Record<string, any> | null {
    const possiblePayload =
      record?.payload?.[requestType] ||
      record?.payload?.[String(requestType).toLowerCase()] ||
      record?.payload ||
      record?.tiramis_payload?.[requestType] ||
      record?.tiramis_payload?.[String(requestType).toLowerCase()] ||
      record?.tiramis_payload ||
      record?.tiramis_request_payload ||
      null;

    if (
      possiblePayload &&
      typeof possiblePayload === 'object' &&
      Object.keys(possiblePayload).length > 0
    ) {
      return possiblePayload;
    }

    return null;
  }

  private buildMotorDetail(record: any) {
    return this.cleanObject({
      motorCategory: this.requiredNumber(
        'motorCategory',
        this.value(record, 'motor_category', 'motorCategory'),
      ),
      motorType: this.requiredNumber(
        'motorType',
        this.value(record, 'motor_type', 'motorType'),
      ),
      registrationNumber: this.required(
        'registrationNumber',
        this.value(
          record,
          'registration_no',
          'registrationNumber',
          'motorRegistrationNumber',
        ),
      ),
      chassisNumber: this.required(
        'chassisNumber',
        this.value(record, 'chassis_no', 'chassisNumber'),
      ),
      make: this.required('make', this.value(record, 'make')),
      model: this.required('model', this.value(record, 'model')),
      modelNumber: this.value(record, 'model_no', 'modelNumber'),
      bodyType: this.required(
        'bodyType',
        this.value(record, 'body_type', 'bodyType'),
      ),
      color: this.required('color', this.value(record, 'color')),
      engineNumber: this.required(
        'engineNumber',
        this.value(record, 'engine_no', 'engineNumber'),
      ),
      engineCapacity: this.required(
        'engineCapacity',
        this.value(record, 'engine_capacity', 'engineCapacity'),
      ),
      fuelUsed: this.required(
        'fuelUsed',
        this.value(record, 'fuel_used', 'fuelUsed'),
      ),
      numberOfAxles: this.requiredNumber(
        'numberOfAxles',
        this.value(record, 'number_of_axles', 'numberOfAxles'),
      ),
      axleDistance: this.required(
        'axleDistance',
        this.value(record, 'axle_distance', 'axleDistance'),
      ),
      sittingCapacity: this.requiredNumber(
        'sittingCapacity',
        this.value(record, 'sitting_capacity', 'sittingCapacity'),
      ),
      yearOfManufacture: this.requiredNumber(
        'yearOfManufacture',
        this.value(
          record,
          'year_of_manufacture',
          'yearOfManufacture',
          'manufacture_year',
        ),
      ),
      tareWeight: this.required(
        'tareWeight',
        this.value(record, 'tare_weight', 'tareWeight'),
      ),
      grossWeight: this.required(
        'grossWeight',
        this.value(record, 'gross_weight', 'grossWeight'),
      ),
      motorUsage: this.requiredNumber(
        'motorUsage',
        this.value(record, 'motor_usage', 'motorUsage'),
      ),
      ownerName: this.required('ownerName', this.buildCustomerName(record)),
      ownerCategory: this.requiredNumber(
        'ownerCategory',
        this.value(record, 'owner_category', 'ownerCategory'),
      ),
      ownerAddress: this.required(
        'ownerAddress',
        this.value(record, 'owner_address', 'ownerAddress') ||
          this.value(record, 'address'),
      ),
    });
  }

  private buildFleet(record: any, coverNoteNumber: string) {
    const storedFleet = this.value(record, 'fleet');

    if (storedFleet && typeof storedFleet === 'object') {
      return storedFleet;
    }

    const motorDetail = this.buildMotorDetail(record);

    return {
      fleetId: this.required(
        'fleetId',
        this.value(record, 'fleet_no', 'fleetNo') ||
          this.value(record, 'business_reference', 'businessReference'),
      ),
      fleetType: this.requiredNumber(
        'fleetType',
        this.value(record, 'fleet_type', 'fleetType'),
      ),
      fleetSize: this.requiredNumber(
        'fleetSize',
        this.value(record, 'fleet_size', 'fleetSize'),
      ),
      comprehensiveInsured: this.requiredMoney(
        'comprehensiveInsured',
        this.value(record, 'sum_insured', 'comprehensiveInsured'),
      ),
      items: [
        {
          fleetEntry: '1',
          coverNoteNumber,
          prevCoverNoteReferenceNumber: '',
          coverNoteDesc: 'Fleet vehicle',
          operativeClause: 'Motor fleet insurance',
          motorDetail,
        },
      ],
    };
  }

  private defaultRisks(record: any) {
    return {
      riskCode: this.required(
        'riskCode',
        this.value(record, 'risk_code', 'riskCode'),
      ),
      sumInsured: this.requiredMoney(
        'sumInsured',
        this.value(record, 'sum_insured', 'sumInsured'),
      ),
      sumInsuredEquivalent: this.requiredMoney(
        'sumInsuredEquivalent',
        this.value(record, 'sum_insured_equivalent', 'sumInsuredEquivalent'),
      ),
      premiumRate: this.requiredMoney(
        'premiumRate',
        this.value(record, 'premium_rate', 'premiumRate'),
      ),
      premiumBeforeDiscount: this.requiredMoney(
        'premiumBeforeDiscount',
        this.value(record, 'premium_before_discount', 'premiumBeforeDiscount'),
      ),
      premiumAfterDiscount: this.requiredMoney(
        'premiumAfterDiscount',
        this.value(record, 'premium_after_discount', 'premiumAfterDiscount'),
      ),
      premiumExcludingTaxEquivalent: this.requiredMoney(
        'premiumExcludingTaxEquivalent',
        this.value(
          record,
          'premium_excluding_tax_equivalent',
          'premiumExcludingTaxEquivalent',
        ),
      ),
      premiumIncludingTax: this.requiredMoney(
        'premiumIncludingTax',
        this.value(record, 'premium_including_tax', 'premiumIncludingTax'),
      ),
      discounts: [],
      taxes: this.requiredArray('taxes', this.value(record, 'taxes')),
    };
  }

  private defaultSubjectMatter(record: any, reference: string) {
    return {
      subjectMatterReference: this.required(
        'subjectMatterReference',
        this.value(
          record,
          'subject_matter_reference',
          'subjectMatterReference',
        ) || reference,
      ),
      subjectMatterDesc: this.required(
        'subjectMatterDesc',
        this.value(record, 'subject_matter_desc', 'subjectMatterDesc') ||
          this.value(record, 'description'),
      ),
    };
  }

  private defaultPolicyHolder(record: any) {
    return this.cleanObject({
      policyHolderName: this.required(
        'policyHolderName',
        this.buildCustomerName(record),
      ),
      policyHolderBirthDate: this.required(
        'policyHolderBirthDate',
        this.value(record, 'birth_date', 'dateOfBirth'),
      ),
      policyHolderType: this.requiredNumber(
        'policyHolderType',
        this.value(record, 'policy_holder_type', 'policyHolderType'),
      ),
      policyHolderIdNumber: this.required(
        'policyHolderIdNumber',
        this.value(record, 'nida_no', 'nidaNo', 'id_number', 'idNumber') ||
          this.value(record, 'registration_no', 'registrationNumber'),
      ),
      policyHolderIdType: this.requiredNumber(
        'policyHolderIdType',
        this.value(record, 'policy_holder_id_type', 'policyHolderIdType'),
      ),
      gender: this.value(record, 'gender') || '',
      countryCode: this.required(
        'countryCode',
        this.value(record, 'country_code', 'countryCode'),
      ),
      region: this.required('region', this.value(record, 'region')),
      district: this.required('district', this.value(record, 'district')),
      street: this.value(record, 'street') || '',
      phoneNumber: this.required(
        'phoneNumber',
        this.value(record, 'phone_number', 'phoneNumber', 'mobile') ||
          this.value(record, 'phone'),
      ),
      fax: this.value(record, 'fax') || '',
      postalAddress: this.required(
        'postalAddress',
        this.value(record, 'postal_address', 'postalAddress', 'address') ||
          this.value(record, 'postalAddress'),
      ),
      emailAddress: this.value(record, 'email', 'emailAddress'),
    });
  }

  private defaultClaimant(record: any) {
    return this.cleanObject({
      claimantName: this.required(
        'claimantName',
        this.buildCustomerName(record),
      ),
      claimantBirthDate: this.required(
        'claimantBirthDate',
        this.value(record, 'claimant_birth_date', 'claimantBirthDate') ||
          this.value(record, 'birth_date', 'dateOfBirth'),
      ),
      claimantCategory: this.requiredNumber(
        'claimantCategory',
        this.value(record, 'claimant_category', 'claimantCategory'),
      ),
      claimantType: this.requiredNumber(
        'claimantType',
        this.value(record, 'claimant_type', 'claimantType'),
      ),
      claimantIdNumber: this.required(
        'claimantIdNumber',
        this.value(
          record,
          'claimant_id_number',
          'claimantIdNumber',
          'nida_no',
          'nidaNo',
          'id_number',
        ),
      ),
      claimantIdType: this.requiredNumber(
        'claimantIdType',
        this.value(record, 'claimant_id_type', 'claimantIdType'),
      ),
      gender: this.value(record, 'gender') || '',
      countryCode: this.required(
        'countryCode',
        this.value(record, 'country_code', 'countryCode'),
      ),
      region: this.required('region', this.value(record, 'region')),
      district: this.required('district', this.value(record, 'district')),
      street: this.value(record, 'street') || '',
      claimantPhoneNumber: this.required(
        'claimantPhoneNumber',
        this.value(
          record,
          'claimant_phone_number',
          'claimantPhoneNumber',
          'phone_number',
          'phoneNumber',
        ) || this.value(record, 'phone'),
      ),
      claimantFax: this.value(record, 'claimant_fax', 'claimantFax') || '',
      postalAddress: this.required(
        'postalAddress',
        this.value(record, 'postal_address', 'postalAddress', 'address') ||
          this.value(record, 'postalAddress'),
      ),
      emailAddress: this.value(record, 'email', 'emailAddress'),
    });
  }

  private buildCustomerName(record: any): string | null {
    const companyName = this.value(
      record,
      'company_name',
      'companyName',
      'name',
    );

    if (companyName) {
      return companyName;
    }

    const names = [
      this.value(record, 'first_name', 'firstName'),
      this.value(record, 'middle_name', 'middleName'),
      this.value(record, 'last_name', 'lastName'),
    ].filter(Boolean);

    return names.length ? names.join(' ') : null;
  }

  private value(record: any, ...keys: string[]) {
    for (const key of keys) {
      if (
        record?.[key] !== undefined &&
        record?.[key] !== null &&
        record?.[key] !== ''
      ) {
        return record[key];
      }
    }

    return null;
  }

  private required(label: string, value: any) {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(
        `Cannot build TIRAMIS payload. Missing required field: ${label}`,
      );
    }

    return value;
  }

  private requiredNumber(label: string, value: any): number {
    const requiredValue = this.required(label, value);
    const parsed = Number(requiredValue);

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        `Cannot build TIRAMIS payload. Invalid numeric field: ${label}`,
      );
    }

    return parsed;
  }

  private requiredMoney(label: string, value: any): string {
    const requiredValue = this.required(label, value);
    const parsed = Number(requiredValue);

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        `Cannot build TIRAMIS payload. Invalid money field: ${label}`,
      );
    }

    return parsed.toFixed(2);
  }

  private optionalMoney(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        'Cannot build TIRAMIS payload. Invalid money field.',
      );
    }

    return parsed.toFixed(2);
  }

  private requiredArray(label: string, value: any): any[] {
    const arr = this.toArray(value);

    if (arr.length === 0) {
      throw new BadRequestException(
        `Cannot build TIRAMIS payload. Missing required field: ${label}`,
      );
    }

    return arr;
  }

  private toArray(value: any): any[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    if (typeof value === 'object') {
      return [value];
    }

    return [];
  }

  private toArrayOrDefault(value: any, defaultValue: any[]) {
    const arr = this.toArray(value);
    return arr.length ? arr : defaultValue;
  }

  private requiredMotorCategory(value: any): number {
    const category = Number(value);

    if (!Number.isInteger(category) || ![1, 2].includes(category)) {
      throw new BadRequestException(
        'Cannot build TIRAMIS payload. motorCategory must be 1 or 2',
      );
    }

    return category;
  }

  private trimOptionalMotorField(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized || null;
  }

  private cleanObject<T = any>(value: T): T {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.cleanObject(item))
        .filter((item) => item !== undefined && item !== null) as T;
    }

    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};

      for (const [key, item] of Object.entries(value as Record<string, any>)) {
        if (item === undefined || item === null || item === '') {
          continue;
        }

        const cleaned = this.cleanObject(item);

        if (
          cleaned !== undefined &&
          cleaned !== null &&
          !(
            typeof cleaned === 'object' &&
            !Array.isArray(cleaned) &&
            Object.keys(cleaned).length === 0
          )
        ) {
          result[key] = cleaned;
        }
      }

      return result as T;
    }

    return value;
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }

    return `"${identifier}"`;
  }
}
