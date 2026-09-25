import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  CancellationMethod,
  CancellationReasonType,
} from '@insurance-max/contracts';

import { CompanyConfigsService } from '../../../platform/company-configs/company-configs.service';

export interface ResolvedCancellationRule {
  cancellationMethod: CancellationMethod;
  tiraEndorsementType: number;
  cancellationCharge: string;
  minimumRetainedPremium: string;
  requireApproval: boolean;
  directApprovalLimit: string | null;
}

interface CancellationRuleConfig {
  cancellationMethod?: CancellationMethod;
  cancellationCharge?: string | number;
  minimumRetainedPremium?: string | number;
  requireApproval?: boolean;
  directApprovalLimit?: string | number | null;
  approvalThresholdAmount?: string | number | null;
}

interface CancellationRulesConfig {
  default?: CancellationRuleConfig;
  reasons?: Partial<Record<CancellationReasonType, CancellationRuleConfig>>;
}

const CONFIG_KEY = 'POLICY_CANCELLATION_RULES';

// TIRAMIS API spec (§4.1/§5.1 CoverNoteDtl.EndorsementType) fixes the
// cover-note endorsement-type enum at 1-4 — 4 is "Cover Cancellation" for
// every insurer. It is not a per-company regulator-issued code like
// InsurerCompanyCode or ProductCode, so it is not read from company config.
const TIRA_ENDORSEMENT_TYPE_CANCELLATION = 4;

@Injectable()
export class PolicyCancellationConfigService {
  constructor(private readonly companyConfigsService: CompanyConfigsService) {}

  async resolve(
    companyId: string,
    reasonType: CancellationReasonType,
  ): Promise<ResolvedCancellationRule> {
    const config =
      await this.companyConfigsService.getValue<CancellationRulesConfig>(
        companyId,
        CONFIG_KEY,
        {},
      );
    const defaultRule = config.default ?? {};
    const reasonRule = config.reasons?.[reasonType] ?? {};
    const merged = { ...defaultRule, ...reasonRule };
    const directApprovalLimit =
      reasonRule.directApprovalLimit ??
      reasonRule.approvalThresholdAmount ??
      defaultRule.directApprovalLimit ??
      defaultRule.approvalThresholdAmount ??
      null;
    const cancellationMethod =
      merged.cancellationMethod ?? CancellationMethod.PRO_RATA;

    if (!Object.values(CancellationMethod).includes(cancellationMethod)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CANCELLATION_METHOD',
        message: 'The configured cancellation method is invalid.',
      });
    }

    return {
      cancellationMethod,
      tiraEndorsementType: TIRA_ENDORSEMENT_TYPE_CANCELLATION,
      cancellationCharge: String(merged.cancellationCharge ?? 0),
      minimumRetainedPremium: String(merged.minimumRetainedPremium ?? 0),
      requireApproval: merged.requireApproval !== false,
      directApprovalLimit:
        directApprovalLimit === null ? null : String(directApprovalLimit),
    };
  }
}
