import { BadRequestException, Injectable } from '@nestjs/common';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

@Injectable()
export class TiramisBusinessValidationService {
  async validateBeforeSubmit(params: {
    requestType: TiramisRequestType;
    payload?: Record<string, any> | null;
    sourceCompanyId?: string | null;
    sourceBranchId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
  }) {
    const errors: string[] = [];
    const payload = params.payload || {};

    this.validatePayload(params.requestType, payload, errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
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
        break;

      case TiramisRequestType.REINSURANCE:
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
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
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.DISCHARGE_VOUCHER:
        this.requireField(payload, 'dischargeVoucherNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.CLAIM_PAYMENT:
        this.requireField(payload, 'claimPaymentNumber', errors);
        this.requireField(payload, 'coverNoteReferenceNumber', errors);
        this.requireClaimants(payload, errors);
        break;

      case TiramisRequestType.CLAIM_REJECTION:
        this.requireField(payload, 'claimRejectionNumber', errors);
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
}
