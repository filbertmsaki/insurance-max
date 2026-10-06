# Mock TIRAMIS Seeded Endpoints

The mock server now exposes every POST endpoint configured by `apps/tiramis/src/database/seeders/seed-tiramis-config.ts`.

## Required `.env`

```env
PORT=5050

CLIENT_CODE=ICC000
CLIENT_KEY=your-client-key

VERIFY_INCOMING_SIGNATURE=true
SIGN_RESPONSES=true
ALLOW_MOCK_SIGNATURE=false
SIGNATURE_XML_MODE=preserve

CLIENT_PUBLIC_CERT_PATH=./certs/client/tiramisclientpublic.pfx
CLIENT_PUBLIC_CERT_PASSWORD=change-me

CLIENT_PRIVATE_PFX_PATH=./certs/client/tiramisclientprivate.pfx
CLIENT_PRIVATE_PFX_PASSWORD=change-me

TIRA_PRIVATE_PFX_PATH=./certs/tira/mock-tira-private.pfx
TIRA_PRIVATE_PFX_PASSWORD=change-me

TIRA_PUBLIC_CERT_PATH=./certs/tira/mock-tira-public.pfx
TIRA_PUBLIC_CERT_PASSWORD=change-me

CALLBACK_DELAY_MS=3000
CALLBACK_RETRIES=3
CALLBACK_RETRY_DELAY_MS=5000
```

## Endpoint Map

Use `http://localhost:5050` as the test `baseUrl`.

| Service type | Path | Root | Mode | Immediate response | Callback response |
| --- | --- | --- | --- | --- | --- |
| `COVER_NOTE_NON_MOTOR` | `/ecovernote/api/covernote/non-life/other/v2/request` | `CoverNoteRefReq` | Async | `CoverNoteRefReqAck` | `CoverNoteRefRes` |
| `MOTOR_COVER_NOTE_NON_FLEET` | `/ecovernote/api/covernote/non-life/motor/v2/request` | `MotorCoverNoteRefReq` | Async | `MotorCoverNoteRefReqAck` | `MotorCoverNoteRefRes` |
| `MOTOR_COVER_NOTE_FLEET` | `/ecovernote/api/covernote/non-life/motor-fleet/v2/request` | `MotorCoverNoteRefReq` | Async | `MotorCoverNoteRefReqAck` | `MotorCoverNoteRefRes` |
| `REINSURANCE` | `/ecovernote/api/reinsurance/v1/request` | `ReinsuranceReq` | Async | `ReinsuranceReqAck` | `ReinsuranceRes` |
| `POLICY` | `/ecovernote/api/policy/v1/request` | `PolicyReq` | Async | `PolicyReqAck` | `PolicyRes` |
| `CLAIM_NOTIFICATION` | `/eclaim/api/claim/claim-notification/v1/request` | `ClaimNotificationRefReq` | Async | `ClaimNotificationRefReqAck` | `ClaimNotificationRefRes` |
| `CLAIM_INTIMATION` | `/eclaim/api/claim/claim-intimation/v1/request` | `ClaimIntimationReq` | Async | `ClaimIntimationReqAck` | `ClaimIntimationRes` |
| `CLAIM_ASSESSMENT` | `/eclaim/api/claim/claim-assessment/v1/request` | `ClaimAssessmentReq` | Async | `ClaimAssessmentReqAck` | `ClaimAssessmentRes` |
| `DISCHARGE_VOUCHER` | `/eclaim/api/claim/claim-dischargevoucher/v1/request` | `DischargeVoucherReq` | Async | `DischargeVoucherReqAck` | `DischargeVoucherRes` |
| `CLAIM_PAYMENT` | `/eclaim/api/claim/claim-payment/v1/request` | `ClaimPaymentReq` | Async | `ClaimPaymentReqAck` | `ClaimPaymentRes` |
| `CLAIM_REJECTION` | `/eclaim/api/claim/claim-rejection/v1/request` | `ClaimRejectionReq` | Async | `ClaimRejectionReqAck` | `ClaimRejectionRes` |
| `COVER_NOTE_VERIFICATION` | `/ecovernote/api/covernote/verification/min/v1/request` | `CoverNoteVerificationReq` | Sync | `CoverNoteVerificationRes` | None |
| `MOTOR_VERIFICATION` | `/dispatch/api/motor/verification/v3/request` | `MotorVerificationReq` | Sync | `MotorVerificationRes` | None |

The legacy all-purpose endpoint still exists:

```text
POST /tiramis/mock
```

## Common Postman Setup

Environment variables:

| Variable | Value |
| --- | --- |
| `baseUrl` | `http://localhost:5050` |
| `clientCode` | `ICC000` |
| `clientKey` | `your-client-key` |
| `callbackUrl` | `http://localhost:9091/api/v1/tiramis/callbacks/test` |

Every TIRAMIS endpoint request uses:

```text
Content-Type: application/xml
ClientCode: {{clientCode}}
ClientKey: {{clientKey}}
```

### Sign a Sample Request

Send the unsigned content XML to the helper:

```text
POST {{baseUrl}}/tiramis/tools/sign-as-client
Content-Type: application/xml
```

Postman test:

```javascript
const json = pm.response.json();
pm.test("signed", () => pm.expect(json.success).to.eql(true));
pm.environment.set("signedXml", json.signedXml);
```

Then send `{{signedXml}}` to one of the seeded endpoint paths.

### Verify a Mock TIRA Response

```text
POST {{baseUrl}}/tiramis/tools/verify-tira-signature
Content-Type: application/xml
```

Body: the acknowledgement XML or callback XML.

Expected:

```json
{ "success": true, "valid": true }
```

## Sample XML Requests

Use these as the body for `/tiramis/tools/sign-as-client`, then send the returned `signedXml` to the matching endpoint.

### Cover Note Non-Motor

Endpoint: `POST {{baseUrl}}/ecovernote/api/covernote/non-life/other/v2/request`

```xml
<CoverNoteRefReq>
  <CoverNoteHdr>
    <RequestId>REQ-CN-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
    <TranCompanyCode>ICC000</TranCompanyCode>
    <CoverNoteType>1</CoverNoteType>
  </CoverNoteHdr>
  <CoverNoteDtl>
    <CoverNoteNumber>CN-001</CoverNoteNumber>
  </CoverNoteDtl>
</CoverNoteRefReq>
```

### Motor Cover Note Non-Fleet

Endpoint: `POST {{baseUrl}}/ecovernote/api/covernote/non-life/motor/v2/request`

```xml
<MotorCoverNoteRefReq>
  <CoverNoteHdr>
    <RequestId>REQ-MCN-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
    <TranCompanyCode>ICC000</TranCompanyCode>
    <CoverNoteType>3</CoverNoteType>
  </CoverNoteHdr>
  <CoverNoteDtl>
    <CoverNoteNumber>MCN-001</CoverNoteNumber>
    <MotorDtl>
      <RegistrationNumber>T123ABC</RegistrationNumber>
      <ChassisNumber>CHASSIS001</ChassisNumber>
    </MotorDtl>
  </CoverNoteDtl>
</MotorCoverNoteRefReq>
```

### Motor Cover Note Fleet

Endpoint: `POST {{baseUrl}}/ecovernote/api/covernote/non-life/motor-fleet/v2/request`

```xml
<MotorCoverNoteRefReq>
  <CoverNoteHdr>
    <RequestId>REQ-FLEET-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
    <TranCompanyCode>ICC000</TranCompanyCode>
    <CoverNoteType>3</CoverNoteType>
  </CoverNoteHdr>
  <CoverNoteDtl>
    <FleetHdr>
      <FleetId>FLEET-001</FleetId>
      <FleetSize>2</FleetSize>
    </FleetHdr>
  </CoverNoteDtl>
</MotorCoverNoteRefReq>
```

### Reinsurance

Endpoint: `POST {{baseUrl}}/ecovernote/api/reinsurance/v1/request`

```xml
<ReinsuranceReq>
  <ReinsuranceHdr>
    <RequestId>REQ-RI-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
    <CoverNoteReferenceNumber>TIRA-CN-001</CoverNoteReferenceNumber>
  </ReinsuranceHdr>
  <ReinsuranceDtl>
    <ParticipantCode>REIN-001</ParticipantCode>
  </ReinsuranceDtl>
</ReinsuranceReq>
```

### Policy

Endpoint: `POST {{baseUrl}}/ecovernote/api/policy/v1/request`

```xml
<PolicyReq>
  <PolicyHdr>
    <RequestId>REQ-POL-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </PolicyHdr>
  <PolicyDtl>
    <PolicyNumber>POL-001</PolicyNumber>
    <AppliedCoverNotes>
      <CoverNoteReferenceNumber>TIRA-CN-001</CoverNoteReferenceNumber>
    </AppliedCoverNotes>
  </PolicyDtl>
</PolicyReq>
```

### Claim Notification

Endpoint: `POST {{baseUrl}}/eclaim/api/claim/claim-notification/v1/request`

```xml
<ClaimNotificationRefReq>
  <ClaimNotificationHdr>
    <RequestId>REQ-CLM-NOT-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </ClaimNotificationHdr>
  <ClaimNotificationDtl>
    <ClaimNotificationNumber>CLM-NOT-001</ClaimNotificationNumber>
    <CoverNoteReferenceNumber>TIRA-CN-001</CoverNoteReferenceNumber>
  </ClaimNotificationDtl>
</ClaimNotificationRefReq>
```

### Claim Intimation

Endpoint: `POST {{baseUrl}}/eclaim/api/claim/claim-intimation/v1/request`

```xml
<ClaimIntimationReq>
  <ClaimIntimationHdr>
    <RequestId>REQ-CLM-INT-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </ClaimIntimationHdr>
  <ClaimIntimationDtl>
    <ClaimIntimationNumber>CLM-INT-001</ClaimIntimationNumber>
    <ClaimReferenceNumber>TIRA-CLM-001</ClaimReferenceNumber>
  </ClaimIntimationDtl>
</ClaimIntimationReq>
```

### Claim Assessment

Endpoint: `POST {{baseUrl}}/eclaim/api/claim/claim-assessment/v1/request`

```xml
<ClaimAssessmentReq>
  <ClaimAssessmentHdr>
    <RequestId>REQ-CLM-ASSESS-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </ClaimAssessmentHdr>
  <ClaimAssessmentDtl>
    <ClaimAssessmentNumber>CLM-ASSESS-001</ClaimAssessmentNumber>
    <ClaimReferenceNumber>TIRA-CLM-001</ClaimReferenceNumber>
  </ClaimAssessmentDtl>
</ClaimAssessmentReq>
```

### Discharge Voucher

Endpoint: `POST {{baseUrl}}/eclaim/api/claim/claim-dischargevoucher/v1/request`

```xml
<DischargeVoucherReq>
  <DischargeVoucherHdr>
    <RequestId>REQ-DV-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </DischargeVoucherHdr>
  <DischargeVoucherDtl>
    <DischargeVoucherNumber>DV-001</DischargeVoucherNumber>
    <ClaimReferenceNumber>TIRA-CLM-001</ClaimReferenceNumber>
  </DischargeVoucherDtl>
</DischargeVoucherReq>
```

### Claim Payment

Endpoint: `POST {{baseUrl}}/eclaim/api/claim/claim-payment/v1/request`

```xml
<ClaimPaymentReq>
  <ClaimPaymentHdr>
    <RequestId>REQ-CLM-PAY-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </ClaimPaymentHdr>
  <ClaimPaymentDtl>
    <ClaimPaymentNumber>CLM-PAY-001</ClaimPaymentNumber>
    <ClaimReferenceNumber>TIRA-CLM-001</ClaimReferenceNumber>
  </ClaimPaymentDtl>
</ClaimPaymentReq>
```

### Claim Rejection

Endpoint: `POST {{baseUrl}}/eclaim/api/claim/claim-rejection/v1/request`

```xml
<ClaimRejectionReq>
  <ClaimRejectionHdr>
    <RequestId>REQ-CLM-REJ-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
    <CallBackUrl>{{callbackUrl}}</CallBackUrl>
    <InsurerCompanyCode>ICC000</InsurerCompanyCode>
  </ClaimRejectionHdr>
  <ClaimRejectionDtl>
    <ClaimRejectionNumber>CLM-REJ-001</ClaimRejectionNumber>
    <ClaimReferenceNumber>TIRA-CLM-001</ClaimReferenceNumber>
  </ClaimRejectionDtl>
</ClaimRejectionReq>
```

### Cover Note Verification

Endpoint: `POST {{baseUrl}}/ecovernote/api/covernote/verification/min/v1/request`

`VerificationDtl` accepts these optional fields:

- `CoverNoteReferenceNumber`
- `StickerNumber`
- `MotorRegistrationNumber`
- `MotorChassisNumber`

At least one of the four fields must be provided with a non-empty value.

```xml
<TiraMsg>
<CoverNoteVerificationReq>
  <VerificationHdr>
    <RequestId>NIC22424232355</RequestId>
    <CompanyCode>IC0003</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
  </VerificationHdr>
  <VerificationDtl>
    <CoverNoteReferenceNumber>42424-246767-65768</CoverNoteReferenceNumber>
    <StickerNumber>13143-14145-12412</StickerNumber>
    <MotorRegistrationNumber>T233SQA</MotorRegistrationNumber>
    <MotorChassisNumber>4353646</MotorChassisNumber>
  </VerificationDtl>
</CoverNoteVerificationReq>
<MsgSignature>figuiiojwjfuufewbfwiufwnihfergiengi</MsgSignature>
</TiraMsg>
```

### Motor Verification

Endpoint: `POST {{baseUrl}}/dispatch/api/motor/verification/v3/request`

```xml
<MotorVerificationReq>
  <VerificationHdr>
    <RequestId>REQ-MV-001</RequestId>
    <CompanyCode>ICC000</CompanyCode>
    <SystemCode>LSYS_EXAMPLE_001</SystemCode>
  </VerificationHdr>
  <VerificationDtl>
    <RegistrationNumber>T123ABC</RegistrationNumber>
    <ChassisNumber>CHASSIS001</ChassisNumber>
  </VerificationDtl>
</MotorVerificationReq>
```

## Expected Acknowledgement Response

Async endpoints return a signed acknowledgement immediately:

```xml
<TiraMsg>
  <CoverNoteRefReqAck>
    <AcknowledgementId>ACK...</AcknowledgementId>
    <RequestId>REQ-CN-001</RequestId>
    <AcknowledgementStatusCode>TIRA001</AcknowledgementStatusCode>
    <AcknowledgementStatusDesc>Successful</AcknowledgementStatusDesc>
  </CoverNoteRefReqAck>
  <MsgSignature>...</MsgSignature>
</TiraMsg>
```

The acknowledgement root changes per endpoint, as shown in the endpoint map.

## Expected Callback Response

Async endpoints send a signed final response to `CallBackUrl`:

```xml
<TiraMsg>
  <CoverNoteRefRes>
    <ResponseId>RES...</ResponseId>
    <RequestId>REQ-CN-001</RequestId>
    <CoverNoteReferenceNumber>TIRA-CN-...</CoverNoteReferenceNumber>
    <ResponseStatusCode>TIRA001</ResponseStatusCode>
    <ResponseStatusDesc>Successful</ResponseStatusDesc>
  </CoverNoteRefRes>
  <MsgSignature>...</MsgSignature>
</TiraMsg>
```

The callback response root changes per endpoint, as shown in the endpoint map.

## Expected Synchronous Verification Response

Sync endpoints return a signed final response immediately:

```xml
<TiraMsg>
  <CoverNoteVerificationRes>
    <CoverNoteHdr>
      <ResponseId>TIRA22424232355</ResponseId>
      <RequestId>NIC22424232355</RequestId>
      <ResponseStatusCode>TIRA001</ResponseStatusCode>
      <ResponseStatusDesc>Successful</ResponseStatusDesc>
    </CoverNoteHdr>
    <CoverNoteDtl>
      <CoverNoteTypeDesc>Endorsement</CoverNoteTypeDesc>
      <CoverNoteNumber>NIC00001</CoverNoteNumber>
      <CoverNoteReferenceNumber>45632525252</CoverNoteReferenceNumber>
      <PrevCoverNoteReferenceNumber>32525252</PrevCoverNoteReferenceNumber>
      <InsurerCompanyCode>IC0003</InsurerCompanyCode>
      <InsurerCompanyName>NIC</InsurerCompanyName>
      <TransactionCompanyCode>IC0003</TransactionCompanyCode>
      <TransactionCompanyName>NMB</TransactionCompanyName>
      <BranchCode>BR0003</BranchCode>
      <BranchDescription>BR0003</BranchDescription>
      <SalePointCode>SP0003</SalePointCode>
      <SalePointDescription>SP0003</SalePointDescription>
      <CoverNoteIssueDate>2020-07-30T23:24:22</CoverNoteIssueDate>
      <CoverNoteStartDate>2020-09-15T13:55:22</CoverNoteStartDate>
      <CoverNoteEndDate>2021-07-30T23:59:59</CoverNoteEndDate>
      <CoverNoteDesc>Cover note verification response</CoverNoteDesc>
      <OperativeClause>Fire and Allied Perils</OperativeClause>
      <PaymentMode>1</PaymentMode>
      <CurrencyCode>USD</CurrencyCode>
      <ExchangeRate>2000.00</ExchangeRate>
      <TotalPremiumExcludingTax>3000.00</TotalPremiumExcludingTax>
      <TotalPremiumIncludingTax>3380.00</TotalPremiumIncludingTax>
      <CommisionPaid>0.00</CommisionPaid>
      <CommisionRate>0.00</CommisionRate>
      <IsFleet>Y</IsFleet>
      <FleetId>FL122340</FleetId>
      <FleetSize>23</FleetSize>
      <OfficerName>John Doe</OfficerName>
      <OfficerTitle>Underwriter</OfficerTitle>
      <ProductCode>CP20100000</ProductCode>
      <ProductName>Lala Salama</ProductName>
      <VerificationStatus>VALID</VerificationStatus>
      <VerificationMessage>Verified successfully</VerificationMessage>
    </CoverNoteDtl>
  </CoverNoteVerificationRes>
  <MsgSignature>...</MsgSignature>
</TiraMsg>
```

For `CoverNoteVerificationReq`, the response is wrapped in `CoverNoteHdr` and
`CoverNoteDtl`. The mock echoes provided verification identifiers and fills the
remaining cover note detail fields with mock data.
