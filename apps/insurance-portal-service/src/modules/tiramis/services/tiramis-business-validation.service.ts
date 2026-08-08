import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

@Injectable()
export class TiramisBusinessValidationService {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  async validateBeforeSubmit(params: {
    requestType: TiramisRequestType;
    payload?: Record<string, any> | null;
    sourceCompanyId?: string | null;
    sourceBranchId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
  }) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const payload = params.payload || {};

    this.validatePayload(params.requestType, payload, errors);
    this.validateWorkflowRules(params.requestType, payload, errors, warnings);
    await this.validateReferenceData({
      requestType: params.requestType,
      payload,
      sourceCompanyId: params.sourceCompanyId || null,
      errors,
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requestType: params.requestType,
      payload,
      sourceCompanyId: params.sourceCompanyId || null,
      sourceBranchId: params.sourceBranchId || null,
      sourceModule: params.sourceModule || null,
      sourceRecordId: params.sourceRecordId || null,
    };
  }

  async assertValidBeforeSubmit(params: {
    requestType: TiramisRequestType;
    payload?: Record<string, any> | null;
    sourceCompanyId?: string | null;
    sourceBranchId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
  }) {
    const validation = await this.validateBeforeSubmit(params);

    if (!validation.isValid) {
      throw new BadRequestException({
        success: false,
        errors: validation.errors,
        requestType: params.requestType,
      });
    }

    return validation;
  }

  private validatePayload(
    requestType: TiramisRequestType,
    payload: Record<string, any>,
    errors: string[],
  ) {
    switch (requestType) {
      case TiramisRequestType.NON_MOTOR:
      case TiramisRequestType.MOTOR:
      case TiramisRequestType.MOTOR_FLEET:
        this.requireField(payload, 'coverNoteNumber', errors);
        this.requireField(payload, 'salePointCode', errors);
        this.requireField(payload, 'coverNoteStartDate', errors);
        this.requireField(payload, 'coverNoteEndDate', errors);

        if (requestType === TiramisRequestType.MOTOR) {
          this.requireField(payload, 'motorDetail.registrationNumber', errors);
        }

        if (requestType === TiramisRequestType.MOTOR_FLEET) {
          this.requireField(payload, 'fleet', errors);
        }
        break;

      case TiramisRequestType.POLICY:
        this.requireField(payload, 'policyNumber', errors);
        this.requireNonEmptyArray(payload, 'coverNoteReferenceNumbers', errors);
        break;

      case TiramisRequestType.REINSURANCE:
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireNonEmptyArray(payload, 'participants', errors);
        break;

      case TiramisRequestType.CLAIM_NOTIFICATION:
        this.requireField(payload, 'claimNotificationNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        break;

      case TiramisRequestType.CLAIM_INTIMATION:
        this.requireField(payload, 'claimIntimationNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.CLAIM_ASSESSMENT:
        this.requireField(payload, 'claimAssessmentNumber', errors);
        this.requireField(payload, 'claimIntimationNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.DISCHARGE_VOUCHER:
        this.requireField(payload, 'dischargeVoucherNumber', errors);
        this.requireField(payload, 'claimAssessmentNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.CLAIM_PAYMENT:
        this.requireField(payload, 'claimPaymentNumber', errors);
        this.requireField(payload, 'claimAssessmentNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.CLAIM_REJECTION:
        this.requireField(payload, 'claimRejectionNumber', errors);
        this.requireField(payload, 'claimIntimationNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        break;

      case TiramisRequestType.COVER_NOTE_VERIFICATION:
        this.requireOneOf(
          payload,
          [
            'coverNoteReferenceNumber',
            'stickerNumber',
            'motorRegistrationNumber',
            'motorChassisNumber',
          ],
          errors,
        );
        break;

      case TiramisRequestType.MOTOR_VERIFICATION:
        this.requireField(payload, 'motorCategory', errors);

        if (
          payload.motorCategory !== undefined &&
          payload.motorCategory !== null &&
          ![1, 2].includes(Number(payload.motorCategory))
        ) {
          errors.push('motorCategory must be 1 or 2');
        }

        this.requireOneOf(
          payload,
          ['motorRegistrationNumber', 'motorChassisNumber'],
          errors,
        );
        break;

      case TiramisRequestType.NIN_VERIFICATION:
        this.requireField(payload, 'nin', errors);
        break;

      case TiramisRequestType.COMPANY_VERIFICATION:
        this.requireField(payload, 'companyName', errors);
        break;

      default:
        break;
    }
  }

  private async validateReferenceData(params: {
    requestType: TiramisRequestType;
    payload: Record<string, any>;
    sourceCompanyId: string | null;
    errors: string[];
  }) {
    if (!this.dataSource) {
      return;
    }

    const { requestType, payload, sourceCompanyId, errors } = params;

    await this.requireLookupValue(
      'COVER_NOTE_TYPE',
      payload.coverNoteType,
      'coverNoteType',
      errors,
    );
    await this.requireLookupValue(
      'PAYMENT_MODE',
      payload.paymentMode,
      'paymentMode',
      errors,
    );
    await this.requireLookupValue(
      'CURRENCY',
      payload.currencyCode,
      'currencyCode',
      errors,
    );

    if (
      [
        TiramisRequestType.NON_MOTOR,
        TiramisRequestType.MOTOR,
        TiramisRequestType.MOTOR_FLEET,
      ].includes(requestType)
    ) {
      await this.requireProductCode(
        sourceCompanyId,
        payload.productCode,
        errors,
      );

      for (const [path, risk] of this.collectRisks(payload)) {
        await this.requireRiskCode(
          sourceCompanyId,
          risk?.riskCode,
          `${path}.riskCode`,
          errors,
        );

        for (const [taxIndex, tax] of this.toArray(risk?.taxes).entries()) {
          await this.requireLookupValue(
            'TAX_CODE',
            tax?.taxCode,
            `${path}.taxes[${taxIndex}].taxCode`,
            errors,
          );
        }
      }

      for (const [index, holder] of this.toArray(
        payload.policyHolders,
      ).entries()) {
        await this.validatePersonLocation(
          `policyHolders[${index}]`,
          holder,
          errors,
        );
        await this.requireLookupValue(
          'POLICY_HOLDER_TYPE',
          holder?.policyHolderType,
          `policyHolders[${index}].policyHolderType`,
          errors,
        );
        await this.requireLookupValue(
          'IDENTITY_TYPE',
          holder?.identityType,
          `policyHolders[${index}].identityType`,
          errors,
        );
        await this.requireLookupValue(
          'GENDER',
          holder?.gender,
          `policyHolders[${index}].gender`,
          errors,
        );
      }
    }

    const motorDetails = this.collectMotorDetails(payload);
    for (const [path, motor] of motorDetails) {
      await this.requireLookupValue(
        'MOTOR_CATEGORY',
        motor?.motorCategory,
        `${path}.motorCategory`,
        errors,
      );
      await this.requireLookupValue(
        'MOTOR_TYPE',
        motor?.motorType,
        `${path}.motorType`,
        errors,
      );
      await this.requireLookupValue(
        'MOTOR_USAGE',
        motor?.motorUsage,
        `${path}.motorUsage`,
        errors,
      );
      await this.requireLookupValue(
        'OWNER_CATEGORY',
        motor?.ownerCategory,
        `${path}.ownerCategory`,
        errors,
      );
    }

    for (const [path, claimant] of this.collectClaimants(payload)) {
      await this.validatePersonLocation(path, claimant, errors);
      await this.requireLookupValue(
        'IDENTITY_TYPE',
        claimant?.identityType,
        `${path}.identityType`,
        errors,
      );
      await this.requireLookupValue(
        'GENDER',
        claimant?.gender,
        `${path}.gender`,
        errors,
      );
    }

    for (const [index, participant] of this.toArray(
      payload.participants,
    ).entries()) {
      await this.requireLookupValue(
        'PARTICIPANT_TYPE',
        participant?.participantType,
        `participants[${index}].participantType`,
        errors,
      );
      await this.requireLookupValue(
        'REINSURANCE_CATEGORY',
        participant?.reinsuranceCategory,
        `participants[${index}].reinsuranceCategory`,
        errors,
      );
      await this.requireLookupValue(
        'REINSURANCE_FORM',
        participant?.reinsuranceForm,
        `participants[${index}].reinsuranceForm`,
        errors,
      );
      await this.requireLookupValue(
        'REINSURANCE_TYPE',
        participant?.reinsuranceType,
        `participants[${index}].reinsuranceType`,
        errors,
      );
    }

    await this.requireLookupValue(
      'LOSS_ASSESSMENT_OPTION',
      payload.lossAssessmentOption,
      'lossAssessmentOption',
      errors,
    );
    await this.requireLookupValue(
      'IDENTITY_TYPE',
      payload.assessorIdentityType,
      'assessorIdentityType',
      errors,
    );
  }

  private validateWorkflowRules(
    requestType: TiramisRequestType,
    payload: Record<string, any>,
    errors: string[],
    warnings: string[],
  ) {
    if (
      [
        TiramisRequestType.NON_MOTOR,
        TiramisRequestType.MOTOR,
        TiramisRequestType.MOTOR_FLEET,
      ].includes(requestType)
    ) {
      if (
        this.isTruthy(payload.requiresApproval) &&
        !this.isApprovedStatus(payload.approvalStatus)
      ) {
        errors.push(
          'approvalStatus must be approved before cover-note submission',
        );
      }

      if (
        this.isTruthy(payload.requiresPayment) &&
        !this.isPaidStatus(payload.paymentStatus)
      ) {
        errors.push('paymentStatus must be paid before cover-note submission');
      }

      if (
        ['2', '3'].includes(String(payload.coverNoteType ?? '').trim()) &&
        this.isBlank(payload.previousCoverNoteReferenceNumber)
      ) {
        errors.push(
          'previousCoverNoteReferenceNumber is required for renewal or endorsement cover notes',
        );
      }

      if (this.isBlank(payload.approvalStatus)) {
        warnings.push(
          'approvalStatus was not supplied; ensure the source workflow enforces approval before submission',
        );
      }

      if (this.isBlank(payload.paymentStatus)) {
        warnings.push(
          'paymentStatus was not supplied; ensure the source workflow enforces payment before submission',
        );
      }
    }

    if (requestType === TiramisRequestType.POLICY) {
      const references = this.toArray(payload.coverNoteReferenceNumbers);

      if (
        references.length === 0 &&
        !this.isFinalTiramisSuccess(payload.coverNoteTiramisStatus)
      ) {
        errors.push(
          'Policy submission requires at least one successful cover-note reference',
        );
      }
    }

    if (
      requestType === TiramisRequestType.CLAIM_PAYMENT &&
      this.isTruthy(payload.dischargeVoucherRequired) &&
      this.isBlank(payload.dischargeVoucherNumber)
    ) {
      errors.push(
        'dischargeVoucherNumber is required when discharge voucher is required for claim payment',
      );
    }
  }

  private async validatePersonLocation(
    path: string,
    person: any,
    errors: string[],
  ) {
    await this.requireLookupValue(
      'COUNTRY',
      person?.countryCode,
      `${path}.countryCode`,
      errors,
    );
    await this.requireLookupValue(
      'REGION',
      person?.region,
      `${path}.region`,
      errors,
    );
    await this.requireLookupValue(
      'DISTRICT',
      person?.district,
      `${path}.district`,
      errors,
    );
  }

  private collectRisks(payload: Record<string, any>): Array<[string, any]> {
    const result: Array<[string, any]> = [];

    this.toArray(payload.risks).forEach((risk, index) => {
      result.push([`risks[${index}]`, risk]);
    });

    this.toArray(payload.fleet?.items).forEach((item, itemIndex) => {
      this.toArray(item?.risks).forEach((risk, riskIndex) => {
        result.push([`fleet.items[${itemIndex}].risks[${riskIndex}]`, risk]);
      });
    });

    return result;
  }

  private collectMotorDetails(
    payload: Record<string, any>,
  ): Array<[string, any]> {
    const result: Array<[string, any]> = [];

    if (payload.motorDetail) {
      result.push(['motorDetail', payload.motorDetail]);
    }

    this.toArray(payload.fleet?.items).forEach((item, index) => {
      if (item?.motorDetail) {
        result.push([`fleet.items[${index}].motorDetail`, item.motorDetail]);
      }
    });

    return result;
  }

  private collectClaimants(payload: Record<string, any>): Array<[string, any]> {
    return this.toArray(payload.claimants).map((claimant, index) => [
      `claimants[${index}]`,
      claimant,
    ]);
  }

  private async requireProductCode(
    companyId: string | null,
    value: unknown,
    errors: string[],
  ) {
    if (this.isBlank(value) || !companyId) {
      return;
    }

    const exists = await this.existsInTable({
      tableName: 'insurance_products',
      companyId,
      value,
      columns: ['product_code', 'tiramis_product_code'],
    });

    if (!exists) {
      errors.push(`productCode is not an active TIRA product code`);
    }
  }

  private async requireRiskCode(
    companyId: string | null,
    value: unknown,
    path: string,
    errors: string[],
  ) {
    if (this.isBlank(value) || !companyId) {
      return;
    }

    const exists = await this.existsInTable({
      tableName: 'insurance_risks',
      companyId,
      value,
      columns: ['risk_code', 'tiramis_risk_code'],
    });

    if (!exists) {
      errors.push(`${path} is not an active TIRA risk code`);
    }
  }

  private async requireLookupValue(
    groupCode: string,
    value: unknown,
    path: string,
    errors: string[],
  ) {
    if (this.isBlank(value)) {
      return;
    }

    if (!(await this.lookupGroupHasValues(groupCode))) {
      return;
    }

    const rows = await this.dataSource!.query(
      `
        SELECT 1
        FROM tiramis_lookups
        WHERE group_code = $1
          AND is_active = true
          AND (
            code = $2
            OR lower(label) = lower($2)
          )
        LIMIT 1
      `,
      [groupCode, String(value).trim()],
    );

    if (!rows?.[0]) {
      errors.push(`${path} is not a valid TIRA ${groupCode} value`);
    }
  }

  private async lookupGroupHasValues(groupCode: string): Promise<boolean> {
    const rows = await this.dataSource!.query(
      `
        SELECT 1
        FROM tiramis_lookups
        WHERE group_code = $1
          AND is_active = true
        LIMIT 1
      `,
      [groupCode],
    );

    return !!rows?.[0];
  }

  private async existsInTable(params: {
    tableName: string;
    companyId: string;
    value: unknown;
    columns: string[];
  }) {
    const existingColumns = await this.existingColumns(params.tableName);
    const columns = params.columns.filter((column) =>
      existingColumns.has(column),
    );

    if (columns.length === 0) {
      return true;
    }

    const predicates = columns
      .map((column, index) => `"${column}" = $${index + 2}`)
      .join(' OR ');
    const values = columns.map(() => String(params.value).trim());

    const rows = await this.dataSource!.query(
      `
        SELECT 1
        FROM "${params.tableName}"
        WHERE company_id = $1
          AND deleted_at IS NULL
          AND is_active = true
          AND (${predicates})
        LIMIT 1
      `,
      [params.companyId, ...values],
    );

    return !!rows?.[0];
  }

  private async existingColumns(tableName: string): Promise<Set<string>> {
    const rows = await this.dataSource!.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
      `,
      [tableName],
    );

    return new Set(rows.map((row: { column_name: string }) => row.column_name));
  }

  private requireClaimants(payload: Record<string, any>, errors: string[]) {
    const claimants = payload.claimants;

    if (!Array.isArray(claimants) || claimants.length === 0) {
      errors.push('claimants is required and must contain at least one entry');
      return;
    }

    claimants.forEach((claimant: any, index: number) => {
      if (!claimant?.claimantName) {
        errors.push(`claimants[${index}].claimantName is required`);
      }

      if (!claimant?.claimantIdNumber) {
        errors.push(`claimants[${index}].claimantIdNumber is required`);
      }
    });
  }

  private requireField(
    payload: Record<string, any>,
    path: string,
    errors: string[],
  ) {
    const value = this.resolvePath(payload, path);

    if (value === null || value === undefined || value === '') {
      errors.push(`${path} is required`);
    }
  }

  private requireNonEmptyArray(
    payload: Record<string, any>,
    path: string,
    errors: string[],
  ) {
    const value = this.resolvePath(payload, path);

    if (!Array.isArray(value) || value.length === 0) {
      errors.push(`${path} is required and must contain at least one entry`);
    }
  }

  private requireOneOf(
    payload: Record<string, any>,
    paths: string[],
    errors: string[],
  ) {
    const hasOne = paths.some((path) => {
      const value = this.resolvePath(payload, path);
      return value !== null && value !== undefined && value !== '';
    });

    if (!hasOne) {
      errors.push(`At least one of [${paths.join(', ')}] is required`);
    }
  }

  private resolvePath(payload: Record<string, any>, path: string) {
    return path
      .split('.')
      .reduce(
        (current, key) =>
          current === null || current === undefined ? current : current[key],
        payload as any,
      );
  }

  private toArray(value: any): any[] {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private isBlank(value: unknown): boolean {
    return value === null || value === undefined || value === '';
  }

  private isTruthy(value: unknown): boolean {
    return (
      value === true ||
      value === 1 ||
      ['1', 'true', 'yes', 'y', 'required'].includes(
        String(value ?? '')
          .trim()
          .toLowerCase(),
      )
    );
  }

  private isApprovedStatus(value: unknown): boolean {
    return ['approved', 'not_required', 'not required'].includes(
      String(value ?? '')
        .trim()
        .toLowerCase(),
    );
  }

  private isPaidStatus(value: unknown): boolean {
    return [
      'paid',
      'fully_paid',
      'fully paid',
      'settled',
      'allocated',
      'receipted',
      'completed',
    ].includes(
      String(value ?? '')
        .trim()
        .toLowerCase(),
    );
  }

  private isFinalTiramisSuccess(value: unknown): boolean {
    return [
      'final_success',
      'completed',
      'success',
      'accepted',
      'tira001',
      '200',
    ].includes(
      String(value ?? '')
        .trim()
        .toLowerCase(),
    );
  }
}
