export interface CreateReinsuranceParticipantDto {
  participantCode: string;
  participantType: number;
  reinsuranceForm: number;
  reinsuranceType: number;
  reBrokerCode?: string | null;
  brokerageCommission: string;
  reinsuranceCommission: string;
  premiumShare: string;
  participationDate: Date | string;
}

export interface CreateReinsuranceDto {
  coverNoteReferenceNumber: string;
  premiumIncludingTax: string;
  currencyCode: string;
  exchangeRate: string;
  authorizingOfficerName: string;
  authorizingOfficerTitle: string;
  reinsuranceCategory: number;
  participants: CreateReinsuranceParticipantDto[];
}
