import { TiramisXmlParserService } from './tiramis-xml-parser.service';

describe('TiramisXmlParserService cover note verification responses', () => {
  it('parses response status values from CoverNoteHdr', () => {
    const parser = new TiramisXmlParserService();
    const message = parser.parseTiraMessage(`
      <TiraMsg>
        <CoverNoteVerificationRes>
          <CoverNoteHdr>
            <ResponseId>RESP-001</ResponseId>
            <RequestId>REQ-001</RequestId>
            <ResponseStatusCode>TIRA005</ResponseStatusCode>
            <ResponseStatusDesc>Invalid or incomplete request data</ResponseStatusDesc>
          </CoverNoteHdr>
        </CoverNoteVerificationRes>
        <MsgSignature>RESPONSE_SIGNATURE</MsgSignature>
      </TiraMsg>
    `);

    const content = message.content as any;
    const header = content.CoverNoteHdr;

    expect(message.rootName).toBe('CoverNoteVerificationRes');
    expect(header.ResponseId).toBe('RESP-001');
    expect(header.RequestId).toBe('REQ-001');
    expect(header.ResponseStatusCode).toBe('TIRA005');
    expect(header.ResponseStatusDesc).toBe(
      'Invalid or incomplete request data',
    );
    expect(message.signature).toBe('RESPONSE_SIGNATURE');
  });

  it('extracts the exact business XML before MsgSignature', () => {
    const parser = new TiramisXmlParserService();
    const contentXml =
      '<MotorVerificationRes><VerificationHdr><ResponseStatusCode>TIRA001</ResponseStatusCode></VerificationHdr><VerificationDtl><MotorRegistrationNumber>T665csf</MotorRegistrationNumber></VerificationDtl></MotorVerificationRes>';

    const message = parser.parseTiraMessage(
      `<TiraMsg>${contentXml}<MsgSignature>RESPONSE_SIGNATURE</MsgSignature></TiraMsg>`,
    );

    expect(message.contentXml).toBe(contentXml);
  });

  it('extracts fleet callback status values from FleetResHdr', () => {
    const parser = new TiramisXmlParserService();
    const response = parser.extractFinalResponse(`
      <TiraMsg>
        <MotorCoverNoteRefRes>
          <FleetResHdr>
            <ResponseId>TIRA22424232355</ResponseId>
            <RequestId>YOURS22424232355</RequestId>
            <FleetId>FL122340</FleetId>
            <FleetStatusCode>TIRA001</FleetStatusCode>
            <FleetStatusDesc>Successful</FleetStatusDesc>
          </FleetResHdr>
          <FleetResDtl>
            <FleetEntry>1</FleetEntry>
            <CoverNoteNumber>NIC00004</CoverNoteNumber>
            <CoverNoteReferenceNumber>23579-00033-25251</CoverNoteReferenceNumber>
            <StickerNumber>33245-24444-52533</StickerNumber>
            <ResponseStatusCode>TIRA001</ResponseStatusCode>
            <ResponseStatusDesc>Successful</ResponseStatusDesc>
          </FleetResDtl>
        </MotorCoverNoteRefRes>
        <MsgSignature>RESPONSE_SIGNATURE</MsgSignature>
      </TiraMsg>
    `);

    expect(response.requestId).toBe('YOURS22424232355');
    expect(response.responseId).toBe('TIRA22424232355');
    expect(response.responseStatusCode).toBe('TIRA001');
    expect(response.responseStatusDesc).toBe('Successful');
  });
});
