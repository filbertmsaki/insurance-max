const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveFinalStatus,
} = require('../src/services/tiramis-handler.service');
const {
  buildAsyncFinalResponseContent,
  buildTiraMessage,
  buildRawTiraMessage,
} = require('../src/services/response-builder.service');
const {
  resolveMockResponseData,
} = require('../src/services/mock-response-data.service');

test('cover cancellation endorsement returns the cancellation success response', () => {
  const result = resolveFinalStatus({
    scenario: 'success',
    contentXml: '<CoverNoteType>3</CoverNoteType><EndorsementType>4</EndorsementType>',
  });

  assert.deepEqual(result, {
    code: 'TIRA214',
    desc: 'Transaction successfully cancelled',
  });
});

test('new business and other endorsement types retain normal behavior', () => {
  assert.deepEqual(
    resolveFinalStatus({
      scenario: 'success',
      contentXml: '<CoverNoteType>1</CoverNoteType>',
    }),
    { code: 'TIRA001', desc: 'Successful' },
  );

  assert.deepEqual(
    resolveFinalStatus({
      scenario: 'success',
      contentXml: '<CoverNoteType>3</CoverNoteType><EndorsementType>2</EndorsementType>',
    }),
    { code: 'TIRA001', desc: 'Successful' },
  );
});

test('cancellation callback retains the standard response envelope fields', () => {
  const content = buildAsyncFinalResponseContent(
    'MotorCoverNoteRefReq',
    'REQ-CANCEL-1',
    'TIRA214',
    'Transaction successfully cancelled',
    { responseId: 'RES-CANCEL-1' },
  );
  const message = buildTiraMessage(content, () => 'SIGNATURE');

  assert.match(content, /<RequestId>REQ-CANCEL-1<\/RequestId>/);
  assert.match(content, /<ResponseId>RES-CANCEL-1<\/ResponseId>/);
  assert.match(content, /<ResponseStatusCode>TIRA214<\/ResponseStatusCode>/);
  assert.match(
    content,
    /<ResponseStatusDesc>Transaction successfully cancelled<\/ResponseStatusDesc>/,
  );
  assert.match(message, /<MsgSignature>SIGNATURE<\/MsgSignature>/);
});

test('motor callback uses the raw TIRA envelope and required field order', () => {
  const content = buildAsyncFinalResponseContent(
    'MotorCoverNoteRefReq',
    'AIC20260820231302938144',
    'TIRA001',
    'Successful',
    {
      responseId: '202607191123294522872',
      responseData: {
        motorCoverNoteReferenceNumber: '11026-19427-56213',
        stickerNumber: '26001-19481-73513',
      },
    },
  );
  const message = buildRawTiraMessage(content, () => 'SIGNATURE');

  assert.equal(
    message,
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<TiraMsg><MotorCoverNoteRefRes>' +
      '<ResponseId>202607191123294522872</ResponseId>' +
      '<RequestId>AIC20260820231302938144</RequestId>' +
      '<CoverNoteReferenceNumber>11026-19427-56213</CoverNoteReferenceNumber>' +
      '<StickerNumber>26001-19481-73513</StickerNumber>' +
      '<ResponseStatusCode>TIRA001</ResponseStatusCode>' +
      '<ResponseStatusDesc>Successful</ResponseStatusDesc>' +
      '</MotorCoverNoteRefRes><MsgSignature>SIGNATURE</MsgSignature></TiraMsg>',
  );
  assert.doesNotMatch(message, /<Content>/);
});

test('motor callback automatically generates stable TIRA-style references', () => {
  const first = buildAsyncFinalResponseContent(
    'MotorCoverNoteRefReq',
    'AIC-AUTO-REFERENCE-1',
    'TIRA001',
    'Successful',
  );
  const retry = buildAsyncFinalResponseContent(
    'MotorCoverNoteRefReq',
    'AIC-AUTO-REFERENCE-1',
    'TIRA001',
    'Successful',
  );

  const coverReference = first.match(
    /<CoverNoteReferenceNumber>([^<]+)<\/CoverNoteReferenceNumber>/,
  )?.[1];
  const stickerNumber = first.match(/<StickerNumber>([^<]+)<\/StickerNumber>/)?.[1];

  assert.match(coverReference, /^\d{5}-\d{5}-\d{5}$/);
  assert.match(stickerNumber, /^\d{5}-\d{5}-\d{5}$/);
  assert.notEqual(coverReference, stickerNumber);
  assert.match(retry, new RegExp(`<CoverNoteReferenceNumber>${coverReference}</`));
  assert.match(retry, new RegExp(`<StickerNumber>${stickerNumber}</`));
});

test('motor fleet callback returns a header and one response detail per vehicle', () => {
  const requestId = 'YOURS22424232355';
  const requestXml =
    '<MotorCoverNoteRefReq><CoverNoteDtl>' +
    '<FleetHdr><FleetId>FL122340</FleetId></FleetHdr>' +
    '<FleetDtl><FleetEntry>1</FleetEntry><CoverNoteNumber>NIC00004</CoverNoteNumber></FleetDtl>' +
    '<FleetDtl><FleetEntry>2</FleetEntry><CoverNoteNumber>NIC00005</CoverNoteNumber></FleetDtl>' +
    '</CoverNoteDtl></MotorCoverNoteRefReq>';
  const responseData = resolveMockResponseData({
    root: 'MotorCoverNoteRefReq',
    requestId,
    xml: requestXml,
  });
  const content = buildAsyncFinalResponseContent(
    'MotorCoverNoteRefReq',
    requestId,
    'TIRA001',
    'Successful',
    { responseId: 'TIRA22424232355', responseData },
  );

  assert.match(
    content,
    /^<MotorCoverNoteRefRes><FleetResHdr><ResponseId>TIRA22424232355<\/ResponseId><RequestId>YOURS22424232355<\/RequestId><FleetId>FL122340<\/FleetId><FleetStatusCode>TIRA001<\/FleetStatusCode><FleetStatusDesc>Successful<\/FleetStatusDesc><\/FleetResHdr>/,
  );
  assert.equal((content.match(/<FleetResDtl>/g) || []).length, 2);
  assert.match(content, /<FleetEntry>1<\/FleetEntry><CoverNoteNumber>NIC00004<\/CoverNoteNumber>/);
  assert.match(content, /<FleetEntry>2<\/FleetEntry><CoverNoteNumber>NIC00005<\/CoverNoteNumber>/);
  assert.equal(
    (content.match(/<CoverNoteReferenceNumber>\d{5}-\d{5}-\d{5}<\/CoverNoteReferenceNumber>/g) || []).length,
    2,
  );
  assert.equal(
    (content.match(/<StickerNumber>\d{5}-\d{5}-\d{5}<\/StickerNumber>/g) || []).length,
    2,
  );
});

test('motor fleet failure returns empty references and an item-level failure', () => {
  const requestId = 'YOURS22424232355';
  const requestXml =
    '<MotorCoverNoteRefReq><CoverNoteDtl>' +
    '<FleetHdr><FleetId>FL122340</FleetId></FleetHdr>' +
    '<FleetDtl><FleetEntry>1</FleetEntry><CoverNoteNumber>NIC00004</CoverNoteNumber></FleetDtl>' +
    '<FleetDtl><FleetEntry>2</FleetEntry><CoverNoteNumber>NIC00005</CoverNoteNumber></FleetDtl>' +
    '</CoverNoteDtl></MotorCoverNoteRefReq>';
  const responseData = resolveMockResponseData({
    root: 'MotorCoverNoteRefReq',
    requestId,
    xml: requestXml,
  });
  const content = buildAsyncFinalResponseContent(
    'MotorCoverNoteRefReq',
    requestId,
    'TIRA002',
    'Failure',
    { responseId: 'TIRA22424232355', responseData },
  );

  assert.match(content, /<FleetStatusCode>TIRA002<\/FleetStatusCode><FleetStatusDesc>Failure<\/FleetStatusDesc>/);
  assert.equal(
    (content.match(/<CoverNoteReferenceNumber><\/CoverNoteReferenceNumber>/g) || []).length,
    2,
  );
  assert.equal(
    (content.match(/<StickerNumber><\/StickerNumber>/g) || []).length,
    2,
  );
  assert.match(
    content,
    /<FleetEntry>1<\/FleetEntry>[\s\S]*?<ResponseStatusCode>TIRA001<\/ResponseStatusCode><ResponseStatusDesc>Successful<\/ResponseStatusDesc>/,
  );
  assert.match(
    content,
    /<FleetEntry>2<\/FleetEntry>[\s\S]*?<ResponseStatusCode>TIRA137<\/ResponseStatusCode><ResponseStatusDesc>Invalid motor registration number<\/ResponseStatusDesc>/,
  );
});
