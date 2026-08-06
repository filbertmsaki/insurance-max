export const ReinsuranceDirection = {
  OUTWARD: 'OUTWARD',
  INWARD: 'INWARD',
} as const;

export type ReinsuranceDirection =
  (typeof ReinsuranceDirection)[keyof typeof ReinsuranceDirection];

export const ReinsuranceTerritory = {
  DOMESTIC: 'DOMESTIC',
  REGIONAL: 'REGIONAL',
  INTERNATIONAL: 'INTERNATIONAL',
} as const;

export type ReinsuranceTerritory =
  (typeof ReinsuranceTerritory)[keyof typeof ReinsuranceTerritory];

export const ReinsuranceRegulatoryStatus = {
  UNREGISTERED: 'UNREGISTERED',
  REGISTERED: 'REGISTERED',
  SUSPENDED: 'SUSPENDED',
  DEREGISTERED: 'DEREGISTERED',
} as const;

export type ReinsuranceRegulatoryStatus =
  (typeof ReinsuranceRegulatoryStatus)[keyof typeof ReinsuranceRegulatoryStatus];
