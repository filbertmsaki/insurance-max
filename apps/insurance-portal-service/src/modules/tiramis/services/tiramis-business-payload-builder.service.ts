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

      case TiramisRequestType.DETAILS_VERIFICATION:
        return {
          payload: this.buildDetailsVerificationPayload(
            record,
            resolvedContext,
          ),
          source: 'auto_details_verification_builder',
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
        this.value(
          params.record,
          'tran_company_code',
          'tranCompanyCode',
        ) ||
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
      this.value(record, 'coverNoteStartDate') ||
      new Date().toISOString();

    const endDate =
      this.value(record, 'end_date', 'endDate', 'cover_end_date') ||
      this.value(record, 'coverNoteEndDate') ||
      this.addOneYear(startDate);

    const basePayload = {
      ...common,
      coverNoteType: this.numberOrDefault(
        this.value(record, 'cover_note_type', 'coverNoteType'),
        requestType === TiramisRequestType.NON_MOTOR ? 1 : 3,
      ),
      coverNoteNumber: this.required('coverNoteNumber', coverNoteNumber),
      prevCoverNoteReferenceNumber: this.value(
        record,
        'prev_cover_note_reference_number',
        'prevCoverNoteReferenceNumber',
      ),
      salePointCode: this.required('salePointCode', common.salePointCode),
      coverNoteStartDate: startDate,
      coverNoteEndDate: endDate,
      coverNoteDesc:
        this.value(record, 'description', 'coverNoteDesc') ||
        this.defaultCoverNoteDescription(requestType),
      operativeClause:
        this.value(record, 'operative_clause', 'operativeClause') ||
        this.value(
          record,
          'policy_operative_clause',
          'policyOperativeClause',
        ) ||
        'Standard insurance operative clause',
      paymentMode: this.numberOrDefault(
        this.value(record, 'payment_mode', 'paymentMode'),
        1,
      ),
      currencyCode:
        this.value(record, 'currency_code', 'currencyCode') || 'TZS',
      exchangeRate: this.moneyOrDefault(
        this.value(record, 'exchange_rate', 'exchangeRate'),
        '1.00',
      ),
      totalPremiumExcludingTax: this.moneyOrDefault(
        this.value(
          record,
          'premium_excluding_tax',
          'totalPremiumExcludingTax',
          'basic_premium',
        ),
        '0.00',
      ),
      totalPremiumIncludingTax: this.moneyOrDefault(
        this.value(
          record,
          'premium_including_tax',
          'totalPremiumIncludingTax',
          'gross_premium',
        ),
        '0.00',
      ),
      commissionPaid: this.moneyOrDefault(
        this.value(record, 'commission_paid', 'commissionPaid'),
        '0.00',
      ),
      commissionRate: this.moneyOrDefault(
        this.value(record, 'commission_rate', 'commissionRate'),
        '0.00',
      ),
      officerName:
        this.value(record, 'officer_name', 'officerName') || 'Portal Officer',
      officerTitle:
        this.value(record, 'officer_title', 'officerTitle') || 'Underwriter',
      productCode:
        this.value(record, 'product_code', 'productCode') || 'SP005001000000',
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
      risks: this.toArrayOrDefault(
        this.value(record, 'risks'),
        this.defaultRisks(record),
      ),
      subjectMatters: this.toArrayOrDefault(
        this.value(record, 'subject_matters', 'subjectMatters'),
        this.defaultSubjectMatters(record, coverNoteNumber),
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
      policyOperativeClause:
        this.value(
          record,
          'policy_operative_clause',
          'policyOperativeClause',
          'operative_clause',
        ) || 'Standard policy operative clause',
      specialConditions:
        this.value(record, 'special_conditions', 'specialConditions') ||
        'Standard special conditions apply',
      exclusions:
        this.value(record, 'exclusions') || 'Subject to standard exclusions',
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
      premiumIncludingTax: this.moneyOrDefault(
        this.value(record, 'premium_including_tax', 'premiumIncludingTax'),
        '0.00',
      ),
      currencyCode:
        this.value(record, 'currency_code', 'currencyCode') || 'TZS',
      exchangeRate: this.moneyOrDefault(
        this.value(record, 'exchange_rate', 'exchangeRate'),
        '1.00',
      ),
      authorizingOfficerName:
        this.value(
          record,
          'authorizing_officer_name',
          'authorizingOfficerName',
        ) ||
        this.value(record, 'officer_name', 'officerName') ||
        'Portal Officer',
      authorizingOfficerTitle:
        this.value(
          record,
          'authorizing_officer_title',
          'authorizingOfficerTitle',
        ) ||
        this.value(record, 'officer_title', 'officerTitle') ||
        'Underwriter',
      reinsuranceCategory: this.numberOrDefault(
        this.value(record, 'reinsurance_category', 'reinsuranceCategory'),
        1,
      ),
      participants: this.toArrayOrDefault(this.value(record, 'participants'), [
        {
          participantCode:
            this.value(record, 'participant_code', 'participantCode') ||
            'RE001',
          participantType: 1,
          reinsuranceForm: 1,
          reinsuranceType: 1,
          reBrokerCode:
            this.value(record, 're_broker_code', 'reBrokerCode') || '',
          brokerageCommission: '0.00',
          reinsuranceCommission: '0.00',
          premiumShare: '100.00',
          participationDate: new Date().toISOString(),
        },
      ]),
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
      claimReportDate:
        this.value(record, 'claim_report_date', 'claimReportDate') ||
        new Date().toISOString(),
      claimFormDullyFilled:
        this.value(record, 'claim_form_dully_filled', 'claimFormDullyFilled') ||
        'Y',
      lossDate:
        this.value(record, 'loss_date', 'lossDate') || new Date().toISOString(),
      lossNature: this.value(record, 'loss_nature', 'lossNature') || 'Accident',
      lossType: this.value(record, 'loss_type', 'lossType') || 'General',
      lossLocation:
        this.value(record, 'loss_location', 'lossLocation') || 'Dar es Salaam',
      officerName:
        this.value(record, 'officer_name', 'officerName') || 'Claims Officer',
      officerTitle:
        this.value(record, 'officer_title', 'officerTitle') || 'Claims Officer',
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
      claimReferenceNumber: this.value(
        record,
        'claim_reference_number',
        'claimReferenceNumber',
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      claimIntimationDate:
        this.value(record, 'claim_intimation_date', 'claimIntimationDate') ||
        new Date().toISOString(),
      currencyCode:
        this.value(record, 'currency_code', 'currencyCode') || 'TZS',
      exchangeRate: this.moneyOrDefault(
        this.value(record, 'exchange_rate', 'exchangeRate'),
        '1.00',
      ),
      claimEstimatedAmount: this.moneyOrDefault(
        this.value(record, 'claim_estimated_amount', 'claimEstimatedAmount'),
        '0.00',
      ),
      claimReserveAmount: this.moneyOrDefault(
        this.value(record, 'claim_reserve_amount', 'claimReserveAmount'),
        '0.00',
      ),
      claimReserveMethod:
        this.value(record, 'claim_reserve_method', 'claimReserveMethod') ||
        'Manual',
      lossAssessmentOption: this.numberOrDefault(
        this.value(record, 'loss_assessment_option', 'lossAssessmentOption'),
        1,
      ),
      assessorName:
        this.value(record, 'assessor_name', 'assessorName') ||
        'Portal Assessor',
      assessorIdNumber:
        this.value(record, 'assessor_id_number', 'assessorIdNumber') || '',
      assessorIdType: this.numberOrDefault(
        this.value(record, 'assessor_id_type', 'assessorIdType'),
        1,
      ),
      claimants: this.toArrayOrDefault(this.value(record, 'claimants'), [
        this.defaultClaimant(record),
      ]),
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
      claimIntimationNumber: this.value(
        record,
        'claim_intimation_number',
        'claimIntimationNumber',
      ),
      claimReferenceNumber: this.value(
        record,
        'claim_reference_number',
        'claimReferenceNumber',
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      assessmentReceivedDate:
        this.value(
          record,
          'assessment_received_date',
          'assessmentReceivedDate',
        ) || new Date().toISOString(),
      assessmentReportSummary:
        this.value(
          record,
          'assessment_report_summary',
          'assessmentReportSummary',
        ) || 'Assessment completed',
      currencyCode:
        this.value(record, 'currency_code', 'currencyCode') || 'TZS',
      exchangeRate: this.moneyOrDefault(
        this.value(record, 'exchange_rate', 'exchangeRate'),
        '1.00',
      ),
      assessmentAmount: this.moneyOrDefault(
        this.value(record, 'assessment_amount', 'assessmentAmount'),
        '0.00',
      ),
      approvedClaimAmount: this.moneyOrDefault(
        this.value(record, 'approved_claim_amount', 'approvedClaimAmount'),
        '0.00',
      ),
      claimApprovalDate:
        this.value(record, 'claim_approval_date', 'claimApprovalDate') ||
        new Date().toISOString(),
      claimApprovalAuthority:
        this.value(
          record,
          'claim_approval_authority',
          'claimApprovalAuthority',
        ) || 'Claims Manager',
      isReAssessment:
        this.value(record, 'is_re_assessment', 'isReAssessment') || 'N',
      claimants: this.toArrayOrDefault(this.value(record, 'claimants'), [
        this.defaultClaimant(record),
      ]),
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
      claimAssessmentNumber: this.value(
        record,
        'claim_assessment_number',
        'claimAssessmentNumber',
      ),
      claimReferenceNumber: this.value(
        record,
        'claim_reference_number',
        'claimReferenceNumber',
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      dischargeVoucherDate:
        this.value(record, 'discharge_voucher_date', 'dischargeVoucherDate') ||
        new Date().toISOString(),
      currencyCode:
        this.value(record, 'currency_code', 'currencyCode') || 'TZS',
      exchangeRate: this.moneyOrDefault(
        this.value(record, 'exchange_rate', 'exchangeRate'),
        '1.00',
      ),
      claimOfferCommunicationDate:
        this.value(
          record,
          'claim_offer_communication_date',
          'claimOfferCommunicationDate',
        ) || new Date().toISOString(),
      claimOfferAmount: this.moneyOrDefault(
        this.value(record, 'claim_offer_amount', 'claimOfferAmount'),
        '0.00',
      ),
      claimantResponseDate:
        this.value(record, 'claimant_response_date', 'claimantResponseDate') ||
        new Date().toISOString(),
      offerAccepted:
        this.value(record, 'offer_accepted', 'offerAccepted') || 'Y',
      claimants: this.toArrayOrDefault(this.value(record, 'claimants'), [
        this.defaultClaimant(record),
      ]),
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
      claimReferenceNumber: this.value(
        record,
        'claim_reference_number',
        'claimReferenceNumber',
      ),
      claimIntimationNumber: this.value(
        record,
        'claim_intimation_number',
        'claimIntimationNumber',
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      paymentDate:
        this.value(record, 'payment_date', 'paymentDate') ||
        new Date().toISOString(),
      paidAmount: this.moneyOrDefault(
        this.value(record, 'paid_amount', 'paidAmount'),
        '0.00',
      ),
      paymentMode: this.numberOrDefault(
        this.value(record, 'payment_mode', 'paymentMode'),
        1,
      ),
      partiesNotified:
        this.value(record, 'parties_notified', 'partiesNotified') || 'Y',
      netPremiumEarned: this.moneyOrDefault(
        this.value(record, 'net_premium_earned', 'netPremiumEarned'),
        '0.00',
      ),
      claimResultedLitigation:
        this.value(
          record,
          'claim_resulted_litigation',
          'claimResultedLitigation',
        ) || 'N',
      litigationReason:
        this.value(record, 'litigation_reason', 'litigationReason') || '',
      currencyCode:
        this.value(record, 'currency_code', 'currencyCode') || 'TZS',
      exchangeRate: this.moneyOrDefault(
        this.value(record, 'exchange_rate', 'exchangeRate'),
        '1.00',
      ),
      claimants: this.toArrayOrDefault(this.value(record, 'claimants'), [
        this.defaultClaimant(record),
      ]),
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
      claimReferenceNumber: this.value(
        record,
        'claim_reference_number',
        'claimReferenceNumber',
      ),
      coverNoteReferenceNumber: this.required(
        'coverNoteReferenceNumber',
        this.value(
          record,
          'cover_note_reference_number',
          'coverNoteReferenceNumber',
        ),
      ),
      rejectionDate:
        this.value(record, 'rejection_date', 'rejectionDate') ||
        new Date().toISOString(),
      rejectionReason:
        this.value(record, 'rejection_reason', 'rejectionReason') ||
        'Claim rejected',
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

    return this.cleanObject({
      ...common,
      motorRegistrationNumber: this.required(
        'motorRegistrationNumber',
        this.value(
          record,
          'registration_no',
          'registrationNumber',
          'motorRegistrationNumber',
        ),
      ),
      motorChassisNumber: this.value(
        record,
        'chassis_no',
        'chassisNumber',
        'motorChassisNumber',
      ),
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

  private buildDetailsVerificationPayload(
    record: any,
    context: BuilderContext,
  ) {
    const common = this.buildCommonPayload(context);

    return this.cleanObject({
      ...common,
      coverNoteReferenceNumber: this.value(
        record,
        'cover_note_reference_number',
        'coverNoteReferenceNumber',
      ),
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
      nin: this.value(record, 'nida_no', 'nidaNo', 'nin', 'NIN', 'id_number'),
      tin: this.value(record, 'tin', 'TIN'),
      policyNumber: this.value(record, 'policy_no', 'policyNumber'),
      customerName: this.buildCustomerName(record),
      companyName: this.value(record, 'company_name', 'companyName', 'name'),
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
      motorCategory: this.numberOrDefault(
        this.value(record, 'motor_category', 'motorCategory'),
        1,
      ),
      motorType: this.numberOrDefault(
        this.value(record, 'motor_type', 'motorType'),
        1,
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
      chassisNumber:
        this.value(record, 'chassis_no', 'chassisNumber') || 'UNKNOWN-CHASSIS',
      make: this.value(record, 'make') || 'UNKNOWN',
      model: this.value(record, 'model') || 'UNKNOWN',
      modelNumber: this.value(record, 'model_no', 'modelNumber'),
      bodyType: this.value(record, 'body_type', 'bodyType') || 'UNKNOWN',
      color: this.value(record, 'color') || 'UNKNOWN',
      engineNumber:
        this.value(record, 'engine_no', 'engineNumber') || 'UNKNOWN-ENGINE',
      engineCapacity:
        this.value(record, 'engine_capacity', 'engineCapacity') || '0',
      fuelUsed: this.value(record, 'fuel_used', 'fuelUsed') || 'PETROL',
      numberOfAxles: this.numberOrDefault(
        this.value(record, 'number_of_axles', 'numberOfAxles'),
        2,
      ),
      axleDistance: this.value(record, 'axle_distance', 'axleDistance') || '0',
      sittingCapacity: this.numberOrDefault(
        this.value(record, 'sitting_capacity', 'sittingCapacity'),
        1,
      ),
      yearOfManufacture: this.numberOrDefault(
        this.value(
          record,
          'year_of_manufacture',
          'yearOfManufacture',
          'manufacture_year',
        ),
        new Date().getFullYear(),
      ),
      tareWeight: this.value(record, 'tare_weight', 'tareWeight') || '0',
      grossWeight: this.value(record, 'gross_weight', 'grossWeight') || '0',
      motorUsage: this.numberOrDefault(
        this.value(record, 'motor_usage', 'motorUsage'),
        1,
      ),
      ownerName: this.buildCustomerName(record) || 'Unknown Owner',
      ownerCategory: this.numberOrDefault(
        this.value(record, 'owner_category', 'ownerCategory'),
        1,
      ),
      ownerAddress:
        this.value(record, 'owner_address', 'ownerAddress') ||
        this.value(record, 'address') ||
        'Dar es Salaam',
    });
  }

  private buildFleet(record: any, coverNoteNumber: string) {
    const storedFleet = this.value(record, 'fleet');

    if (storedFleet && typeof storedFleet === 'object') {
      return storedFleet;
    }

    const motorDetail = this.buildMotorDetail(record);

    return {
      fleetId:
        this.value(record, 'fleet_no', 'fleetNo') ||
        this.value(record, 'business_reference', 'businessReference') ||
        coverNoteNumber,
      fleetType: this.numberOrDefault(
        this.value(record, 'fleet_type', 'fleetType'),
        1,
      ),
      fleetSize: this.numberOrDefault(
        this.value(record, 'fleet_size', 'fleetSize'),
        1,
      ),
      comprehensiveInsured: this.moneyOrDefault(
        this.value(record, 'sum_insured', 'comprehensiveInsured'),
        '0.00',
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
    return [
      {
        riskCode:
          this.value(record, 'risk_code', 'riskCode') || 'SP005001000001',
        sumInsured: this.moneyOrDefault(
          this.value(record, 'sum_insured', 'sumInsured'),
          '0.00',
        ),
        sumInsuredEquivalent: this.moneyOrDefault(
          this.value(record, 'sum_insured_equivalent', 'sumInsuredEquivalent'),
          this.value(record, 'sum_insured', 'sumInsured') || '0.00',
        ),
        premiumRate: this.moneyOrDefault(
          this.value(record, 'premium_rate', 'premiumRate'),
          '0.00',
        ),
        premiumBeforeDiscount: this.moneyOrDefault(
          this.value(
            record,
            'premium_before_discount',
            'premiumBeforeDiscount',
          ),
          '0.00',
        ),
        premiumAfterDiscount: this.moneyOrDefault(
          this.value(record, 'premium_after_discount', 'premiumAfterDiscount'),
          '0.00',
        ),
        premiumExcludingTaxEquivalent: this.moneyOrDefault(
          this.value(
            record,
            'premium_excluding_tax_equivalent',
            'premiumExcludingTaxEquivalent',
          ),
          '0.00',
        ),
        premiumIncludingTax: this.moneyOrDefault(
          this.value(record, 'premium_including_tax', 'premiumIncludingTax'),
          '0.00',
        ),
        discounts: [],
        taxes: [],
      },
    ];
  }

  private defaultSubjectMatters(record: any, reference: string) {
    return [
      {
        subjectMatterReference:
          this.value(
            record,
            'subject_matter_reference',
            'subjectMatterReference',
          ) || reference,
        subjectMatterDesc:
          this.value(record, 'subject_matter_desc', 'subjectMatterDesc') ||
          this.value(record, 'description') ||
          'Insured subject matter',
      },
    ];
  }

  private defaultPolicyHolder(record: any) {
    return this.cleanObject({
      policyHolderName:
        this.buildCustomerName(record) || 'Unknown Policy Holder',
      policyHolderBirthDate:
        this.value(record, 'birth_date', 'dateOfBirth') || '1990-01-01',
      policyHolderType: this.numberOrDefault(
        this.value(record, 'policy_holder_type', 'policyHolderType'),
        1,
      ),
      policyHolderIdNumber:
        this.value(record, 'nida_no', 'nidaNo', 'id_number', 'idNumber') ||
        'UNKNOWN-ID',
      policyHolderIdType: this.numberOrDefault(
        this.value(record, 'policy_holder_id_type', 'policyHolderIdType'),
        1,
      ),
      gender: this.value(record, 'gender') || '',
      countryCode: this.value(record, 'country_code', 'countryCode') || 'TZA',
      region: this.value(record, 'region') || 'Dar es Salaam',
      district: this.value(record, 'district') || 'Ilala',
      street: this.value(record, 'street') || '',
      phoneNumber:
        this.value(record, 'phone_number', 'phoneNumber', 'mobile') ||
        '255000000000',
      fax: this.value(record, 'fax') || '',
      postalAddress:
        this.value(record, 'postal_address', 'postalAddress', 'address') ||
        'P.O. BOX 000, Dar es Salaam',
      emailAddress:
        this.value(record, 'email', 'emailAddress') || 'unknown@example.com',
    });
  }

  private defaultClaimant(record: any) {
    return this.cleanObject({
      claimantName: this.buildCustomerName(record) || 'Unknown Claimant',
      claimantBirthDate:
        this.value(record, 'claimant_birth_date', 'claimantBirthDate') ||
        this.value(record, 'birth_date', 'dateOfBirth') ||
        '1990-01-01',
      claimantCategory: this.numberOrDefault(
        this.value(record, 'claimant_category', 'claimantCategory'),
        1,
      ),
      claimantType: this.numberOrDefault(
        this.value(record, 'claimant_type', 'claimantType'),
        1,
      ),
      claimantIdNumber:
        this.value(
          record,
          'claimant_id_number',
          'claimantIdNumber',
          'nida_no',
          'nidaNo',
          'id_number',
        ) || 'UNKNOWN-ID',
      claimantIdType: this.numberOrDefault(
        this.value(record, 'claimant_id_type', 'claimantIdType'),
        1,
      ),
      gender: this.value(record, 'gender') || '',
      countryCode: this.value(record, 'country_code', 'countryCode') || 'TZA',
      region: this.value(record, 'region') || 'Dar es Salaam',
      district: this.value(record, 'district') || 'Ilala',
      street: this.value(record, 'street') || '',
      claimantPhoneNumber:
        this.value(
          record,
          'claimant_phone_number',
          'claimantPhoneNumber',
          'phone_number',
          'phoneNumber',
        ) || '255000000000',
      claimantFax: this.value(record, 'claimant_fax', 'claimantFax') || '',
      postalAddress:
        this.value(record, 'postal_address', 'postalAddress', 'address') ||
        'P.O. BOX 000, Dar es Salaam',
      emailAddress:
        this.value(record, 'email', 'emailAddress') || 'unknown@example.com',
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

  private defaultCoverNoteDescription(requestType: TiramisRequestType): string {
    if (requestType === TiramisRequestType.MOTOR) {
      return 'Motor cover note';
    }

    if (requestType === TiramisRequestType.MOTOR_FLEET) {
      return 'Motor fleet cover note';
    }

    return 'Non-motor cover note';
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

  private numberOrDefault(value: any, defaultValue: number): number {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return defaultValue;
  }

  private moneyOrDefault(value: any, defaultValue: string): string {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }

    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed.toFixed(2);
    }

    return String(value);
  }

  private addOneYear(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      const now = new Date();
      now.setFullYear(now.getFullYear() + 1);
      return now.toISOString();
    }

    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
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
