import { TiramisClientService } from './tiramis-client.service';
import { TIRAMIS_MESSAGE_PATTERNS } from '../constants/tiramis-message-patterns.constant';

describe('TiramisClientService', () => {
  const createService = () =>
    new TiramisClientService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any;

  it('strips portal-only callback URL fields from motor submit payloads', () => {
    const service = createService();

    const payload = service.httpPayload(TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR, {
      payload: {
        companyCode: 'COMPANY',
        systemCode: 'SYSTEM',
        insurerCompanyCode: 'INSURER',
        tranCompanyCode: 'TRANS',
        salePointCode: 'SP500',
        callbackUrl: 'https://portal.example.test/callback',
        callback_url: 'https://portal.example.test/callback-legacy',
        coverNoteNumber: 'CN-001',
      },
    });

    expect(payload).toEqual({
      coverNoteNumber: 'CN-001',
    });
  });

  it('keeps non-submission payloads unchanged', () => {
    const service = createService();
    const command = {
      callbackUrl: 'https://portal.example.test/callback',
      requestId: 'REQ-001',
    };

    expect(service.httpPayload(TIRAMIS_MESSAGE_PATTERNS.STATUS, command)).toBe(
      command,
    );
  });
});
