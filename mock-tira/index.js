
const express = require('express');

const app = express();

app.use(express.text({ type: ['application/xml', 'text/xml', '*/*'] }));

const PORT = process.env.PORT || 5050;

const ACK_ROOTS = {
  CoverNoteRefReq: 'CoverNoteRefReqAck',
  MotorCoverNoteRefReq: 'MotorCoverNoteRefReqAck',
  ReinsuranceReq: 'ReinsuranceReqAck',
  PolicyReq: 'PolicyReqAck',

  ClaimNotificationRefReq: 'ClaimNotificationRefReqAck',
  ClaimIntimationReq: 'ClaimIntimationReqAck',
  ClaimAssessmentReq: 'ClaimAssessmentReqAck',
  DischargeVoucherReq: 'DischargeVoucherReqAck',
  ClaimPaymentReq: 'ClaimPaymentReqAck',
  ClaimRejectionReq: 'ClaimRejectionReqAck',

  CoverNoteVerificationReq: 'CoverNoteVerificationRes',
  NINVerificationReq: 'NINVerificationRes',
  CompanyVerificationReq: 'CompanyVerificationRes',
  MotorVerificationReq: 'MotorVerificationRes',
  DetailsVerificationReq: 'DetailsVerificationRes',
};

const RESPONSE_ROOTS = {
  CoverNoteRefReq: 'CoverNoteRefRes',
  MotorCoverNoteRefReq: 'MotorCoverNoteRefRes',
  ReinsuranceReq: 'ReinsuranceRes',
  PolicyReq: 'PolicyRes',

  ClaimNotificationRefReq: 'ClaimNotificationRefRes',
  ClaimIntimationReq: 'ClaimIntimationRes',
  ClaimAssessmentReq: 'ClaimAssessmentRes',
  DischargeVoucherReq: 'DischargeVoucherRes',
  ClaimPaymentReq: 'ClaimPaymentRes',
  ClaimRejectionReq: 'ClaimRejectionRes',
};

function getRoot(xml) {
  const match = xml.match(/<TiraMsg>\s*<([^>\s]+)>/);
  return match?.[1] || null;
}

function getTag(xml, tagName) {
  const match = xml.match(
    new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`),
  );

  return match?.[1]?.trim() || null;
}

function buildAcknowledgementXml(root, requestId) {
  const ackRoot = ACK_ROOTS[root] || 'UnknownReqAck';

  return `
<TiraMsg>
  <${ackRoot}>
    <AcknowledgementId>ACK-${Date.now()}</AcknowledgementId>
    <RequestId>${requestId}</RequestId>
    <AcknowledgementStatusCode>TIRA001</AcknowledgementStatusCode>
    <AcknowledgementStatusDesc>Successful</AcknowledgementStatusDesc>
  </${ackRoot}>
  <MsgSignature>MOCK_SIGNATURE</MsgSignature>
</TiraMsg>
`.trim();
}

function buildFinalResponseXml(root, requestId) {
  const responseRoot = RESPONSE_ROOTS[root];

  if (!responseRoot) {
    return null;
  }

  let extra = '';

  if (responseRoot === 'CoverNoteRefRes') {
    extra = `
    <CoverNoteReferenceNumber>TIRA-CN-${Date.now()}</CoverNoteReferenceNumber>
`;
  }

  if (responseRoot === 'MotorCoverNoteRefRes') {
    extra = `
    <CoverNoteReferenceNumber>TIRA-MCN-${Date.now()}</CoverNoteReferenceNumber>
    <StickerNumber>STK-${Date.now()}</StickerNumber>
`;
  }

  return `
<TiraMsg>
  <${responseRoot}>
    <ResponseId>RES-${Date.now()}</ResponseId>
    <RequestId>${requestId}</RequestId>
    ${extra}
    <ResponseStatusCode>TIRA001</ResponseStatusCode>
    <ResponseStatusDesc>Successful</ResponseStatusDesc>
  </${responseRoot}>
  <MsgSignature>MOCK_SIGNATURE</MsgSignature>
</TiraMsg>
`.trim();
}

async function sendCallback(callbackUrl, finalResponseXml) {
  if (!callbackUrl || !finalResponseXml) {
    return;
  }

  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: finalResponseXml,
    });

    const responseText = await response.text();

    console.log('\nCallback sent successfully');
    console.log('Callback URL:', callbackUrl);
    console.log('Status:', response.status);
    console.log('Acknowledgement from your app:\n', responseText);
  } catch (error) {
    console.error('\nFailed to send callback');
    console.error(error.message);
  }
}

app.post('/tiramis/mock', async (req, res) => {
  const xml = req.body;

  const root = getRoot(xml);
  const requestId = getTag(xml, 'RequestId') || `REQ-${Date.now()}`;
  const callbackUrl = getTag(xml, 'CallBackUrl');

  console.log('\nReceived TIRAMIS request');
  console.log('Root:', root);
  console.log('RequestId:', requestId);
  console.log('CallbackUrl:', callbackUrl);

  const ackXml = buildAcknowledgementXml(root, requestId);

  res.set('Content-Type', 'application/xml');
  res.status(200).send(ackXml);

  const finalResponseXml = buildFinalResponseXml(root, requestId);

  if (finalResponseXml && callbackUrl) {
    setTimeout(() => {
      sendCallback(callbackUrl, finalResponseXml);
    }, 3000);
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mock-tira',
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`Mock TIRA running on http://localhost:${PORT}`);
  console.log(`Mock endpoint: http://localhost:${PORT}/tiramis/mock`);
});