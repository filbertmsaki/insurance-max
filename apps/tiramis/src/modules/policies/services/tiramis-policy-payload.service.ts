import { Injectable } from '@nestjs/common';

import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';
import type { CreatePolicyDto } from '../dto/create-policy.dto';
import { TiramisPolicyEntity } from '../entities/tiramis-policy.entity';

@Injectable()
export class TiramisPolicyPayloadService {
  buildFromDto(params: {
    dto: CreatePolicyDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      PolicyHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
      },
      PolicyDtl: {
        PolicyNumber: dto.policyNumber,
        PolicyOperativeClause: dto.policyOperativeClause,
        SpecialConditions: dto.specialConditions,
        Exclusions: dto.exclusions || '',
        AppliedCoverNotes: {
          CoverNoteReferenceNumber: dto.coverNoteReferenceNumbers || [],
        },
      },
    };
  }

  buildFromEntity(policy: TiramisPolicyEntity): Record<string, any> {
    return {
      PolicyHdr: {
        RequestId: policy.requestId,
        CompanyCode: policy.companyCode,
        SystemCode: policy.systemCode,
        CallBackUrl: policy.callbackUrl,
        InsurerCompanyCode: policy.insurerCompanyCode,
      },
      PolicyDtl: {
        PolicyNumber: policy.policyNumber,
        PolicyOperativeClause: policy.policyOperativeClause,
        SpecialConditions: policy.specialConditions,
        Exclusions: policy.exclusions || '',
        AppliedCoverNotes: {
          CoverNoteReferenceNumber: (policy.coverNotes || []).map((coverNote) => coverNote.coverNoteReferenceNumber),
        },
      },
    };
  }
}
