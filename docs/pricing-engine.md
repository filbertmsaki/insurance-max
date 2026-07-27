# Pricing Engine Guide

This document describes the current authoritative premium-calculation flow in the Insurance Max portal as of July 27, 2026.

## Scope

The shared pricing engine is used for:

- standalone premium calculation
- motor single quotation pricing
- motor fleet quotation pricing
- non-motor quotation pricing
- pricing quote snapshot validation during quotation save
- pricing quote validation before TIRAMIS submission

## Core Rules

### Percentage storage

All percentage-like values are stored and processed as decimal fractions.

- `3.5%` is stored as `0.035`
- `5%` is stored as `0.05`
- `18%` is stored as `0.18`

### Monetary precision and rounding

Pricing uses shared helpers from `libs/portal-shared/src/utils/pricing-calculation.util.ts`.

- money values are rounded centrally
- rate values are rounded centrally
- exchange-rate handling uses shared precision helpers
- frontend quotation totals reuse the same rounding helpers rather than ad hoc browser math

### Supported calculation methods

Structured pricing currently supports:

- `PERCENTAGE`
- `FIXED`
- `PERCENTAGE_PLUS_FIXED`
- `PER_UNIT`
- `PERCENTAGE_PLUS_PER_UNIT`

The engine also preserves rule metadata and conditions so additional structured methods can be layered in without replacing the pricing contract.

## Backend Flow

Main backend files:

- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-engine.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-quote.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/infrastructure/premium-breakdown.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/infrastructure/rating-factor-validator.service.ts`
- `apps/insurance-portal-service/src/modules/tenant/pricing/infrastructure/rating-rule-matcher.service.ts`

Calculation sequence:

1. validate that the risk exists and is active
2. normalize factor values
3. validate required factors
4. resolve the applicable active rule and rate book
5. calculate the structured premium breakdown
6. apply the minimum premium floor
7. persist an immutable pricing quote snapshot
8. return quote metadata to the caller

## API Endpoints

Main controller:

- `apps/insurance-portal-service/src/modules/tenant/premium-calculation/premium-calculation.controller.ts`

Endpoints:

- `POST /premium-calculation/single`
- `POST /premium-calculation/multi`
- `GET /premium-calculation/explain/:risk_id`
- `GET /premium-calculation/quotes/:pricingQuoteId`

### Single-risk request

```json
{
  "client_reference": "RISK-001",
  "risk_id": "uuid",
  "sum_insured": 10000000,
  "factors": {
    "claim_record": "NO_CLAIM"
  },
  "quotation_type": "MOTOR",
  "currency_code": "TZS"
}
```

### Multi-risk request

```json
{
  "product_code": "MOTOR",
  "quotation_type": "MOTOR",
  "currency_code": "TZS",
  "effective_date": "2026-07-27",
  "risks": [
    {
      "client_reference": "VEHICLE-001",
      "risk_id": "uuid-1",
      "sum_insured": 45000000,
      "factors": {
        "motor_usage": "PRIVATE",
        "seat_capacity": 5
      }
    }
  ]
}
```

### Multi-risk response characteristics

The batch response now supports:

- successful risk rows in `risks`
- per-risk failures in `failed_risks`
- `grand_total`
- successful and failed counts

This allows fleet pricing to return mixed results without hiding which vehicle failed.

## Frontend Integration

Main frontend files:

- `apps/insurance-portal-web/src/modules/pricing`
- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/components/RiskRow.tsx`
- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep.tsx`
- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/hooks/useRiskPremiumCalculation.ts`

Current frontend behavior:

- motor single pricing derives factors from dedicated motor form fields
- motor fleet pricing uses the shared backend batch endpoint
- non-motor risk rows now keep dynamic `factor_values` in the wizard and send them to the same backend pricing engine
- calculated premium fields remain read-only
- pricing quote metadata is stored with each risk row and carried into quotation payloads

## Quotation and TIRAMIS Protection

Quotation save and submission validation lives in:

- `apps/insurance-portal-service/src/modules/tenant/quotations/quotations.service.ts`

Current protections include:

- pricing quote must exist for the same company
- pricing quote must not be expired
- product and risk must still match
- quotation type and currency must still match
- stored sum insured and premium rate must still match
- approved override values are checked explicitly
- TIRAMIS payloads are built from trusted backend quotation aggregates, not raw frontend-calculated amounts

## Audit Behavior

Current pricing-related audit coverage includes:

- premium override request, approval, and rejection in quotation workflows
- quotation submission lifecycle events
- pricing calculation requested
- pricing calculation completed
- pricing calculation failed

Pricing calculation audit logging is emitted from:

- `apps/insurance-portal-service/src/modules/tenant/premium-calculation/premium-calculation.service.ts`

## Permissions

Current codebase permissions are still primarily colon-scoped, for example:

- `premium-calculation:calculate`
- quotation override permissions

If the platform standard moves to dot-scoped pricing permissions, the RBAC seed and endpoint decorators should be aligned together in one migration pass rather than mixed ad hoc.

## Remaining Follow-up

The engine is now shared across motor, fleet, and non-motor flows, but there is still room to extend:

- richer normalized premium-breakdown DTOs for support and audit use
- broader backend tests for currency, fees, and future structured methods
- explicit policy-fee and levy configuration tables if those product rules are introduced
- broader frontend automated tests once the web test harness is expanded
