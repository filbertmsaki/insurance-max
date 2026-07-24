const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveFinalStatus,
} = require('../src/services/tiramis-handler.service');
const {
  buildAsyncFinalResponseContent,
  buildTiraMessage,
} = require('../src/services/response-builder.service');

test('cover cancellation endorsement returns the cancellation success response', () => {
  const result = resolveFinalStatus({
    scenario: 'success',
    contentXml: '<CoverNoteType>3</CoverNoteType><EndorsementType>4</EndorsementType>',
  });

  assert.deepEqual(result, {
    code: 'TIRA001',
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
    'TIRA001',
    'Transaction successfully cancelled',
    { responseId: 'RES-CANCEL-1' },
  );
  const message = buildTiraMessage(content, () => 'SIGNATURE');

  assert.match(content, /<RequestId>REQ-CANCEL-1<\/RequestId>/);
  assert.match(content, /<ResponseId>RES-CANCEL-1<\/ResponseId>/);
  assert.match(content, /<ResponseStatusCode>TIRA001<\/ResponseStatusCode>/);
  assert.match(
    content,
    /<ResponseStatusDesc>Transaction successfully cancelled<\/ResponseStatusDesc>/,
  );
  assert.match(message, /<MsgSignature>SIGNATURE<\/MsgSignature>/);
});
