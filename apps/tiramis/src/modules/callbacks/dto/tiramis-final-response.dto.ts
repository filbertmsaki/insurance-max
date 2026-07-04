export interface TiramisFinalResponseDto {
  rootElement: string;
  responseAckRoot: string;
  serviceType: string;

  requestId: string;
  responseId: string;
  responseStatusCode: string;
  responseStatusDesc: string;

  claimReferenceNumber?: string | null;
  coverNoteReferenceNumber?: string | null;
  stickerNumber?: string | null;

  payload: Record<string, any>;
  rawXml: string;
}
