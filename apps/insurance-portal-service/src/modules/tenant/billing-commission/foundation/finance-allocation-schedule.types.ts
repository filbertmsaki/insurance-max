import { BadRequestException } from '@nestjs/common';
import { FINANCE_UUID } from './finance-configuration.types';

export interface InactiveAllocationSchedule {
  schema: 'FINANCE_ALLOCATION_SCHEDULE_V1' | 'FINANCE_ALLOCATION_SCHEDULE_V2';
  activationAuthorized: false;
  ruleId: string;
  ruleHash: string;
  amountMinor: string;
  currency: string;
  decimalScale: number;
  dimension?: {
    companyId: string;
    dimensionReleaseId: string;
    dimensionReleaseHash: string;
    sourceAssociationId: string;
    sourceAssociationHash: string;
  };
}
export function validateAllocationSchedule(
  value: unknown,
): InactiveAllocationSchedule {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid inactive allocation schedule.');
  const p = value as Record<string, unknown>;
  const keys = [
    'schema',
    'activationAuthorized',
    'ruleId',
    'ruleHash',
    'amountMinor',
    'currency',
    'decimalScale',
    ...(p.schema === 'FINANCE_ALLOCATION_SCHEDULE_V2' ? ['dimension'] : []),
  ];
  if (
    Object.keys(p).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(p, key)) ||
    ![
      'FINANCE_ALLOCATION_SCHEDULE_V1',
      'FINANCE_ALLOCATION_SCHEDULE_V2',
    ].includes(String(p.schema)) ||
    p.activationAuthorized !== false ||
    typeof p.ruleId !== 'string' ||
    !FINANCE_UUID.test(p.ruleId) ||
    typeof p.ruleHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(p.ruleHash) ||
    typeof p.amountMinor !== 'string' ||
    !/^[1-9]\d{0,29}$/.test(p.amountMinor) ||
    typeof p.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !Number.isInteger(p.decimalScale) ||
    Number(p.decimalScale) < 0 ||
    Number(p.decimalScale) > 12
  )
    throw new BadRequestException('Invalid inactive allocation schedule.');
  if (p.schema === 'FINANCE_ALLOCATION_SCHEDULE_V2') {
    const d = p.dimension as Record<string, unknown>;
    const fields = [
      'companyId',
      'dimensionReleaseId',
      'dimensionReleaseHash',
      'sourceAssociationId',
      'sourceAssociationHash',
    ];
    if (
      !d ||
      typeof d !== 'object' ||
      Array.isArray(d) ||
      Object.keys(d).length !== fields.length ||
      fields.some((key) => !Object.hasOwn(d, key)) ||
      !['companyId', 'dimensionReleaseId', 'sourceAssociationId'].every(
        (key) =>
          typeof d[key] === 'string' && FINANCE_UUID.test(d[key] as string),
      ) ||
      !['dimensionReleaseHash', 'sourceAssociationHash'].every(
        (key) =>
          typeof d[key] === 'string' && /^[0-9a-f]{64}$/.test(d[key] as string),
      )
    )
      throw new BadRequestException(
        'Exact reviewed company dimension references are required.',
      );
  }
  return p as unknown as InactiveAllocationSchedule;
}
