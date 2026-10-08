import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateReinsuranceDto } from './create-reinsurance.dto';

describe('CreateReinsuranceDto', () => {
  const validPayload = {
    coverNoteReferenceNumber: 'TIRA-CN-000001',
    premiumIncludingTax: '590000.00',
    currencyCode: 'TZS',
    exchangeRate: '1.00',
    authorizingOfficerName: 'Mock Underwriter',
    authorizingOfficerTitle: 'Underwriter',
    reinsuranceCategory: 1,
    participants: [
      {
        participantCode: 'RE001',
        participantType: 1,
        reinsuranceForm: 1,
        reinsuranceType: 1,
        reBrokerCode: 'BRK001',
        brokerageCommission: '5.00',
        reinsuranceCommission: '10.00',
        premiumShare: '100.00',
        participationDate: '2026-06-07T00:00:00',
      },
    ],
  };

  it('accepts a valid nested request and normalizes currency', async () => {
    const dto = plainToInstance(CreateReinsuranceDto, {
      ...validPayload,
      currencyCode: 'tzs',
    });

    expect(dto.currencyCode).toBe('TZS');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects missing required fields and invalid nested participants', async () => {
    const dto = plainToInstance(CreateReinsuranceDto, {
      ...validPayload,
      premiumIncludingTax: 'not-money',
      participants: [{ participantCode: '' }],
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain(
      'premiumIncludingTax',
    );
    expect(errors.map((error) => error.property)).toContain('participants');
    expect(
      errors[
        errors.findIndex((error) => error.property === 'participants')
      ].children?.[0].children?.map((error) => error.property),
    ).toEqual(expect.arrayContaining(['participantCode', 'premiumShare']));
  });
});
