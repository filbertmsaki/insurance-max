export interface RegulatoryCoverNoteReference {
  sourceCoverNoteNumber: string | null;
  quotationEntryId: string | null;
  fleetEntry: number | null;
  coverNoteReferenceNumber: string;
  stickerNumber: string | null;
  registrationNumber: string | null;
  chassisNumber: string | null;
}

export interface RegulatoryPolicyReference {
  policyNumber: string;
  policyReferenceNumber: string;
  coverNoteReferenceNumbers: string[];
}

/** TIRA ClaimReferenceNumber returned by ClaimNotificationRefRes. */
export interface RegulatoryClaimReference {
  claimReferenceNumber: string;
}

export interface RegulatoryFinalResponse {
  transactionId: string;
  requestId: string;
  responseId: string;
  requestType: string;
  responseRoot: string;
  success: boolean;
  statusCode: string;
  statusDescription: string;
  coverNotes: RegulatoryCoverNoteReference[];
  policy: RegulatoryPolicyReference | null;
  claim?: RegulatoryClaimReference | null;
  signatureVerified: boolean;
  responsePayloadHash: string;
  receivedAt: string;
}
