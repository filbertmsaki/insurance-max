import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { MotorCategory } from '../constants/tiramis-verification.constants';
import { TiramisVerificationPayloadService } from './tiramis-verification-payload.service';

describe('TiramisVerificationPayloadService cover note verification', () => {
  it('builds all cover note fields in the required XML order', () => {
    const payloadService = new TiramisVerificationPayloadService();
    const xmlBuilder = new TiramisXmlBuilderService();
    const payload = payloadService.buildCoverNoteVerification(
      {
        coverNoteReferenceNumber: '4242424',
        stickerNumber: '1313-1414-124124',
        motorRegistrationNumber: 'T233SQA',
        motorChassisNumber: '4353646',
        companyCode: 'IC0003',
        systemCode: 'SYS0003',
      } as any,
      'NIC22424232355',
    );

    const xml = xmlBuilder.buildSignedTiraMessage({
      rootName: 'CoverNoteVerificationReq',
      payload,
      signature: 'GENERATED_SIGNATURE',
      includeXmlDeclaration: true,
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<CoverNoteReferenceNumber>4242424</CoverNoteReferenceNumber>',
    );
    expect(xml).toContain('<StickerNumber>1313-1414-124124</StickerNumber>');
    expect(xml).toContain(
      '<MotorRegistrationNumber>T233SQA</MotorRegistrationNumber>',
    );
    expect(xml).toContain('<MotorChassisNumber>4353646</MotorChassisNumber>');
    expect(xml.indexOf('<CoverNoteReferenceNumber>')).toBeLessThan(
      xml.indexOf('<StickerNumber>'),
    );
    expect(xml.indexOf('<StickerNumber>')).toBeLessThan(
      xml.indexOf('<MotorRegistrationNumber>'),
    );
    expect(xml.indexOf('<MotorRegistrationNumber>')).toBeLessThan(
      xml.indexOf('<MotorChassisNumber>'),
    );
  });

  it('omits optional fields that were not supplied and escapes values', () => {
    const payloadService = new TiramisVerificationPayloadService();
    const xmlBuilder = new TiramisXmlBuilderService();
    const payload = payloadService.buildCoverNoteVerification(
      {
        motorRegistrationNumber: 'T&233SQA',
        companyCode: 'IC0003',
        systemCode: 'SYS0003',
      } as any,
      'NIC22424232355',
    );

    const xml = xmlBuilder.buildContentXml('CoverNoteVerificationReq', payload);

    expect(xml).toContain(
      '<MotorRegistrationNumber>T&amp;233SQA</MotorRegistrationNumber>',
    );
    expect(xml).not.toContain('<CoverNoteReferenceNumber>');
    expect(xml).not.toContain('<StickerNumber>');
    expect(xml).not.toContain('<MotorChassisNumber>');
  });
});

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
