import { TiramisSignatureService } from './tiramis-signature.service';

describe('TiramisSignatureService', () => {
  it('preserves XML whitespace when preparing content for signing', () => {
    const service = new TiramisSignatureService();
    const content =
      '<MotorVerificationReq>\n  <A>1</A>\n</MotorVerificationReq>';

    expect((service as any).normalizeXmlForSignature(content)).toBe(content);
  });

  it('removes only the XML declaration before signing', () => {
    const service = new TiramisSignatureService();
    const content =
      '<?xml version="1.0" encoding="UTF-8"?>\n<MotorVerificationReq>\n  <A>1</A>\n</MotorVerificationReq>';

    expect((service as any).normalizeXmlForSignature(content)).toBe(
      '<MotorVerificationReq>\n  <A>1</A>\n</MotorVerificationReq>',
    );
  });
});
