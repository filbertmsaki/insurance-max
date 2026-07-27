# Pricing Engine Guide

This document describes the authoritative pricing implementation in the Insurance Max portal as of July 27, 2026.

## Scope

The shared pricing engine is used for:

- standalone premium calculation
- motor single quotation pricing
- motor fleet quotation pricing
- non-motor quotation pricing
- pricing quote snapshot validation during quotation save and replace
- pricing quote validation before TIRAMIS submission

Main backend files:

- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-engine.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-quote.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-validation.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-charge.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-runtime-cache.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/infrastructure/rating-factor-validator.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/infrastructure/rating-rule-matcher.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/quotations/quotations.service.ts`

## Calculation Methods

Structured pricing currently supports:

- `PERCENTAGE`
- `FIXED`
- `PERCENTAGE_PLUS_FIXED`
- `PER_UNIT`
- `PERCENTAGE_PLUS_PER_UNIT`
- `FORMULA`

`FORMULA` is intentionally restricted to legacy structured shorthand that can be resolved safely into supported structured types, such as:

- `2% + 200,000`
- `15,000 per seat`
- `5.5% + 15,000 per seat`

High-level flow:

1. confirm the requested risk exists and is active for the company
2. normalize `factors` and `factor_values` into one lower-cased factor map
3. validate required factors and configured factor types
4. resolve the active published rate book effective for the calculation date
5. resolve the first matching active rule by priority
6. calculate raw premium using the selected structured method
7. apply the configured minimum premium floor
8. apply active tax and levy rules
9. persist an immutable pricing quote snapshot
10. return the result together with rate-book, rule, charge, and governance metadata

## Percentage Storage Rules

All percentage-like values are stored and processed as decimal fractions.

- `3.5%` is stored as `0.035`
- `5%` is stored as `0.05`
- `18%` is stored as `0.18`

This applies to:

- rule `percentage_rate`
- tax and levy `tax_rate`
- discount and loading control limits
- discount and loading approval thresholds
- quotation discount `discount_rate`

UI and API documentation should display human-readable percentages, but request payloads and persisted values use decimal fractions.

## Rounding Rules

Pricing uses shared helpers from `libs/portal-shared/src/utils/pricing-calculation.util.ts`.

- money is rounded centrally before persistence and before API response return
- rates are rounded centrally before persistence and before API response return
- charge totals are recomputed from rounded line items
- quotation save and preview logic reuse the same shared rounding helpers rather than frontend-only math
- exchange-rate snapshots use governance precision metadata instead of ad hoc conversion rules

## Rating-Factor Configuration

Rating factors are configured per company and referenced by `factor_code`.

Important behavior:

- incoming factor keys are normalized to lower case
- `sum_insured` is normalized separately and is always required for premium calculation
- required factor assignments are configured per risk through `risk_required_factors`
- configured factors can be `NUMBER`, `BOOLEAN`, `DATE`, `SELECT`, `MULTI_SELECT`, or `TEXT`
- unknown factors do not block calculation; they generate validation warnings
- invalid configured factor values generate validation errors and stop calculation

Configuration inputs live in:

- `rating_factors`
- `risk_required_factors`
- `insurance_risks`

## Rule-Condition Format

Rule conditions are stored separately from the rule body and evaluated in sequence.

Supported operators:

- `EQUALS`
- `NOT_EQUALS`
- `GREATER_THAN`
- `GREATER_THAN_OR_EQUAL`
- `LESS_THAN`
- `LESS_THAN_OR_EQUAL`
- `BETWEEN`
- `IN`
- `NOT_IN`

Supported logical chaining:

- `AND`
- `OR`

Condition fields:

- `factor_code`
- `operator`
- `value_from`
- `value_to`
- `logical_operator`

Behavior notes:

- conditions read normalized factor values
- missing factor values evaluate as non-matching
- rules are still ordered by `priority`, then `created_at`, then `id`
- if multiple rules match at the same top priority, calculation fails with a configuration error

## Rate-Book Lifecycle

Rate books move through the following states:

- `DRAFT`
- `UNDER_REVIEW`
- `APPROVED`
- `PUBLISHED`
- `RETIRED`
- `REJECTED`

Lifecycle rules:

- rules and conditions can only be changed while the parent rate book is `DRAFT` or `REJECTED`
- `submitForReview` requires at least one rule
- `approve` requires `UNDER_REVIEW`
- `publish` requires `APPROVED`
- when a new published rate book overlaps an older published rate book for the same company, product, and currency, the older overlapping book is retired
- only published books are used by the pricing engine
- only one published effective book is allowed for the same risk context on a calculation date

## Discount Workflow

Discount controls come from the matched pricing rule and are returned in `discount_control`.

Control fields:

- `max_rate`
- `max_amount`
- `approval_threshold_rate`
- `approval_threshold_amount`
- `effective_from`
- `effective_to`

Quotation discount workflow:

1. a pricing calculation returns the rule-specific discount control
2. the quotation payload carries `discounts_offered`
3. quotation save normalizes and validates requested discount values against the pricing control
4. requests above the configured approval threshold are marked `approval_required = true`
5. changes to the discount request require `pricing.request_discount`
6. approval or rejection of a discount decision requires `pricing.approve_discount`
7. discount request and approval events are written to audit logs

There is currently no dedicated `/discounts` pricing endpoint. Discount requests are part of authoritative quotation create and replace payloads.

## Loading Workflow

Loading controls are returned in `loading_control` using the same shape as discount controls.

Current implementation details:

- matched pricing rules can define maximum loading rate and amount
- matched pricing rules can define loading approval thresholds
- those controls are returned by pricing APIs and stored with pricing quote snapshots
- quotation governance reads the loading control metadata from the authoritative pricing response

There is not yet a dedicated manual loading endpoint in the quotation controller. The current platform documents and enforces the rule-level loading control metadata so future quotation workflows can use the same contract safely.

## Override Workflow

Manual premium overrides are separate from quotation discounts.

Current override behavior:

1. overrides are requested against a specific quotation risk
2. the request stores the original calculated premium and the proposed premium
3. only one pending override can exist per quotation risk at a time
4. the original requester cannot approve their own override
5. rejection requires a rejection reason
6. approved overrides recalculate stored quotation risk totals
7. quotation aggregates with override history cannot be replaced blindly

Dedicated endpoints exist for:

- request
- approve
- reject

## Tax and Levy Configuration

Charges are configured through `product_tax_rules`.

Supported charge categories include:

- `TAX`
- `LEVY`
- `FEE`
- `POLICY_FEE`
- `STAMP_DUTY`
- `ADMINISTRATION_FEE`
- `PRODUCT_CHARGE`
- `RISK_CHARGE`

Supported charge types:

- `PERCENTAGE`
- `FIXED`

Supported calculation bases:

- `BASIC_PREMIUM`
- `NET_PREMIUM`
- `GROSS_PREMIUM`

Matching rules:

- company-wide rules apply when no narrower scope exists
- category, product, and risk scoped rules can narrow applicability
- only active rules effective for the calculation date are applied
- charge min and max caps are enforced after calculation

## Currency Conversion

Pricing supports quotation currency governance through exchange-rate snapshots.

Current behavior:

- base-currency pricing uses a parity snapshot
- non-base currency pricing can use a manual exchange rate
- manual exchange rates can require approval depending on governance rules
- the applied exchange-rate snapshot is stored in the pricing quote snapshot
- calculation audit logs include a pricing currency conversion event when a non-null snapshot is applied

Snapshot fields include:

- quotation currency
- base currency
- exchange rate
- exchange-rate source
- exchange-rate date
- precision
- approval flags
- approved user
- rounding method

## Pricing API

Main controller:

- `apps/insurance-portal-service/src/modules/tenant/premium-calculation/premium-calculation.controller.ts`

Main endpoints:

- `POST /premium-calculation/single`
- `POST /premium-calculation/multi`
- `GET /premium-calculation/explain/:risk_id`
- `GET /premium-calculation/quotes/:pricingQuoteId`

Response characteristics:

- single-risk pricing returns one priced risk plus quote metadata
- multi-risk pricing returns `risks`, `failed_risks`, a batch `grand_total`, and a normalized `premium_breakdown`
- stored quote lookup returns the immutable persisted quote snapshot
- rule explanation returns the resolved top-priority rule without performing a premium calculation

Detailed request and response examples are documented in `docs/pricing-api-examples.md`.

## Quotation Integration

Quotation integration is authoritative and backend-driven.

Important rules:

- quotation risks carry `pricing_quote_id`
- quotation save and replace revalidate authoritative pricing against the stored snapshot
- pricing quote scope, product, risk, quotation type, currency, and premium values must still match
- expired or invalidated pricing quotes force recalculation before submission
- quotation detail and preview endpoints only expose pricing breakdown metadata to callers with `pricing.view_breakdown`
- pricing audit data such as override visibility is only exposed to callers with pricing audit-related permissions

Discount integration details:

- discounts are part of quotation risk payloads
- approval requirements are derived from the matched pricing control
- unchanged approved discounts can survive replace operations
- request and approval permission checks are enforced even when the payload is syntactically valid

## TIRA Validation Flow

Before quotation submission to TIRAMIS, the backend:

1. reconstructs the authoritative quotation payload from stored aggregates
2. re-validates pricing quote existence and freshness
3. checks rate-book and rule integrity through authoritative pricing validation
4. verifies payment and approval prerequisites
5. logs success or failure audit events for the submission validation phase
6. only then submits to TIRAMIS

Typical pre-submission failure reasons include:

- missing pricing quote
- expired pricing quote
- stale or invalidated pricing quote
- changed product, risk, quotation type, or currency context
- payment not settled for non-direct payment mode
- approval not completed

## Permission Requirements

Current pricing permissions are:

- `pricing.calculate`
- `pricing.view_breakdown`
- `pricing.manage_rules`
- `pricing.manage_rate_books`
- `pricing.publish_rate_books`
- `pricing.request_discount`
- `pricing.approve_discount`
- `pricing.request_override`
- `pricing.approve_override`
- `pricing.view_audit`

Current endpoint mapping:

- pricing calculation and rule explanation use `pricing.calculate`
- stored pricing quote lookup uses `pricing.view_breakdown`
- rating-rule and rule-condition management use `pricing.manage_rules`
- rate-book CRUD uses `pricing.manage_rate_books`
- rate-book lifecycle progression uses `pricing.publish_rate_books`
- quotation discount request changes require `pricing.request_discount`
- quotation discount approval changes require `pricing.approve_discount`
- manual override request uses `pricing.request_override`
- manual override approve and reject use `pricing.approve_override`
- pricing-specific audit visibility uses `pricing.view_audit`

## Audit Behavior

Pricing-related audit coverage includes:

- `PRICING_CALCULATION_REQUESTED`
- `PRICING_RULE_SELECTED`
- `PRICING_CALCULATION_COMPLETED`
- `PRICING_CALCULATION_FAILED`
- `PRICING_CURRENCY_CONVERSION`
- `quotation.discount.requested`
- `quotation.discount.approved`
- `quotation.pricing_expired`
- `quotation.pricing_invalidation`
- `quotation.pricing_recalculation.required`
- `quotation.premium_override.requested`
- `quotation.premium_override.approved`
- `quotation.premium_override.rejected`
- quotation submission validation success and failure events before TIRAMIS handoff

Correlation behavior:

- pricing calculation logs correlate on the client reference or generated pricing quote id
- persisted pricing quote snapshots carry a `pricing_trace_id` in `context_payload`
- quotation-side pricing audit entries correlate on quotation id, risk code, pricing quote id, or override id depending on the event

## Performance and Reliability Notes

Phase 26 introduced runtime protections that matter to operators and reviewers:

- active risk, factor, rule, and tax configuration is cached
- only published and active pricing configuration is cached for shared runtime use
- runtime cache invalidates when rate books are published or retired
- runtime cache invalidates when product, risk, factor, required-factor, rule, condition, or tax configuration changes
- pricing quote recalculation is idempotent for identical input, exchange-rate, and runtime-configuration signatures while the snapshot is still valid
- concurrent identical calculations are coalesced in-process to reduce duplicate database writes
- calculation-date-aware rate-book matching is enforced for reliability

## Related Docs

- `docs/pricing-api-examples.md`
- `README.md`
