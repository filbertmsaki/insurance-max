# Mock TIRA Testing Guide

## Start the server

```powershell
cd .\mock-tira
npm install
npm start
```

Expected startup logs include:

- `Mock TIRA running on http://localhost:5050`
- `[config] Client public certificate: ./certs/client/tiramisclientpublic.pfx`
- `[config] Mock TIRA private PFX: ./certs/tira/mock-tira-private.pfx`
- `[config] Mock TIRA public certificate: ./certs/tira/mock-tira-public.pfx`

## Health checks

```powershell
Invoke-RestMethod http://localhost:5050/health
Invoke-RestMethod http://localhost:5050/config-health
```

Expected `config-health` values:

- `clientPublicCertExists: true`
- `clientPublicCertLoads: true`
- `tiraPrivatePfxExists: true`
- `tiraPrivatePfxLoads: true`
- `tiraPrivatePfxHasPrivateKey: true`
- `tiraPublicCertExists: true`
- `tiraPublicCertLoads: true`

## Local callback receiver

Use this only when testing async requests that include `CallBackUrl`.

```powershell
$callbackBody = Join-Path $env:TEMP "mock-tira-callback-body.xml"
$callbackScript = Join-Path $env:TEMP "mock-tira-callback.js"

@"
const http = require('http');
const fs = require('fs');
const bodyPath = process.argv[2];
const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ready');
    return;
  }
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    fs.writeFileSync(bodyPath, body, 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end('<CallbackAck><StatusCode>TIRA001</StatusCode><StatusDesc>Accepted</StatusDesc></CallbackAck>');
  });
});
server.listen(5051, '127.0.0.1', () => console.log('Callback listening on http://127.0.0.1:5051/callback'));
"@ | Set-Content -LiteralPath $callbackScript -Encoding UTF8

node $callbackScript $callbackBody
```

## End-to-end PowerShell flow

Run these in a second PowerShell window while the mock server and callback receiver are running.

```powershell
$requestId = "REQ-" + (Get-Date -Format "yyyyMMddHHmmss")
$requestXml = @"
<CoverNoteRefReq>
  <RequestId>$requestId</RequestId>
  <CallBackUrl>http://127.0.0.1:5051/callback</CallBackUrl>
  <CoverNoteNumber>CN-CODEX-001</CoverNoteNumber>
</CoverNoteRefReq>
"@

$clientSigned = Invoke-RestMethod `
  -Uri "http://localhost:5050/tiramis/tools/sign-as-client" `
  -Method POST `
  -ContentType "application/xml" `
  -Body $requestXml

$clientVerify = Invoke-RestMethod `
  -Uri "http://localhost:5050/tiramis/tools/verify-client-signature" `
  -Method POST `
  -ContentType "application/xml" `
  -Body $clientSigned.signedXml

$clientVerify.valid
```

Expected: `True`. This proves the request signed with `tiramisclientprivate.pfx` verifies with `tiramisclientpublic.pfx`.

```powershell
$signedFile = Join-Path $env:TEMP "mock-tira-signed-request.xml"
$ackFile = Join-Path $env:TEMP "mock-tira-ack.xml"
$clientSigned.signedXml | Set-Content -LiteralPath $signedFile -Encoding UTF8

curl.exe -sS -o $ackFile -w "%{http_code}" `
  -X POST "http://localhost:5050/tiramis/mock" `
  -H "Content-Type: application/xml" `
  -H "ClientCode: ICC110" `
  -H "ClientKey: RydLDE8CFJ" `
  --data-binary "@$signedFile"

$ackXml = Get-Content -LiteralPath $ackFile -Raw
$ackVerify = Invoke-RestMethod `
  -Uri "http://localhost:5050/tiramis/tools/verify-tira-signature" `
  -Method POST `
  -ContentType "application/xml" `
  -Body $ackXml

$ackVerify.valid
$ackXml
```

Expected:

- HTTP status `200`
- `<AcknowledgementStatusCode>TIRA001</AcknowledgementStatusCode>`
- `$ackVerify.valid` is `True`

After `CALLBACK_DELAY_MS`, verify the final callback response:

```powershell
$finalXml = Get-Content -LiteralPath $callbackBody -Raw
$finalVerify = Invoke-RestMethod `
  -Uri "http://localhost:5050/tiramis/tools/verify-tira-signature" `
  -Method POST `
  -ContentType "application/xml" `
  -Body $finalXml

$finalVerify.valid
$finalXml
```

Expected:

- `<ResponseStatusCode>TIRA001</ResponseStatusCode>`
- `$finalVerify.valid` is `True`

## Postman requests

Create Postman environment variables:

- `baseUrl`: `http://localhost:5050`
- `clientCode`: `ICC110`
- `clientKey`: `RydLDE8CFJ`
- `callbackUrl`: `http://127.0.0.1:5051/callback`

### 1. Health

- Method: `GET`
- URL: `{{baseUrl}}/health`
- Expected: `status` is `ok`

### 2. Config health

- Method: `GET`
- URL: `{{baseUrl}}/config-health`
- Expected certificate booleans are all `true`

### 3. Sign request as client

- Method: `POST`
- URL: `{{baseUrl}}/tiramis/tools/sign-as-client`
- Header: `Content-Type: application/xml`
- Body:

```xml
<CoverNoteRefReq>
  <RequestId>REQ-POSTMAN-001</RequestId>
  <CallBackUrl>{{callbackUrl}}</CallBackUrl>
  <CoverNoteNumber>CN-POSTMAN-001</CoverNoteNumber>
</CoverNoteRefReq>
```

Tests:

```javascript
const json = pm.response.json();
pm.test("request signed", () => pm.expect(json.success).to.eql(true));
pm.environment.set("signedXml", json.signedXml);
```

### 4. Verify client request signature

- Method: `POST`
- URL: `{{baseUrl}}/tiramis/tools/verify-client-signature`
- Header: `Content-Type: application/xml`
- Body: `{{signedXml}}`

Expected:

```json
{ "success": true, "valid": true }
```

### 5. Send signed request to mock TIRA

- Method: `POST`
- URL: `{{baseUrl}}/tiramis/mock`
- Headers:
  - `Content-Type: application/xml`
  - `ClientCode: {{clientCode}}`
  - `ClientKey: {{clientKey}}`
- Body: `{{signedXml}}`

Tests:

```javascript
pm.test("ack accepted", () => {
  pm.expect(pm.response.code).to.eql(200);
  pm.expect(pm.response.text()).to.include("<AcknowledgementStatusCode>TIRA001</AcknowledgementStatusCode>");
  pm.expect(pm.response.text()).to.include("<MsgSignature>");
});
pm.environment.set("ackXml", pm.response.text());
```

### 6. Verify mock TIRA acknowledgement signature

- Method: `POST`
- URL: `{{baseUrl}}/tiramis/tools/verify-tira-signature`
- Header: `Content-Type: application/xml`
- Body: `{{ackXml}}`

Expected:

```json
{ "success": true, "valid": true }
```

### 7. Verify final callback signature

Copy the XML received by the callback receiver into the body.

- Method: `POST`
- URL: `{{baseUrl}}/tiramis/tools/verify-tira-signature`
- Header: `Content-Type: application/xml`
- Body: final callback XML

Expected:

```json
{ "success": true, "valid": true }
```
