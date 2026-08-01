import { environment } from '@insurance-max/shared-config';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';

async function findCompanyId(dataSource: DataSource) {
  const rows = await dataSource.query(
    `
      SELECT id
      FROM companies
      WHERE deleted_at IS NULL
        AND tira_company_code = $1
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [environment.SEED_TARGET_COMPANY_CODE ?? 'ICC110'],
  );

  return rows[0]?.id || null;
}

async function upsertRecord(
  dataSource: DataSource,
  params: {
    companyId: string;
    sourceModule: string;
    requestType: string;
    businessReference: string;
    payload: Record<string, any>;
  },
) {
  await dataSource.query(
    `
      INSERT INTO tiramis_business_records (
        company_id,
        source_module,
        request_type,
        business_reference,
        status,
        payload,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'READY',
        $5::jsonb,
        $6::jsonb,
        now(),
        now()
      )
      ON CONFLICT (
        company_id,
        source_module,
        request_type,
        business_reference
      )
      WHERE deleted_at IS NULL
      DO UPDATE SET
        status = 'READY',
        payload = EXCLUDED.payload,
        metadata =
          COALESCE(tiramis_business_records.metadata, '{}'::jsonb)
          || EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      params.companyId,
      params.sourceModule,
      params.requestType,
      params.businessReference,
      JSON.stringify(params.payload),
      JSON.stringify({
        source: '006-tiramis-business-records.seed',
      }),
    ],
  );
}

export default class TiramisBusinessRecordsSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    if (environment.ENABLE_DEMO_SEED !== 'true') {
      console.log(
        '[tiramis-business-records-seed] Skipped. ENABLE_DEMO_SEED is not true.',
      );
      return;
    }

    const companyId = await findCompanyId(dataSource);

    if (!companyId) {
      console.warn(
        '[tiramis-business-records-seed] Skipped because target seed company was not found',
      );
      return;
    }

    await upsertRecord(dataSource, {
      companyId,
      sourceModule: 'claims',
      requestType: 'CLAIM_NOTIFICATION',
      businessReference: 'CLM-NOTIFY-001',
      payload: {
        claimNotificationNumber: 'CLM-NOTIFY-001',
        coverNoteReferenceNumber: 'CN-TEST-001',
        claimReportDate: new Date().toISOString(),
        claimFormDullyFilled: 'Y',
        lossDate: new Date().toISOString(),
        lossNature: 'Accident',
        lossType: 'Motor',
        lossLocation: 'Dar es Salaam',
        officerName: 'Mock Officer',
        officerTitle: 'Claims Officer',
      },
    });

    await upsertRecord(dataSource, {
      companyId,
      sourceModule: 'verifications',
      requestType: 'NIN_VERIFICATION',
      businessReference: '19900101123456789001',
      payload: {
        nin: '19900101123456789001',
      },
    });

    await upsertRecord(dataSource, {
      companyId,
      sourceModule: 'verifications',
      requestType: 'MOTOR_VERIFICATION',
      businessReference: 'T123ABC',
      payload: {
        motorCategory: 1,
        motorRegistrationNumber: 'T123ABC',
        motorChassisNumber: 'CHS123456',
      },
    });

    console.log('[tiramis-business-records-seed] Sample seed completed');
  }
}
