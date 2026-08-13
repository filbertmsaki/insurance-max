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
}

interface CancellationRuleConfig {
  cancellationMethod?: CancellationMethod;
  tiraEndorsementType?: number;
  cancellationCharge?: string | number;
  minimumRetainedPremium?: string | number;
  requireApproval?: boolean;
}

interface CancellationRulesConfig {
  default?: CancellationRuleConfig;
  reasons?: Partial<Record<CancellationReasonType, CancellationRuleConfig>>;
}

const CONFIG_KEY = 'POLICY_CANCELLATION_RULES';

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
    const cancellationMethod =
      merged.cancellationMethod ?? CancellationMethod.PRO_RATA;

    if (!Object.values(CancellationMethod).includes(cancellationMethod)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CANCELLATION_METHOD',
        message: 'The configured cancellation method is invalid.',
      });
    }

    const tiraEndorsementType = Number(merged.tiraEndorsementType);

    if (!Number.isInteger(tiraEndorsementType) || tiraEndorsementType <= 0) {
      throw new UnprocessableEntityException({
        code: 'TIRA_CANCELLATION_TYPE_NOT_CONFIGURED',
        message:
          'The company does not have a valid TIRAMIS cancellation endorsement type configured.',
      });
    }

    return {
      cancellationMethod,
      tiraEndorsementType,
      cancellationCharge: String(merged.cancellationCharge ?? 0),
      minimumRetainedPremium: String(merged.minimumRetainedPremium ?? 0),
      requireApproval: merged.requireApproval !== false,
    };
  }
}
