import { BadRequestException } from '@nestjs/common';

import { CreateReinsuranceDto } from '../dto/create-reinsurance.dto';
import { TiramisReinsuranceService } from './tiramis-reinsurance.service';

describe('TiramisReinsuranceService validation', () => {
  const service = new TiramisReinsuranceService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const validPayload = (): CreateReinsuranceDto => ({
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
  });

  function validate(payload: CreateReinsuranceDto) {
    return (service as any).validatePayload(payload);
  }

  it('accepts a valid placement whose participant shares total 100%', () => {
    expect(() => validate(validPayload())).not.toThrow();
  });

  it('allows partial placements while preventing total shares above 100%', () => {
    const payload = validPayload();
    payload.participants = [
      { ...payload.participants[0], premiumShare: '60.00' },
      {
        ...payload.participants[0],
        participantCode: 'RE002',
        premiumShare: '40.00',
      },
    ];
    expect(() => validate(payload)).not.toThrow();

    payload.participants[1].premiumShare = '41.00';
    expect(() => validate(payload)).toThrow(BadRequestException);
  });

  it('rejects malformed money and non-positive rates', () => {
    const payload = validPayload();
    payload.exchangeRate = '0';

    try {
      validate(payload);
      throw new Error('Expected the payload to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errors: expect.arrayContaining([
          'exchangeRate must be a positive decimal amount',
        ]),
      });
    }

    payload.premiumIncludingTax = 'not-a-number';
    expect(() => validate(payload)).toThrow(BadRequestException);
  });
});
