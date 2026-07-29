export enum IdentifierType {
  QUOTATION = 'QUOTATION',
  COVER_NOTE = 'COVER_NOTE',
  TIRAMIS_REQUEST = 'TIRAMIS_REQUEST',
  PRICING_QUOTE = 'PRICING_QUOTE',
}

export const IDENTIFIER_CONSTANTS = {
  quotation: 'QTN',
  coverNote: 'CN',
  request: 'REQ',
} as const;

export const IDENTIFIER_SEQUENCE_LENGTHS = {
  // Minimum width — padStart only pads UP to this, so day 1000+ naturally
  // renders as "1000"/"1001" rather than truncating or wrapping.
  quotation: 3,
  coverNote: 4,
  request: 6,
} as const;

export const IDENTIFIER_DATE_FORMATS = {
  quotation: 'yyMMdd',
  coverNoteDate: 'yyyyMMdd',
  coverNoteTime: 'HHmmss',
  request: 'yyMMdd',
} as const;
