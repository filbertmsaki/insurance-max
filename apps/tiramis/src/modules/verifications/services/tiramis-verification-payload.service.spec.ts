import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { MotorCategory } from '../constants/tiramis-verification.constants';
import { TiramisVerificationPayloadService } from './tiramis-verification-payload.service';

describe('TiramisVerificationPayloadService motor verification', () => {
  it('builds the required motor XML fields in the required order', () => {
    const payloadService = new TiramisVerificationPayloadService();
    const xmlBuilder = new TiramisXmlBuilderService();
    const payload = payloadService.buildMotorVerification(
      {
        motorCategory: MotorCategory.MOTOR_VEHICLE,
        motorRegistrationNumber: 't665csf',
        motorChassisNumber: null,
        companyCode: 'ICC110',
        systemCode: 'LSYS_ALLIANCE_001',
      } as any,
      'AIC20260801234353476763',
    );

    const xml = xmlBuilder.buildContentXml('MotorVerificationReq', payload);

    expect(xml).toContain('<MotorCategory>1</MotorCategory>');
    expect(xml).toContain('<RegistrationNumber>t665csf</RegistrationNumber>');
    expect(xml).toContain('<ChassisNumber></ChassisNumber>');
    expect(xml.indexOf('<MotorCategory>')).toBeLessThan(
      xml.indexOf('<RegistrationNumber>'),
    );
    expect(xml.indexOf('<RegistrationNumber>')).toBeLessThan(
      xml.indexOf('<ChassisNumber>'),
    );

    const signedXml = xmlBuilder.buildSignedTiraMessage({
      rootName: 'MotorVerificationReq',
      payload,
      signature: 'GENERATED_SIGNATURE',
      includeXmlDeclaration: true,
    });

    expect(signedXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
  });
});
