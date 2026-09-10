import { PricingChargeService } from './pricing-charge.service';
import { Repository } from 'typeorm';
import { Tax } from '../../taxes/entities/tax.entity';

describe('Selected catalogue taxes', () => {
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
    const repository = { find: jest.fn().mockResolvedValue(catalogue) };
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
  it.each([undefined, null, []])(
    'does not add taxes for an empty or omitted selection (%s)',
    async (tax_codes) => {
      const { service, repository } = fixture();
      const result = await service.calculateCharges('company', {
        ...premium,
        tax_codes,
      });
      expect(result.charges).toEqual([]);
      expect(result.premium_including_charges).toBe(100000);
      expect(repository.find).not.toHaveBeenCalled();
    },
  );
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
});
