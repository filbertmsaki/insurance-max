export interface ParsedTiramisCallbackDto {
  rootName: string;
  requestId: string;
  responseId: string;
  responseStatusCode: string;
  responseStatusDesc: string;
  coverNoteReferenceNumber?: string | null;
  stickerNumber?: string | null;
  rawXml: string;
  signature?: string | null;
  content: Record<string, any>;
}

export interface TiramisCallbackAckResultDto {
  acknowledgementId: string;
  responseId: string;
  acknowledgementStatusCode: string;
  acknowledgementStatusDesc: string;
  acknowledgementXml: string;
}
