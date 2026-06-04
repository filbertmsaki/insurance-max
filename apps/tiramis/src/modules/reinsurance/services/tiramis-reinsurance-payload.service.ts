import { Injectable } from '@nestjs/common';

import { CreateReinsuranceDto } from '../dto/create-reinsurance.dto';
import { TiramisReinsuranceEntity } from '../entities/tiramis-reinsurance.entity';

@Injectable()
export class TiramisReinsurancePayloadService {
  buildFromDto(params: {
    dto: CreateReinsuranceDto;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      ReinsuranceHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        PremiumIncludingTax: dto.premiumIncludingTax,
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        AuthorizingOfficerName: dto.authorizingOfficerName,
        AuthorizingOfficerTitle: dto.authorizingOfficerTitle,
        ReinsuranceCategory: dto.reinsuranceCategory,
      },
      ReinsuranceDtl: dto.participants.map((participant) => ({
        ParticipantCode: participant.participantCode,
        ParticipantType: participant.participantType,
        ReinsuranceForm: participant.reinsuranceForm,
        ReinsuranceType: participant.reinsuranceType,
        ReBrokerCode: participant.reBrokerCode || '',
        BrokerageCommission: participant.brokerageCommission,
        ReinsuranceCommission: participant.reinsuranceCommission,
        PremiumShare: participant.premiumShare,
        ParticipationDate: this.formatDateTime(participant.participationDate),
      })),
    };
  }

  buildFromEntity(reinsurance: TiramisReinsuranceEntity): Record<string, any> {
    return {
      ReinsuranceHdr: {
        RequestId: reinsurance.requestId,
        CompanyCode: reinsurance.companyCode,
        SystemCode: reinsurance.systemCode,
        CallBackUrl: reinsurance.callbackUrl,
        InsurerCompanyCode: reinsurance.insurerCompanyCode,
        CoverNoteReferenceNumber: reinsurance.coverNoteReferenceNumber,
        PremiumIncludingTax: reinsurance.premiumIncludingTax,
        CurrencyCode: reinsurance.currencyCode,
        ExchangeRate: reinsurance.exchangeRate,
        AuthorizingOfficerName: reinsurance.authorizingOfficerName,
        AuthorizingOfficerTitle: reinsurance.authorizingOfficerTitle,
        ReinsuranceCategory: reinsurance.reinsuranceCategory,
      },
      ReinsuranceDtl: (reinsurance.participants || []).map((participant) => ({
        ParticipantCode: participant.participantCode,
        ParticipantType: participant.participantType,
        ReinsuranceForm: participant.reinsuranceForm,
        ReinsuranceType: participant.reinsuranceType,
        ReBrokerCode: participant.reBrokerCode || '',
        BrokerageCommission: participant.brokerageCommission,
        ReinsuranceCommission: participant.reinsuranceCommission,
        PremiumShare: participant.premiumShare,
        ParticipationDate: this.formatDateTime(participant.participationDate),
      })),
    };
  }

  private formatDateTime(value: Date | string): string {
    const date = new Date(value);
    return date.toISOString().slice(0, 19);
  }
}
