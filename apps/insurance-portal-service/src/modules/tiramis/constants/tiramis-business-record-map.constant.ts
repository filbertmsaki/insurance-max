import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

export interface TiramisBusinessRecordTableMapping {
  sourceModule: string;
  requestTypes: TiramisRequestType[];
  tableName: string;
  idColumn: string;
}

/**
 * Adjust tableName values to match the real portal tables.
 */
export const TIRAMIS_BUSINESS_RECORD_TABLE_MAP: TiramisBusinessRecordTableMapping[] =
  [
    {
      sourceModule: 'policies',
      requestTypes: [TiramisRequestType.POLICY],
      tableName: 'policies',
      idColumn: 'id',
    },
    {
      sourceModule: 'reinsurance',
      requestTypes: [TiramisRequestType.REINSURANCE],
      tableName: 'policies',
      idColumn: 'id',
    },
    {
      sourceModule: 'cover-notes',
      requestTypes: [TiramisRequestType.NON_MOTOR],
      tableName: 'non_motor_policy_details',
      idColumn: 'id',
    },
    {
      sourceModule: 'cover-notes',
      requestTypes: [TiramisRequestType.MOTOR, TiramisRequestType.MOTOR_FLEET],
      tableName: 'motor_fleets',
      idColumn: 'id',
    },
    {
      sourceModule: 'claims',
      requestTypes: [
        TiramisRequestType.CLAIM_NOTIFICATION,
        TiramisRequestType.CLAIM_INTIMATION,
        TiramisRequestType.CLAIM_ASSESSMENT,
        TiramisRequestType.DISCHARGE_VOUCHER,
        TiramisRequestType.CLAIM_PAYMENT,
        TiramisRequestType.CLAIM_REJECTION,
      ],
      tableName: 'policies',
      idColumn: 'id',
    },
  ];

export function resolveTiramisBusinessRecordMapping(params: {
  sourceModule?: string | null;
  requestType: TiramisRequestType;
}): TiramisBusinessRecordTableMapping | null {
  const sourceModule = String(params.sourceModule || '').toLowerCase();

  return (
    TIRAMIS_BUSINESS_RECORD_TABLE_MAP.find(
      (item) =>
        item.sourceModule.toLowerCase() === sourceModule &&
        item.requestTypes.includes(params.requestType),
    ) ||
    TIRAMIS_BUSINESS_RECORD_TABLE_MAP.find(
      (item) => item.sourceModule.toLowerCase() === sourceModule,
    ) ||
    TIRAMIS_BUSINESS_RECORD_TABLE_MAP.find((item) =>
      item.requestTypes.includes(params.requestType),
    ) ||
    null
  );
}
