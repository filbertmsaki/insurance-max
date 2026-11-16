import { PricingChargeService } from './pricing-charge.service';
import { Repository } from 'typeorm';
import { Tax } from '../../taxes/entities/tax.entity';

describe('Selected catalogue taxes', () => {
  it('preserves an explicitly evidenced exemption through the shared calculator', async () => {
    const { service } = fixture();
    const result = await service.calculateCharges('company', {
      basic_premium: 100,
      net_premium: 100,
      gross_premium: 100,
      tax_codes: ['VAT-MAINLAND'],
      tax_exemptions: [
        {
          tax_code: 'VAT-MAINLAND',
          type: 'SYNTHETIC-EXEMPTION',
          reference: 'SYNTHETIC-APPROVAL',
        },
      ],
    });
    expect(result.premium_including_charges).toBe(100);
    expect(result.charges[0]).toMatchObject({
      rate: 0.18,
      computed_amount: 0,
      is_exempt: true,
      exemption_reference: 'SYNTHETIC-APPROVAL',
    });
  });
  it('refuses missing, duplicate and unselected exemption evidence', async () => {
    const { service } = fixture();
    for (const tax_exemptions of [
      [{ tax_code: 'VAT-MAINLAND', type: '', reference: '' }],
      [{ tax_code: 'OTHER', type: 'TYPE', reference: 'REF' }],
      [
        { tax_code: 'VAT-MAINLAND', type: 'TYPE', reference: 'REF' },
        { tax_code: 'VAT-MAINLAND', type: 'TYPE', reference: 'REF' },
      ],
    ])
      await expect(
        service.calculateCharges('company', {
          basic_premium: 100,
          net_premium: 100,
          gross_premium: 100,
          tax_codes: ['VAT-MAINLAND'],
          tax_exemptions,
        }),
      ).rejects.toThrow('exemption');
  });
  const catalogue = [
    { id: 'vat', tax_code: 'VAT-MAINLAND', tax_name: 'VAT', tax_rate: '0.18' },
    {
      id: 'withholding',
      tax_code: 'WITHHOLDING',
      tax_name: 'Withholding',
      tax_rate: '0.10',
    },
  ];
  function fixture() {
    const repository = {
      find: jest.fn().mockResolvedValue(catalogue),
      findOne: jest.fn().mockResolvedValue(catalogue[0]),
    };
    return {
      repository,
      service: new PricingChargeService(
        repository as unknown as Repository<Tax>,
      ),
    };
  }
  const premium = {
    basic_premium: 120000,
    gross_premium: 120000,
    net_premium: 100000,
  };
  it.each([undefined, null])(
    'uses the configured default tax for an omitted selection (%s)',
    async (tax_codes) => {
      const { service, repository } = fixture();
      const result = await service.calculateCharges('company', {
        ...premium,
        tax_codes,
      });
      expect(result.charges).toHaveLength(1);
      expect(result.charges[0]).toEqual(
        expect.objectContaining({
          charge_code: 'VAT-MAINLAND',
          computed_amount: 18000,
        }),
      );
      expect(result.premium_including_charges).toBe(118000);
      expect(repository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'company',
            is_active: true,
            is_default: true,
          }),
        }),
      );
    },
  );
  it('does not add taxes for an explicitly empty selection', async () => {
    const { service, repository } = fixture();
    const result = await service.calculateCharges('company', {
      ...premium,
      tax_codes: [],
    });
    expect(result.charges).toEqual([]);
    expect(result.premium_including_charges).toBe(100000);
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.find).not.toHaveBeenCalled();
  });
  it('uses only selected codes and the stored rate on the net premium', async () => {
    const { service, repository } = fixture();
    const result = await service.calculateCharges('company', {
      ...premium,
      tax_codes: ['vat-mainland'],
    });
    expect(result.charges).toEqual([
      expect.objectContaining({
        charge_code: 'VAT-MAINLAND',
        rate: 0.18,
        computed_amount: 18000,
      }),
    ]);
    expect(result.premium_including_charges).toBe(118000);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company_id: 'company',
          is_active: true,
        }),
      }),
    );
  });
  it('sums multiple selected taxes, normalizes codes and avoids duplicate charges', async () => {
    const { service } = fixture();
    const result = await service.calculateCharges('company', {
      ...premium,
      tax_codes: [' VAT-MAINLAND ', 'WITHHOLDING', 'vat-mainland'],
    });
    expect(result.charges).toHaveLength(2);
    expect(result.total_charge_amount).toBe(28000);
    expect(result.premium_including_charges).toBe(128000);
  });
  it('rejects unknown, inactive, deleted or other-company selections', async () => {
    const { service, repository } = fixture();
    repository.find.mockResolvedValue([]);
    await expect(
      service.calculateCharges('company', {
        ...premium,
        tax_codes: ['VAT-MAINLAND'],
      }),
    ).rejects.toThrow('unavailable');
  });
  it('rounds each selected tax amount to money precision', async () => {
    const { service } = fixture();
    const result = await service.calculateCharges('company', {
      ...premium,
      net_premium: 12345.67,
      tax_codes: ['VAT-MAINLAND', 'WITHHOLDING'],
    });
    expect(result.charges.map((tax) => tax.computed_amount)).toEqual([
      2222.22, 1234.57,
    ]);
    expect(result.total_charge_amount).toBe(3456.79);
  });
  it('freezes inclusive calculation basis and effective-dated category/account evidence', async () => {
    const { service, repository } = fixture();
    repository.find.mockResolvedValue([
      {
        ...catalogue[0],
        calculation_options: {
          category: 'LEVY',
          effective_from: '2026-01-01',
          effective_to: '2026-12-31',
          ledger_account_code: '4210',
        },
      },
    ]);
    const result = await service.calculateCharges('company', {
      ...premium,
      tax_codes: ['VAT-MAINLAND'],
      effective_date: '2026-06-01',
      tax_inclusive_premium: 118,
    });
    expect(result.premium_including_charges).toBe(118);
    expect(result.charges[0]).toMatchObject({
      base_amount: 100,
      computed_amount: 18,
      charge_category: 'LEVY',
      price_basis: 'INCLUSIVE',
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      ledger_account_code: '4210',
    });
  });
  it('rejects a selected tax outside its configured effective dates', async () => {
    const { service, repository } = fixture();
    repository.find.mockResolvedValue([
      {
        ...catalogue[0],
        calculation_options: { effective_from: '2027-01-01' },
      },
    ]);
    await expect(
      service.calculateCharges('company', {
        ...premium,
        tax_codes: ['VAT-MAINLAND'],
        effective_date: '2026-06-01',
      }),
    ).rejects.toThrow('not effective');
  });
  it('does not turn an absent configured tax rate into zero', async () => {
    const { service, repository } = fixture();
    repository.find.mockResolvedValue([{ ...catalogue[0], tax_rate: null }]);
    await expect(
      service.calculateCharges('company', {
        ...premium,
        tax_codes: ['VAT-MAINLAND'],
      }),
    ).rejects.toThrow('missing tax evidence');
  });
});
