# Portal Completion QA

Use this as the release checklist for customer/intermediary portal completion.
Every checked item should have evidence: screenshot, API response, database row,
or CI run URL.

## Automated Verification

- Backend portal unit tests:
  `npx jest --runInBand --passWithNoTests apps/insurance-portal-service/src/modules/tenant/portal/services/portal-business-access.service.spec.ts apps/insurance-portal-service/src/modules/tenant/portal/services/portal-requests.service.spec.ts apps/insurance-portal-service/src/modules/tenant/portal/guards/portal.guard.spec.ts`
- Underwrite focused backend tests:
  `npx jest --runInBand apps/insurance-portal-service/src/modules/tenant/underwrite libs/contracts/src/underwrite`
- Underwrite focused web tests:
  `cd apps/insurance-portal-web && npx vitest run src/modules/tenant/underwrite`
- Backend build:
  `npm run build:insurance-portal-service`
- Frontend build:
  `npm run build:insurance-portal-web`
- Frontend lint:
  `npm run lint:web`
- Focused backend lint:
  `node --max-old-space-size=4096 ./node_modules/eslint/bin/eslint.js apps/insurance-portal-service/src/modules/tenant/portal`

## Underwrite Module Regression

Run this on a staging database copy with `mock-tira` enabled before exposing
the new Underwrite menu to production users.

- Apply migrations and confirm these are present:
  - `1790800000000-UnderwriteLinesAndPermissions`
  - `1790900000000-NonMotorRiskSchemas`
- Run the RBAC seed and confirm system roles retain:
  - `underwrite.dashboard.view`
  - `underwrite.motor.*`
  - `underwrite.fleet.*`
  - `underwrite.non_motor.*`
- Confirm `/auth/authorization-context` includes newly granted underwrite
  permissions without issuing a new login token.
- Open the sidebar as a user who was granted a new underwrite permission during
  the session; confirm the matching menu item appears after focus/refresh.
- Confirm legacy `/underwriting/*` routes still open and complete the existing
  legacy quotation flow unchanged.
- Confirm direct API access to another line returns 404, not record details.
- Confirm a user missing the underwrite line gate receives 403 even if they
  hold the legacy action permission.
- Confirm branch-scoped users only see quotations, policies, renewals,
  endorsements, cancellations, and TIRA queues for their permitted branches.

## Underwrite Wizard Journeys

For each line, capture evidence for draft save, reopen, finalize, approval when
required, payment when required, TIRA submission, and issued policy.

- Motor single policy:
  - Create from `/underwrite/motor/quotations/new`.
  - Save draft and reopen from the Motor quotations list.
  - Finalize and submit through `mock-tira`.
  - Confirm issued policy has `business_line = MOTOR`.
- Fleet policy:
  - Create from `/underwrite/fleet/quotations/new`.
  - Add multiple vehicles and confirm per-vehicle premium rows.
  - Finalize and confirm fleet register sync creates or updates fleet rows.
  - Confirm issued policy has `business_line = FLEET`.
- Non-Motor policy:
  - Configure at least one required risk schema field.
  - Create from `/underwrite/non-motor/quotations/new`.
  - Save risk details, upload documents, finalize, and issue.
  - Confirm issued policy has `business_line = NON_MOTOR`.

## Underwrite Work Queues

- Dashboard cards show quotation, policy, renewal, endorsement, cancellation,
  TIRA failed, and TIRA pending counts only for permitted sections.
- Renewals list opens for each line and links back to the scoped policy.
- Endorsements list opens for each line and links back to the scoped policy.
- Cancellations list opens for each line and links back to the scoped policy.
- TIRA Failed and TIRA Pending queues list both quotations and policy
  transactions for the selected line.
- Retry failed quotation TIRA from the line queue.
- Retry failed endorsement TIRA from the line queue.
- Resubmit failed cancellation TIRA from the line queue.

## Underwrite Legacy Parity

- Existing legacy quotation creation, draft edit, finalize, approval, payment,
  TIRA submission, retry, and policy issuance still work after the underwrite
  migrations.
- Existing legacy endorsement, cancellation, and renewal screens still work.
- Existing customer, policy, billing, claims, document, and reporting routes do
  not require underwrite permissions.
- Existing portal customer and intermediary flows still load policies and
  documents created through the new Underwrite module.

## Customer Journey

- Register or activate a customer portal account.
- Login and confirm `/customer/dashboard`, profile, notifications, messages,
  signatures, and documents load.
- Buy cover from `/customer/buy-cover`; confirm a quotation draft is created.
- Submit or finalize the quotation through the customer flow.
- Confirm invoice appears under `/customer/invoices`.
- Upload payment proof from the invoice row. Evidence required:
  - `portal_service_requests.request_type = PAYMENT_PROOF`
  - active `PAYMENT_PROOF` attachment exists
  - `portal_payment_proofs.status = PENDING_REVIEW`
- In back office, verify the payment proof.
- Confirm the invoice is not marked paid until finance posts an official receipt
  or allocation.
- Complete the portal payment-proof request with the receipt/allocation
  reference.
- Confirm receipt appears under `/customer/receipts`.
- Download policy documents and receipts.
- Submit a claim notification from `/customer/claims`.
- Submit a complaint from `/customer/complaints`.
- Reply to a message thread and confirm the staff side receives it.
- Complete a signature request and confirm signature evidence is stored.
- Confirm portal notifications link to `/customer/requests/:id` for request
  status changes.

## Intermediary Journey

- Login as an intermediary portal user.
- Confirm portfolio customers, quotations, policies, invoices, receipts,
  commissions, claims, complaints, requests, documents, notifications, messages,
  and signatures load.
- Start or update a quotation for a portfolio customer.
- Upload payment proof for a portfolio invoice.
- Submit claim notification and complaint against a scoped portfolio policy.
- Confirm notifications link to `/intermediary/requests/:id`.

## Portal Detail Pages

- Open detail pages for:
  - `/customer/invoices/:id`
  - `/customer/claims/:id`
  - `/customer/complaints/:id`
  - `/customer/requests/:id`
  - `/intermediary/invoices/:id`
  - `/intermediary/claims/:id`
  - `/intermediary/complaints/:id`
  - `/intermediary/requests/:id`
- For request detail pages, verify payment proof, attachments, and timeline
  display when present.
- Download each request attachment from the detail page and confirm filename,
  MIME type, and contents.

## Security Scope Audit

Create two customer accounts, A and B, and one intermediary account.

- Customer A cannot load Customer B quotations, policies, invoices, receipts,
  claims, complaints, documents, messages, signatures, requests, notifications,
  or request attachments by direct URL/API ID.
- Customer B cannot load Customer A records.
- Intermediary can load only records scoped to its intermediary company or
  portfolio customers.
- Intermediary cannot submit a complaint for a customer outside its portfolio.
- Payment-proof attachment download must return 404 for another account.
- Direct API calls must return 404 or 403 without confirming whether another
  tenant/customer record exists.

## Payment Proof Back Office

- Verify payment proof without a `PAYMENT_PROOF` attachment fails.
- Rejecting a payment proof requires a reason.
- Verified proof moves the portal request to `APPROVED`.
- Verified proof does not mutate `invoice.paid_amount`,
  `invoice.balance_amount`, or `invoice.status`.
- Completing the request requires an official receipt or allocation reference.
- Completing the request records execution result in request payload.

## Notifications

Confirm notifications are created for:

- Request returned for additional information.
- Request rejected.
- Request completed.
- Document issued or published to portal.
- Signature request awaiting response.
- Claim status changed.
- Complaint resolved or closed.

For every notification, confirm `resource_type`, `resource_id`, `action_url`,
severity, unread state, and mark-read behavior.

## Document And PDF QA

For each sample policy type, generate and render:

- Policy schedule.
- Certificate.
- Receipt.
- Claim form.
- Wording document.
- Signature evidence page.

Checks:

- Render final PDFs to PNG with Poppler:
  `pdftoppm -png input.pdf tmp/pdfs/rendered`
- Confirm no clipped text, overlapping tables, blank pages, unreadable glyphs,
  missing headers, missing footers, or incorrect page numbers.
- Confirm QR/verification codes scan.
- Confirm downloaded portal document matches stored checksum and audit event.
- Confirm generated receipt/invoice figures match finance records.

## Production Readiness

- Validate `.env` for API URL, JWT, database, Redis/queue, mail, public portal
  URL, document storage, and TIRAMIS settings.
- Run migrations against a staging copy:
  `npm run migration:show:insurance-portal-service`
- Run seed check:
  `npm run seed:insurance-portal-service`
- Run backup:
  `npm run db:backup`
- Confirm health/release gate reports build, migration, backup, and E2E
  evidence.
- Confirm error tracking and logs capture failed portal uploads, payment-proof
  review failures, PDF generation failures, and notification failures.
- Confirm storage lifecycle/backups for portal attachments and generated
  documents.
