export enum IdentifierType {
  QUOTATION = 'QUOTATION',
  COVER_NOTE = 'COVER_NOTE',
  TIRAMIS_REQUEST = 'TIRAMIS_REQUEST',
}

export const IDENTIFIER_CONSTANTS = {
  quotation: 'QTN',
  coverNote: 'CN',
  request: 'REQ',
} as const;

export const IDENTIFIER_SEQUENCE_LENGTHS = {
  quotation: 6,
  coverNote: 4,
  request: 6,
} as const;

export const IDENTIFIER_DATE_FORMATS = {
  quotation: 'yyMMdd',
  coverNoteDate: 'yyyyMMdd',
  coverNoteTime: 'HHmmss',
  request: 'yyMMdd',
} as const;
