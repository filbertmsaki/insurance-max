import { PDFDocument } from 'pdf-lib';
import {
  amountInWords,
  documentFileName,
  formatDate,
  issuerOf,
  money,
  paymentInstructionFields,
  type BrandedDocument,
} from './branded-document';
import { renderBrandedDocument } from './branded-document.renderer';
import {
  buildInvoiceDocument,
  buildReceiptDocument,
} from './finance-document.model';
import { buildPolicySchedule } from './policy-schedule.model';
import {
  buildQuotationDocument,
  insuranceDetailFields,
} from './quotation-document.model';
import { SHORT_TERM_RISK_CODE } from '../quotations/approval-policy/quotation-approval-policy';

const insurer = {
  name: 'Alliance Insurance Corporation',
  contact_phone: '+255 22 000 0000',
  contact_email: 'info@alliance.example',
  website: 'www.alliance.example',
  tin: '100-200-300',
  tira_license_number: 'TIRA/001',
  brela_registration_number: '12345',
  address: {
    street: 'Ohio Street',
    city: 'Dar es Salaam',
    country: 'Tanzania',
  },
  settings: {
    payment_details: {
      bank_name: 'CRDB Bank',
      account_name: 'Alliance Insurance Corporation',
      account_number: '0150000000000',
      swift_code: 'CORUTZTZ',
      mobile_money_number: '0700000000',
      vrn: '40-000000-A',
    },
  },
};

const customer = {
  customer_no: 'CUS-001',
  customer_type: 'INDIVIDUAL',
  first_name: 'Amani',
  middle_name: 'Juma',
  last_name: 'Mashauri',
  nida_no: '19900101-12345-00001-12',
  phone: '+255 700 000 001',
  email: 'amani@example.com',
  postal_address: '123',
  street: 'Mikocheni',
  district: 'Kinondoni',
  region: 'Dar es Salaam',
};

async function pages(doc: BrandedDocument) {
  const bytes = await renderBrandedDocument(doc);
  return (await PDFDocument.load(bytes)).getPageCount();
}

function allText(doc: BrandedDocument) {
  const out: string[] = [
    doc.title,
    doc.subtitle,
    ...doc.issuerLines,
    ...doc.reference.flatMap((f) => [f.label, f.value]),
  ];
  for (const section of doc.sections) {
    out.push(section.title);
    for (const block of section.blocks) out.push(JSON.stringify(block));
  }
  return out.join('\n');
}

describe('shared document base', () => {
  it('formats money, dates, words and file names the same way everywhere', () => {
    expect(money('TZS', 23600)).toBe('TSh 23,600.00');
    expect(money('USD', 10.5)).toBe('USD 10.50');
    expect(formatDate('2026-11-09')).toBe('9 Nov 2026');
    expect(amountInWords(23600, 'TZS')).toBe(
      'Twenty-three thousand six hundred Tanzanian shillings only',
    );
    expect(amountInWords(1250.5, 'TZS')).toBe(
      'One thousand two hundred and fifty Tanzanian shillings and fifty cents only',
    );
    expect(documentFileName('Quotation', 'AICL261109011')).toBe(
      'Quotation_AICL261109011.pdf',
    );
    expect(documentFileName('Policy', 'P11/2026/100')).toBe(
      'Policy_P11-2026-100.pdf',
    );
  });

  it('builds the letterhead and payment details from the company record', () => {
    const issuer = issuerOf(insurer, null);
    expect(issuer.issuerLines.join(' ')).toContain('VRN: 40-000000-A');
    expect(issuer.issuerRegistration).toContain('TIRA Licence No. TIRA/001');
    expect(
      paymentInstructionFields(insurer, '991234').map((f) => f.label),
    ).toEqual([
      'Control Number',
      'Bank',
      'Account Name',
      'Account Number',
      'SWIFT Code',
      'Mobile Money',
    ]);
    // Nothing configured: the block disappears instead of printing blanks.
    expect(paymentInstructionFields({ name: 'X' })).toEqual([]);
  });
});

describe('tax invoice', () => {
  const invoice = {
    invoice_no: 'INV-2026-0001',
    status: 'PAID',
    currency: 'TZS',
    gross_amount: '20000.00',
    discount_amount: '0.00',
    charges_amount: '0.00',
    tax_amount: '3600.00',
    total_amount: '23600.00',
    paid_amount: '23600.00',
    balance_amount: '0.00',
    issued_at: '2026-11-09T10:00:00Z',
    due_date: '2026-11-23',
    customer,
    quotation: { quotation_no: 'AICL261109011' },
    policy: { policy_no: 'P11/2026/100/1017/11/00000004' },
    items: [
      {
        item_name: 'Quotation AICL261109011',
        description: 'Insurance premium for quotation AICL261109011',
        quantity: '1.00',
        unit_amount: '23600.00',
        total_amount: '23600.00',
      },
    ],
  };

  it('splits the premium into price and VAT and shows the balance due', async () => {
    const doc = buildInvoiceDocument({
      invoice,
      issuer: insurer,
      logo: null,
      controlNumber: '991234567890',
    });
    expect(doc.title).toBe('TAX INVOICE');
    expect(doc.badge).toEqual({ text: 'PAID', tone: 'success' });
    const items = doc.sections.find((s) => s.title === 'Invoice Items')!;
    const table = items.blocks[0] as Extract<
      (typeof items.blocks)[number],
      { kind: 'table' }
    >;
    expect(table.rows[0].slice(1)).toEqual([
      '1',
      '20,000.00',
      '18%',
      '3,600.00',
      '23,600.00',
    ]);
    const totals = items.blocks[1] as Extract<
      (typeof items.blocks)[number],
      { kind: 'premium' }
    >;
    expect(totals.total).toBe('TSh 23,600.00');
    expect(totals.words).toBe(
      'Twenty-three thousand six hundred Tanzanian shillings only',
    );
    expect(totals.after?.map((l) => l.label)).toEqual([
      'Amount paid',
      'Balance due',
    ]);
    const text = allText(doc);
    expect(text).toContain('991234567890');
    expect(text).toContain('CRDB Bank');
    expect(text).not.toMatch(/\bN\/A\b|undefined|null/);
    expect(await pages(doc)).toBeGreaterThanOrEqual(1);
  });

  it('stamps draft and void invoices', () => {
    expect(
      buildInvoiceDocument({
        invoice: { ...invoice, status: 'DRAFT' },
        issuer: insurer,
        logo: null,
      }).watermark,
    ).toBe('DRAFT');
    expect(
      buildInvoiceDocument({
        invoice: { ...invoice, status: 'VOID' },
        issuer: insurer,
        logo: null,
      }).watermark,
    ).toBe('VOID');
  });
});

describe('receipt', () => {
  const receipt = {
    receipt_no: 'RCT-2026-0001',
    status: 'RECEIVED',
    amount: '23600.00',
    allocated_amount: '23600.0000',
    unallocated_amount: '0.00',
    currency: 'TZS',
    payment_method: 'MOBILE_MONEY',
    payment_reference: 'MPX123',
    received_at: '2026-11-09T12:30:00Z',
    payer_name: 'Amani Juma Mashauri',
    customer,
    receiver: { first_name: 'Neema', last_name: 'Kato' },
  };
  const invoice = {
    invoice_no: 'INV-2026-0001',
    total_amount: '23600.00',
    balance_amount: '0.00',
    quotation: { quotation_no: 'AICL261109011' },
  };

  it('shows the amount in words and a PAID IN FULL stamp when settled', async () => {
    const doc = buildReceiptDocument({
      receipt,
      invoice,
      issuer: insurer,
      logo: null,
      transactionNo: 'TXN-1',
    });
    expect(doc.title).toBe('RECEIPT');
    const details = doc.sections.find((s) => s.title === 'Payment Details')!;
    expect(details.blocks.some((b) => b.kind === 'stamp')).toBe(true);
    const text = allText(doc);
    expect(text).toContain(
      'Twenty-three thousand six hundred Tanzanian shillings only',
    );
    expect(text).toContain('Mobile Money');
    expect(text).toContain('Neema Kato');
    expect(await pages(doc)).toBeGreaterThanOrEqual(1);
  });

  it('shows the remaining balance instead of the stamp when part-paid', () => {
    const doc = buildReceiptDocument({
      receipt: { ...receipt, amount: '10000.00' },
      invoice: { ...invoice, balance_amount: '13600.00' },
      issuer: insurer,
      logo: null,
    });
    const details = doc.sections.find((s) => s.title === 'Payment Details')!;
    expect(details.blocks.some((b) => b.kind === 'stamp')).toBe(false);
    expect(allText(doc)).toContain('Balance Remaining');
  });
});

describe('policy schedule', () => {
  const base = {
    insurer,
    logo: null,
    policyNo: 'P11/2026/100/1017/11/00000004',
    quotationNo: 'AICL261109011',
    coverNoteNo: '81603-99065-39949',
    stickerNo: '72209-78304',
    policyStatus: 'Active',
    issueDate: '9 Nov 2026',
    branch: 'HQ',
    preparedBy: 'Alliance Insurance Corporation',
    approvedBy: 'Alliance Insurance Corporation',
    intermediary: '',
    policyholder: [
      ['Full Name', 'AMANI JUMA MASHAURI'],
      ['Telephone', '+255 700 000 001'],
      ['Email', ''],
    ] as [string, unknown][],
    productName: 'Motor Private Vehicle',
    insuranceClass: 'Comprehensive',
    coverType: 'Motor',
    from: '9 Nov 2026',
    to: '8 Dec 2026',
    renewalDate: '9 Dec 2026',
    sumInsured: 'TZS 20,000,000.00',
    currency: 'TZS',
    premiumLines: [
      ['Basic Premium', '20,000.00'],
      ['VAT 18%', '3,600.00'],
    ] as [string, string][],
    totalAmount: 23600,
    verification: 'Policy: P11/2026/100/1017/11/00000004',
    watermark: '',
    motor: true,
    generatedAt: '9 Nov 2026, 14:32',
  };
  const vehicle = (n: number) => ({
    registrationNo: `T${String(n).padStart(3, '0')}ABC`,
    makeModelBody: 'Toyota / Hilux / Pickup',
    cc: '2400',
    year: '2020',
    sticker: `STK-${n}`,
    seating: '5',
    color: 'White',
    coverType: 'Private',
    estimatedValue: '20,000,000.00',
  });

  it('carries the policy, TIRA, wording and signatures on the shared layout', async () => {
    const doc = buildPolicySchedule({ ...base, vehicles: [vehicle(1)] });
    expect(doc.title).toBe('POLICY SCHEDULE');
    expect(doc.badge?.tone).toBe('success');
    const titles = doc.sections.map((s) => s.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Policyholder Details',
        'Insured Vehicle',
        'Premium Summary',
        'TIRA Details',
        'Policy Wording',
        'Authorisation',
      ]),
    );
    // Blank values are dropped, never printed.
    expect(allText(doc)).not.toContain('"Email"');
    expect(await pages(doc)).toBeGreaterThanOrEqual(2);
  });

  it('continues a large fleet table across pages', async () => {
    const small = await pages(
      buildPolicySchedule({ ...base, motor: false, vehicles: [vehicle(1)] }),
    );
    const large = await pages(
      buildPolicySchedule({
        ...base,
        motor: false,
        vehicles: Array.from({ length: 120 }, (_, i) => vehicle(i + 1)),
      }),
    );
    expect(large).toBeGreaterThan(small);
  });
});

describe('policy schedule insurance details', () => {
  it('prints the same Insurance Details as the quotation, with the policy dates', () => {
    const fields = insuranceDetailFields(
      {
        overview: {
          quotation_flow: 'MOTOR_SINGLE',
          product: { name: 'MOTOR PRIVATE VEHICLE' },
          insurance_category: { name: 'Motor' },
        },
        cover_note: { currency: 'TZS' },
        risks: [
          {
            risk_code: SHORT_TERM_RISK_CODE,
            risk_name: 'MOTOR Private Vehicles-Transit',
          },
        ],
        motor_details: {
          motor_category: 'Private Vehicle',
          motor_usage: 'Private',
        },
      },
      {
        start: '2026-11-09T11:33:00Z',
        end: '2026-12-08T20:59:00Z',
        currency: 'TZS',
      },
    );
    const get = (label: string) => fields.find((f) => f.label === label)?.value;
    expect(get('Insurance Class')).toBe('Motor');
    expect(get('Product')).toBe('MOTOR PRIVATE VEHICLE');
    expect(get('Type of Cover')).toBe('Short-Term (In-Transit) Cover');
    expect(get('Risk Covered')).toBe('MOTOR Private Vehicles-Transit');
    expect(get('Cover Start Date')).toBe('9 Nov 2026, 14:33');
    expect(get('Cover Expiry Date')).toBe('8 Dec 2026, 23:59');
    expect(get('Period of Insurance')).toBe('29 days');
    expect(get('Currency')).toBe('TZS');
    expect(get('Vehicle Classification')).toBe('Private Vehicle');
    expect(get('Vehicle Usage')).toBe('Private');
  });
});

describe('unregistered vehicles', () => {
  it('identifies a vehicle by chassis number when it has no registration', () => {
    const doc = buildQuotationDocument({
      quotation: { quotation_flow: 'MOTOR_SINGLE', quotation_no: 'Q-1' },
      preview: {
        overview: { quotation_flow: 'MOTOR_SINGLE', quotation_no: 'Q-1' },
        cover_note: { currency: 'TZS' },
        risks: [],
        motor_details: { registration_number: '', chassis_number: 'CHS-123' },
      },
    });
    const vehicle = doc.sections.find((s) => s.title === 'Vehicle Details')!;
    const fields = (
      vehicle.blocks[0] as { fields: { label: string; value: string }[] }
    ).fields;
    expect(fields.find((f) => f.label === 'Registration No.')?.value).toBe(
      'CHS-123 (chassis no.)',
    );
  });
});

describe('in-transit vehicles', () => {
  it('identifies short-term (transit) vehicles by chassis number', () => {
    const doc = buildQuotationDocument({
      quotation: { quotation_flow: 'MOTOR_SINGLE', quotation_no: 'Q-2' },
      preview: {
        overview: { quotation_flow: 'MOTOR_SINGLE', quotation_no: 'Q-2' },
        cover_note: { currency: 'TZS' },
        risks: [
          {
            risk_code: SHORT_TERM_RISK_CODE,
            risk_name: 'MOTOR Private Vehicles-Transit',
          },
        ],
        motor_details: {
          registration_number: 'T123ABC',
          chassis_number: 'CHS-999',
        },
      },
    });
    const vehicle = doc.sections.find((s) => s.title === 'Vehicle Details')!;
    const fields = (
      vehicle.blocks[0] as { fields: { label: string; value: string }[] }
    ).fields;
    expect(fields[0]).toEqual({ label: 'Chassis No.', value: 'CHS-999' });
    expect(fields.filter((f) => f.label === 'Chassis No.')).toHaveLength(1);
  });

  it('uses the chassis column on a transit policy schedule', () => {
    const doc = buildPolicySchedule({
      insurer: null,
      logo: null,
      policyNo: 'P-1',
      quotationNo: '',
      coverNoteNo: '',
      stickerNo: '',
      policyStatus: 'Active',
      issueDate: '',
      branch: '',
      preparedBy: '',
      approvedBy: '',
      intermediary: '',
      policyholder: [],
      productName: 'Motor',
      insuranceClass: '',
      coverType: '',
      from: '',
      to: '',
      renewalDate: '',
      sumInsured: '',
      currency: 'TZS',
      premiumLines: [],
      totalAmount: 0,
      verification: '',
      watermark: '',
      motor: false,
      transit: true,
      generatedAt: '',
      vehicles: [
        {
          registrationNo: 'T123ABC',
          chassisNo: 'CHS-999',
          makeModelBody: '',
          cc: '',
          year: '',
          sticker: '',
          seating: '',
          color: '',
          coverType: '',
          estimatedValue: '',
        },
      ],
    });
    const table = doc.sections.find((s) => s.title === 'Insured Vehicle')!
      .blocks[0] as { columns: { header: string }[]; rows: string[][] };
    expect(table.columns[0].header).toBe('Chassis No.');
    expect(table.rows[0][0]).toBe('CHS-999');
  });
});
