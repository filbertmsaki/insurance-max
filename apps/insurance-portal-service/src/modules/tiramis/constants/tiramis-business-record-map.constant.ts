import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

export interface TiramisBusinessRecordTableMapping {
  sourceModule: string;
  sourceModules: string[];
  requestTypes: TiramisRequestType[];
  tableName: string;
  idColumn: string;
  description: string;
  usesStagingTable?: boolean;
}

export const TIRAMIS_BUSINESS_RECORD_TABLE_MAP: TiramisBusinessRecordTableMapping[] =
  [
    {
      sourceModule: 'policies',
      sourceModules: ['policies', 'policy'],
      requestTypes: [TiramisRequestType.POLICY],
      tableName: 'policies',
      idColumn: 'id',
      description: 'Policy registration/submission records.',
    },
    {
      sourceModule: 'reinsurance',
      sourceModules: ['reinsurance', 'reinsurances', 'policies'],
      requestTypes: [TiramisRequestType.REINSURANCE],
      tableName: 'policies',
      idColumn: 'id',
      description:
        'Reinsurance currently uses policies table until dedicated reinsurance module is added.',
    },
    {
      sourceModule: 'cover-notes',
      sourceModules: ['cover-notes', 'non-motor', 'non_motor_policy_details'],
      requestTypes: [TiramisRequestType.NON_MOTOR],
      tableName: 'non_motor_policy_details',
      idColumn: 'id',
      description: 'Non-motor cover note details.',
    },
    {
      sourceModule: 'cover-notes',
      sourceModules: ['cover-notes', 'motor', 'motor-policy-details'],
      requestTypes: [TiramisRequestType.MOTOR],
      tableName: 'motor_policy_details',
      idColumn: 'id',
      description: 'Single motor cover note details.',
    },
    {
      sourceModule: 'cover-notes',
      sourceModules: ['cover-notes', 'motor-fleet', 'motor-fleets'],
      requestTypes: [TiramisRequestType.MOTOR_FLEET],
      tableName: 'motor_fleets',
      idColumn: 'id',
      description: 'Motor fleet cover note details.',
    },
    {
      sourceModule: 'claims',
      sourceModules: ['claims', 'claim-records', 'tiramis-claims'],
      requestTypes: [
        TiramisRequestType.CLAIM_NOTIFICATION,
        TiramisRequestType.CLAIM_INTIMATION,
        TiramisRequestType.CLAIM_ASSESSMENT,
        TiramisRequestType.DISCHARGE_VOUCHER,
        TiramisRequestType.CLAIM_PAYMENT,
        TiramisRequestType.CLAIM_REJECTION,
      ],
      tableName: 'tiramis_business_records',
      idColumn: 'id',
      description:
        'Temporary claim staging records until full claims module is implemented.',
      usesStagingTable: true,
    },
    {
      sourceModule: 'verifications',
      sourceModules: ['verifications', 'verification', 'tiramis-verifications'],
      requestTypes: [TiramisRequestType.COVER_NOTE_VERIFICATION],
      tableName: 'tiramis_business_records',
      idColumn: 'id',
      description: 'General verification staging records using stored payload.',
      usesStagingTable: true,
    },
    {
      sourceModule: 'customers',
      sourceModules: ['customers', 'customer'],
      requestTypes: [
        TiramisRequestType.NIN_VERIFICATION,
        TiramisRequestType.COMPANY_VERIFICATION,
      ],
      tableName: 'customers',
      idColumn: 'id',
      description: 'Customer records used for NIN/company verification.',
    },
    {
      sourceModule: 'motor-vehicles',
      sourceModules: ['motor-vehicles', 'vehicles', 'motor_vehicle'],
      requestTypes: [TiramisRequestType.MOTOR_VERIFICATION],
      tableName: 'motor_vehicles',
      idColumn: 'id',
      description: 'Motor vehicle records used for motor verification.',
    },
  ];

export function resolveTiramisBusinessRecordMapping(params: {
  sourceModule?: string | null;
  requestType: TiramisRequestType;
}): TiramisBusinessRecordTableMapping | null {
  const sourceModule = normalizeModule(params.sourceModule);

  const exactMatch = TIRAMIS_BUSINESS_RECORD_TABLE_MAP.find(
    (item) =>
      item.requestTypes.includes(params.requestType) &&
      item.sourceModules.map(normalizeModule).includes(sourceModule),
  );

  if (exactMatch) {
    return exactMatch;
  }

  const sourceModuleMatch = TIRAMIS_BUSINESS_RECORD_TABLE_MAP.find((item) =>
    item.sourceModules.map(normalizeModule).includes(sourceModule),
  );

  if (sourceModuleMatch) {
    return sourceModuleMatch;
  }

  const requestTypeMatch = TIRAMIS_BUSINESS_RECORD_TABLE_MAP.find((item) =>
    item.requestTypes.includes(params.requestType),
  );

  return requestTypeMatch || null;
}

export function listTiramisBusinessRecordMappings() {
  return TIRAMIS_BUSINESS_RECORD_TABLE_MAP.map((item) => ({
    sourceModule: item.sourceModule,
    sourceModules: item.sourceModules,
    requestTypes: item.requestTypes,
    tableName: item.tableName,
    idColumn: item.idColumn,
    description: item.description,
    usesStagingTable: !!item.usesStagingTable,
  }));
}

function normalizeModule(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}
