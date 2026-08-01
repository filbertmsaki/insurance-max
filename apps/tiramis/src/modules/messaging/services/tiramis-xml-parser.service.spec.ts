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
});
