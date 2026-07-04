import { Injectable, Logger } from '@nestjs/common';

import { TiramisClaimRepository } from '../../claims/repositories/tiramis-claim.repository';
import { TiramisPolicyRepository } from '../../policies/repositories/tiramis-policy.repository';
import { TiramisReinsuranceRepository } from '../../reinsurance/repositories/tiramis-reinsurance.repository';
import { getTiramisCallbackRootDefinition } from '../constants/tiramis-callback-root-map.constant';
import { TiramisFinalResponseDto } from '../dto/tiramis-final-response.dto';

@Injectable()
export class TiramisCallbackBusinessUpdaterService {
  private readonly logger = new Logger(
    TiramisCallbackBusinessUpdaterService.name,
  );

  constructor(
    private readonly reinsuranceRepository: TiramisReinsuranceRepository,
    private readonly policyRepository: TiramisPolicyRepository,
    private readonly claimRepository: TiramisClaimRepository,
  ) {}

  async updateBusinessRecord(finalResponse: TiramisFinalResponseDto) {
    const definition = getTiramisCallbackRootDefinition(
      finalResponse.rootElement,
    );

    if (!definition) {
      this.logger.warn(
        `No business updater mapping for callback root ${finalResponse.rootElement}`,
      );

      return null;
    }

    const common = {
      requestId: finalResponse.requestId,
      responseId: finalResponse.responseId,
      statusCode: finalResponse.responseStatusCode,
      statusDesc: finalResponse.responseStatusDesc,
      payload: finalResponse.payload,
    };

    switch (definition.businessTarget) {
      case 'REINSURANCE':
        return this.reinsuranceRepository.markFinalResponseByRequestId(common);
      case 'POLICY':
        return this.policyRepository.markFinalResponseByRequestId(common);
      case 'CLAIM':
        return this.claimRepository.markFinalResponseByRequestId({
          ...common,
          claimReferenceNumber: finalResponse.claimReferenceNumber || null,
        });
      case 'COVER_NOTE':
      case 'MOTOR':
      default:
        return null;
    }
  }
}
