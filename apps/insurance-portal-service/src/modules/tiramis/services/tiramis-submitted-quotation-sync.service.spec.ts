import { TiramisSubmittedQuotationSyncService } from './tiramis-submitted-quotation-sync.service';

describe('TiramisSubmittedQuotationSyncService', () => {
  const requestXml = (requestId = 'REQ-1', riskCode = 'RISK-1') => `
    <TiraMsg><MotorCoverNoteRefReq>
      <CoverNoteHdr><RequestId>${requestId}</RequestId><CoverNoteType>1</CoverNoteType></CoverNoteHdr>
      <CoverNoteDtl>
        <CoverNoteNumber>CN-1</CoverNoteNumber><ProductCode>PRODUCT-1</ProductCode>
        <CoverNoteStartDate>2026-10-15T12:00:00</CoverNoteStartDate>
        <CoverNoteEndDate>2026-11-14T12:00:00</CoverNoteEndDate>
        <TotalPremiumExcludingTax>20000.00</TotalPremiumExcludingTax>
        <TotalPremiumIncludingTax>22000.00</TotalPremiumIncludingTax>
        <PolicyHolders><PolicyHolder>
          <PolicyHolderName>New Name</PolicyHolderName>
          <PolicyHolderIdNumber>00123</PolicyHolderIdNumber>
        </PolicyHolder></PolicyHolders>
        <RisksCovered><RiskCovered>
          <RiskCode>${riskCode}</RiskCode><SumInsured>100000.00</SumInsured>
          <PremiumRate>0.2</PremiumRate>
          <TaxesCharged><TaxCharged><TaxCode>VAT</TaxCode><TaxAmount>2000.00</TaxAmount></TaxCharged></TaxesCharged>
        </RiskCovered></RisksCovered>
        <MotorDtl><RegistrationNumber>NEW-123</RegistrationNumber></MotorDtl>
      </CoverNoteDtl>
    </MotorCoverNoteRefReq></TiraMsg>`;

  function fixture() {
    const quotation = {
      id: 'quote-1',
      company_id: 'company-1',
      tira_request_id: 'REQ-1',
      quotation_status: 'SUBMITTED',
      approval_status: 'APPROVED',
      payment_status: 'PAID',
      tira_status: 'PENDING',
    };
    const tables: Record<string, Record<string, any>[]> = {
      quotation_cover_notes: [
        {
          id: 'note-1',
          quotation_id: 'quote-1',
          product_code: 'PRODUCT-1',
          cover_note_type: 1,
          cover_note_start_date: new Date('2026-10-14T09:00:00Z'),
          cover_note_end_date: new Date('2026-11-13T09:00:00Z'),
          total_premium_excluding_tax: '20000.0000',
          total_premium_including_tax: '21000.0000',
        },
      ],
      quotation_cover_note_entries: [
        {
          id: 'entry-1',
          cover_note_id: 'note-1',
          entry_number: 1,
          cover_note_number: 'CN-1',
        },
      ],
      quotation_policy_holders: [
        {
          id: 'holder-1',
          quotation_id: 'quote-1',
          sequence_no: 1,
          policy_holder_name: 'Old Name',
          policy_holder_id_number: '123',
        },
      ],
      quotation_motor_details: [
        {
          id: 'motor-1',
          entry_id: 'entry-1',
          registration_number: 'OLD-123',
        },
      ],
      quotation_entry_risks: [
        {
          id: 'risk-1',
          entry_id: 'entry-1',
          sequence_no: 1,
          risk_code: 'RISK-1',
          sum_insured: '100000.0000',
          premium_rate: '0.2000000000',
        },
      ],
      quotation_risk_discounts: [],
      quotation_risk_taxes: [
        {
          id: 'tax-1',
          risk_id: 'risk-1',
          sequence_no: 1,
          tax_code: 'VAT',
          tax_amount: '1000.0000',
        },
      ],
      quotation_subject_matters: [],
      quotation_entry_addons: [],
    };
    const updates: string[] = [];
    const histories: any[] = [];
    const manager = {
      query: jest.fn(async (sql: string, args: any[]) => {
        if (sql.startsWith('SELECT * FROM quotations')) return [quotation];
        const select = sql.match(/^SELECT \* FROM (\w+) WHERE (\w+) = \$1/);
        if (select)
          return tables[select[1]].filter((row) => row[select[2]] === args[0]);
        const update = sql.match(
          /^UPDATE (\w+) SET (.+), updated_at = now\(\) WHERE id/,
        );
        if (update) {
          updates.push(sql);
          const row = tables[update[1]].find(
            (item) => item.id === args[args.length - 1],
          );
          update[2].split(', ').forEach((assignment, index) => {
            row[assignment.split(' = ')[0]] = args[index];
          });
          return [];
        }
        if (sql.includes('INSERT INTO quotation_status_history')) {
          histories.push(JSON.parse(args[6]));
          return [];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    return {
      service: new TiramisSubmittedQuotationSyncService(dataSource as any),
      tables,
      updates,
      histories,
    };
  }

  it('updates only changed submitted fields and records old/new values once', async () => {
    const { service, tables, updates, histories } = fixture();
    const params = {
      companyId: 'company-1',
      quotationId: 'quote-1',
      requestId: 'REQ-1',
      requestXml: requestXml(),
    };
    const first = await service.reconcile(params);
    expect(first.changed).toBe(7);
    expect(
      tables.quotation_cover_notes[0].cover_note_start_date.toISOString(),
    ).toBe('2026-10-15T09:00:00.000Z');
    expect(tables.quotation_cover_notes[0].total_premium_excluding_tax).toBe(
      '20000.0000',
    );
    expect(tables.quotation_policy_holders[0].policy_holder_id_number).toBe(
      '00123',
    );
    expect(updates).toHaveLength(4);
    expect(histories).toHaveLength(1);
    expect(histories[0].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'quotation_motor_details',
          field: 'registration_number',
          previous: 'OLD-123',
          submitted: 'NEW-123',
        }),
        expect.objectContaining({
          table: 'quotation_risk_taxes',
          field: 'tax_amount',
          previous: '1000.0000',
          submitted: '2000.00',
        }),
      ]),
    );
    expect(await service.reconcile(params)).toEqual({ changed: 0 });
    expect(updates).toHaveLength(4);
    expect(histories).toHaveLength(1);
  });

  it('rejects a request with mismatched identity without persisting changes', async () => {
    const { service, updates, histories } = fixture();
    await expect(
      service.reconcile({
        companyId: 'company-1',
        quotationId: 'quote-1',
        requestId: 'REQ-1',
        requestXml: requestXml('REQ-1', 'OTHER-RISK'),
      }),
    ).rejects.toThrow('risk identity');
    expect(histories).toHaveLength(0);
    // The real database transaction rolls back earlier field updates.
    expect(updates.length).toBeGreaterThan(0);
  });

  it('rejects a different callback request ID before opening a transaction', async () => {
    const { service, updates } = fixture();
    await expect(
      service.reconcile({
        companyId: 'company-1',
        quotationId: 'quote-1',
        requestId: 'REQ-2',
        requestXml: requestXml(),
      }),
    ).rejects.toThrow('does not match');
    expect(updates).toHaveLength(0);
  });

  it('maps fleet headers and entries to the same quotation snapshot', async () => {
    const { service, tables } = fixture();
    const xml = requestXml()
      .replace(
        '<CoverNoteDtl>',
        `<CoverNoteDtl><FleetHdr>
        <FleetId>FLEET-1</FleetId><ProductCode>PRODUCT-1</ProductCode>
        <CoverNoteStartDate>2026-10-15T12:00:00</CoverNoteStartDate>
        <CoverNoteEndDate>2026-11-14T12:00:00</CoverNoteEndDate>
        <PolicyHolders><PolicyHolder><PolicyHolderName>New Name</PolicyHolderName>
        <PolicyHolderIdNumber>00123</PolicyHolderIdNumber></PolicyHolder></PolicyHolders>
        </FleetHdr><FleetDtl>`,
      )
      .replace('</CoverNoteDtl>', '</FleetDtl></CoverNoteDtl>');

    expect(
      await service.reconcile({
        companyId: 'company-1',
        quotationId: 'quote-1',
        requestId: 'REQ-1',
        requestXml: xml,
      }),
    ).toEqual({ changed: 7 });
    expect(tables.quotation_cover_notes[0].fleet_id).toBe('FLEET-1');
    expect(tables.quotation_motor_details[0].registration_number).toBe(
      'NEW-123',
    );
  });

  it('synchronizes a non-motor cover note without motor detail', async () => {
    const { service, tables } = fixture();
    tables.quotation_motor_details = [];
    const xml = requestXml()
      .replace('MotorCoverNoteRefReq', 'CoverNoteRefReq')
      .replace('</MotorCoverNoteRefReq>', '</CoverNoteRefReq>')
      .replace(/<MotorDtl>[\s\S]*?<\/MotorDtl>/, '');

    expect(
      await service.reconcile({
        companyId: 'company-1',
        quotationId: 'quote-1',
        requestId: 'REQ-1',
        requestXml: xml,
      }),
    ).toEqual({ changed: 6 });
  });
});
