/** One `<FleetResDtl>` of a fleet cover-note response. */
export interface ParsedFleetCoverNoteDto {
  fleetEntry: number | null;
  coverNoteNumber: string | null;
  coverNoteReferenceNumber: string | null;
  stickerNumber: string | null;
  responseStatusCode: string | null;
}

export interface ParsedTiramisCallbackDto {
  rootName: string;
  requestId: string;
  responseId: string;
  responseStatusCode: string;
  responseStatusDesc: string;
  claimReferenceNumber?: string | null;
  coverNoteReferenceNumber?: string | null;
  policyReferenceNumber?: string | null;
  stickerNumber?: string | null;
  /** Per-vehicle results of a fleet response, in document order. */
  fleetCoverNotes?: ParsedFleetCoverNoteDto[];
  rawXml: string;
  signature?: string | null;
  content: Record<string, unknown>;
  contentXml: string;
  signatureVerified?: boolean;
}

export interface TiramisCallbackAckResultDto {
  acknowledgementId: string;
  responseId: string;
  acknowledgementStatusCode: string;
  acknowledgementStatusDesc: string;
  acknowledgementXml: string;
}
