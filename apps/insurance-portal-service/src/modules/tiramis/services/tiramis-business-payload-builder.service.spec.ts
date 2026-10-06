import { DataSource } from 'typeorm';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisBusinessPayloadBuilderService } from './tiramis-business-payload-builder.service';

describe('TiramisBusinessPayloadBuilderService company codes', () => {
  const allianceId = 'alliance-company-id';

  const build = async (
    intermediary: {
      id: string;
      type: 'AGENCY' | 'BROKER';
      code: string;
    } | null,
  ) => {
    const query = jest.fn(async (sql: string, parameters: unknown[]) => {
      if (sql.includes('FROM quotations')) {
        return [
          {
            company_id: allianceId,
            branch_id: null,
            insurer_company_id: allianceId,
            intermediary_company_id: intermediary?.id ?? null,
          },
        ];
      }

      if (sql.includes('FROM tiramis_company_configurations')) {
        return [
          {
            company_code: 'ICC739',
            insurer_company_code: 'ICC739',
            tran_company_code: 'STALE_CODE',
            system_code: 'LSYS_DEMO_482',
          },
        ];
      }

      if (sql.includes('FROM tiramis_sale_points')) {
        return [{ sale_point_code: 'SP500', is_default: true }];
      }

      if (sql.includes('FROM companies')) {
        if (parameters[0] === intermediary?.id) {
          return [
            {
              company_type: intermediary.type,
              tira_company_code: intermediary.code,
            },
          ];
        }

        return [
          {
            id: allianceId,
            company_type: 'INSURANCE_COMPANY',
            tira_company_code: 'ICC739',
            tira_insurer_company_code: 'ICC739',
          },
        ];
      }

      throw new Error(`Unexpected query: ${sql}`);
    });
    const service = new TiramisBusinessPayloadBuilderService({
      query,
    } as unknown as DataSource);

    const result = await service.buildPayload({
      requestType: TiramisRequestType.MOTOR,
      sourceModule: 'quotations',
      sourceRecordId: 'quotation-id',
      overridePayload: {
        coverNoteNumber: 'AICL260820002',
        insurerCompanyCode: 'OVERRIDE_INSURER',
        tranCompanyCode: 'OVERRIDE_TRANSacting',
      },
    });

    return result.payload;
  };

  it.each([
    ['AGENCY', 'agency-id', 'IA1292'],
    ['BROKER', 'broker-id', 'IB1005'],
  ] as const)(
    'uses the %s company code as tranCompanyCode',
    async (type, id, code) => {
      const payload = await build({ id, type, code });

      expect(payload.insurerCompanyCode).toBe('ICC739');
      expect(payload.tranCompanyCode).toBe(code);
    },
  );

  it('uses the Alliance code for both codes on a direct transaction', async () => {
    const payload = await build(null);

    expect(payload.insurerCompanyCode).toBe('ICC739');
    expect(payload.tranCompanyCode).toBe('ICC739');
  });
});
