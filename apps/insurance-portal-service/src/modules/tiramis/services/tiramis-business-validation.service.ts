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

    if (params.requestType === TiramisRequestType.NIN_VERIFICATION) {
      if (!payload.nin) {
        errors.push('nin is required');
      }
    }

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
}
