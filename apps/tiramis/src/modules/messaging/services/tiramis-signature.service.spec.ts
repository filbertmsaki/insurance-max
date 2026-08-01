import { generateKeyPairSync } from 'crypto';

import { TiramisSignatureService } from './tiramis-signature.service';

describe('TiramisSignatureService', () => {
  it('preserves XML whitespace when preparing content for signing', () => {
    const service = new TiramisSignatureService();
    const content =
      '<MotorVerificationReq>\n  <A>1</A>\n</MotorVerificationReq>';

    expect((service as any).normalizeXmlForSignature(content)).toBe(content);
  });

  it('does not remove declarations or alter signed content', () => {
    const service = new TiramisSignatureService();
    const content =
      '<?xml version="1.0" encoding="UTF-8"?>\n<MotorVerificationReq>\n  <A>1</A>\n</MotorVerificationReq>';

    expect((service as any).normalizeXmlForSignature(content)).toBe(content);
  });

  it('creates a SHA-1 RSA PKCS#1 signature verifiable with the public key', () => {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const service = new TiramisSignatureService();
    (service as any).loadPrivateKeyFromPfx = () => keyPair.privateKey;
    (service as any).loadPublicCertificate = () => keyPair.publicKey;
    const contentXml =
      '<MotorVerificationReq><VerificationDtl><MotorCategory>1</MotorCategory><MotorRegistrationNumber>T665csf</MotorRegistrationNumber><MotorChassisNumber></MotorChassisNumber></VerificationDtl></MotorVerificationReq>';

    const signature = service.signXmlContent({
      contentXml,
      privateKeyPfxPath: 'unused.pfx',
    });

    expect(
      service.verifyXmlContent({
        contentXml,
        signature,
        publicCertificatePfxPath: 'unused.pfx',
      }),
    ).toBe(true);
    expect(
      service.verifyXmlContent({
        contentXml: `${contentXml} `,
        signature,
        publicCertificatePfxPath: 'unused.pfx',
      }),
    ).toBe(false);
  });
});
