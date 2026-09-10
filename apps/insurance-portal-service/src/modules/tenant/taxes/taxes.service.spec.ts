import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TaxesService } from './taxes.service';
import { Tax } from './entities/tax.entity';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';

describe('Taxes catalogue management', () => {
  const tax = {
    id: 'tax',
    company_id: 'company',
    tax_code: 'VAT',
    tax_name: 'VAT',
    tax_rate: '0.1800000000',
    is_active: true,
  };
  function fixture() {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ ...tax }),
      find: jest.fn().mockResolvedValue([tax]),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      softDelete: jest.fn(),
    };
    return {
      repository,
      service: new TaxesService(repository as unknown as Repository<Tax>),
    };
  }
  it('scopes creation to the authenticated company and stores decimal rates', async () => {
    const { service } = fixture();
    expect(
      await service.create('company', {
        tax_code: 'VAT',
        tax_name: 'VAT',
        tax_rate: 0.18,
        is_active: true,
      }),
    ).toMatchObject({ company_id: 'company', tax_rate: '0.1800000000' });
  });
  it('edits the name, rate and availability without changing the code', async () => {
    const { service, repository } = fixture();
    expect(
      await service.update('company', 'tax', {
        tax_name: 'Value added tax',
        tax_rate: 0.2,
        is_active: false,
      }),
    ).toMatchObject({
      tax_code: 'VAT',
      tax_rate: '0.2000000000',
      is_active: false,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'tax', company_id: 'company' },
    });
    await expect(
      service.update('company', 'tax', { tax_code: 'NEW' }),
    ).rejects.toThrow('cannot be changed');
  });
  it('does not update or delete another tenant’s tax', async () => {
    const { service, repository } = fixture();
    repository.findOne.mockResolvedValue(null);
    await expect(
      service.update('other', 'tax', { tax_name: 'Changed' }),
    ).rejects.toThrow('not found');
    await expect(service.remove('other', 'tax')).rejects.toThrow('not found');
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
  it('soft deletes definitions so historical quotation codes remain reserved', async () => {
    const { service, repository } = fixture();
    await service.remove('company', 'tax');
    expect(repository.softDelete).toHaveBeenCalledWith({
      id: 'tax',
      company_id: 'company',
    });
  });
  it('validates normalized codes, decimal rates and null updates', async () => {
    const dto = plainToInstance(CreateTaxDto, {
      tax_code: ' vat ',
      tax_name: ' VAT ',
      tax_rate: 0.18,
      is_active: true,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.tax_code).toBe('VAT');
    expect(
      (await validate(plainToInstance(CreateTaxDto, { ...dto, tax_rate: 18 })))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(UpdateTaxDto, { tax_rate: null })))
        .length,
    ).toBeGreaterThan(0);
  });
});
