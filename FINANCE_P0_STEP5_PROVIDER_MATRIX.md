# Payment-provider inventory — incomplete

This records repository evidence, not bank API availability or provider certification.

| Integration | Current repository status | External certification |
| --- | --- | --- |
| Finance payment-provider registry | Adapter interface and registry exist; no concrete provider registration found. | None established. |
| Provider webhook | Signature verification is delegated to a registered adapter; verified callbacks can update a payment and attempt an automatic receipt. | No actual provider contract or signature scheme verified. |
| Outgoing cash | Controlled test-only simulator exists in the isolated test fixtures. The application binds an empty simulator list. | No live payout adapter or bank settlement certification. |
| Bank reconciliation | Batch and matching services exist; provider-specific authenticated statement transport is not established. | No bank API certification established. |

The current provider event model does not establish a verified provider-account-to-company binding. Real integration requires approved provider-specific authentication, tenant/account mapping, signed or otherwise independently verified settlement evidence, documented idempotency and timeout behavior, fee handling, sandbox certification, and operational ownership. Existing accounting and payout holds remain in force.

Primary code: `integrations/payment-providers/`, `payables/outgoing-payments/`, `reconciliation/payment-reconciliation/`, and `test/support/finance-outgoing-fixture.ts` under the portal service Finance module.
