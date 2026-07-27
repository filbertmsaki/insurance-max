# Pricing API Examples

These examples reflect the current pricing and quotation contracts as of July 27, 2026. UUIDs and identifiers are illustrative.

## Base URLs

Pricing endpoints:

- `POST /premium-calculation/single`
- `POST /premium-calculation/multi`
- `GET /premium-calculation/explain/:risk_id`
- `GET /premium-calculation/quotes/:pricingQuoteId`

Quotation integration endpoints:

- `POST /tenant/quotations`
- `PUT /tenant/quotations/:id`
- `POST /tenant/quotations/:id/submit`
- `POST /tenant/quotations/:id/risks/:riskId/premium-overrides`

## Single-Risk Calculation

Request:

```json
{
  "client_reference": "VEHICLE-001",
  "risk_id": "f724d42f-7f6e-4ad7-bf10-0fde2ef84f93",
  "sum_insured": 10000000,
  "factors": {
    "seat_capacity": 10,
    "vehicle_weight": 7,
    "claim_record": "NO_CLAIM"
  },
  "effective_date": "2026-07-27",
  "quotation_type": "MOTOR",
  "currency_code": "TZS"
}
```

Response:

```json
{
  "pricing_quote_id": "PQ-2026-00000001",
  "pricing_status": "CALCULATED",
  "calculated_at": "2026-07-27T08:00:00.000Z",
  "expires_at": "2026-07-28T08:00:00.000Z",
  "input_signature": "6c6b9f4f8d52...",
  "quotation_type": "MOTOR",
  "currency_code": "TZS",
  "client_reference": "VEHICLE-001",
  "risk_id": "f724d42f-7f6e-4ad7-bf10-0fde2ef84f93",
  "risk_code": "SP014004000001",
  "risk_name": "Passenger Carrying Comprehensive",
  "rate_book_id": "rate-book-1",
  "rate_book_code": "RB-MOTOR",
  "rate_book_version": "2026.1",
  "rule_id": "rule-1",
  "rule_name": "Passenger carrying no-claim rate",
  "rule_version": 1,
  "sum_insured": 10000000,
  "rate_type": "PERCENTAGE_PLUS_PER_UNIT",
  "percentage_rate": 0.055,
  "base_premium": 550000,
  "per_unit_factor_code": "seat_capacity",
  "per_unit_value": 10,
  "per_unit_amount": 15000,
  "per_unit_premium": 150000,
  "fixed_amount": 0,
  "minimum_amount": 500000,
  "gross_premium": 700000,
  "final_premium": 700000,
  "minimum_applied": false,
  "discount_control": {
    "max_rate": 0.1,
    "max_amount": 50000,
    "approval_threshold_rate": 0.05,
    "approval_threshold_amount": 25000,
    "effective_from": "2026-01-01",
    "effective_to": "2026-12-31"
  },
  "loading_control": {
    "max_rate": 0.08,
    "max_amount": 40000,
    "approval_threshold_rate": 0.04,
    "approval_threshold_amount": 20000,
    "effective_from": "2026-01-01",
    "effective_to": "2026-12-31"
  },
  "charges": [
    {
      "applied_rule_id": "charge-rule-1",
      "charge_code": "VAT-MAINLAND",
      "charge_name": "VAT Mainland",
      "charge_category": "TAX",
      "charge_scope": "RISK",
      "charge_type": "PERCENTAGE",
      "calculation_base": "NET_PREMIUM",
      "base_amount": 700000,
      "rate": 0.18,
      "fixed_amount": null,
      "minimum_charge_amount": null,
      "maximum_charge_amount": null,
      "computed_amount": 126000,
      "is_taxable": false,
      "effective_from": "2026-01-01",
      "effective_to": "2026-12-31"
    }
  ],
  "total_charge_amount": 126000,
  "taxable_charge_amount": 0,
  "non_taxable_charge_amount": 126000,
  "premium_including_charges": 826000,
  "factors": {
    "seat_capacity": 10,
    "vehicle_weight": 7,
    "claim_record": "NO_CLAIM",
    "sum_insured": 10000000
  },
  "validation_errors": [],
  "validation_warnings": [],
  "premium_breakdown": {
    "pricing_quote_id": "PQ-2026-00000001",
    "status": "CALCULATED",
    "currency": "TZS",
    "rate_book": {
      "code": "RB-MOTOR",
      "version": "2026.1"
    },
    "items": [
      {
        "client_reference": "VEHICLE-001",
        "risk_id": "f724d42f-7f6e-4ad7-bf10-0fde2ef84f93",
        "risk_code": "SP014004000001",
        "risk_name": "Passenger Carrying Comprehensive",
        "calculation_method": "PERCENTAGE_PLUS_PER_UNIT",
        "sum_insured": 10000000,
        "rate": 0.055,
        "display_rate_percent": 5.5,
        "raw_premium": 700000,
        "minimum_premium": 500000,
        "minimum_applied": false,
        "loadings": [],
        "discounts": [],
        "premium_after_discount": 700000,
        "taxes": [
          {
            "charge_code": "VAT-MAINLAND",
            "charge_name": "VAT Mainland",
            "charge_category": "TAX",
            "charge_scope": "RISK",
            "charge_type": "PERCENTAGE",
            "calculation_base": "NET_PREMIUM",
            "base_amount": 700000,
            "rate": 0.18,
            "amount": 126000,
            "is_taxable": false
          }
        ],
        "other_charges": [],
        "final_premium": 826000,
        "matched_rule": {
          "rule_id": "rule-1",
          "rule_name": "Passenger carrying no-claim rate",
          "rule_version": 1
        }
      }
    ],
    "totals": {
      "base_premium": 550000,
      "raw_premium": 700000,
      "loadings": 0,
      "discounts": 0,
      "premium_after_discount": 700000,
      "taxes": 126000,
      "other_charges": 0,
      "payable_premium": 826000
    },
    "errors": [],
    "warnings": [],
    "expires_at": "2026-07-28T08:00:00.000Z"
  }
}
```

## Multi-Risk Calculation

Request:

```json
{
  "product_code": "MOTOR",
  "effective_date": "2026-07-27",
  "quotation_type": "MOTOR",
  "currency_code": "TZS",
  "risks": [
    {
      "client_reference": "VEHICLE-001",
      "risk_id": "risk-1",
      "sum_insured": 45000000,
      "factors": {
        "motor_usage": "PRIVATE",
        "claim_record": "NO_CLAIM"
      }
    },
    {
      "client_reference": "VEHICLE-002",
      "risk_id": "risk-2",
      "sum_insured": 35000000,
      "factors": {
        "motor_usage": "PRIVATE",
        "seat_capacity": 5
      }
    }
  ]
}
```

Response:

```json
{
  "pricing_quote_id": "PQ-2026-00000003",
  "pricing_status": "CALCULATED",
  "calculated_at": "2026-07-27T08:10:00.000Z",
  "expires_at": "2026-07-28T08:10:00.000Z",
  "input_signature": "2a6212f4...",
  "quotation_type": "MOTOR",
  "currency_code": "TZS",
  "risks": [
    {
      "client_reference": "VEHICLE-001",
      "risk_id": "risk-1",
      "risk_code": "SP014001000001",
      "risk_name": "Private Vehicle Comprehensive",
      "rate_book_id": "rate-book-1",
      "rate_book_code": "RB-MOTOR",
      "rate_book_version": "2026.1",
      "rule_id": "rule-1",
      "rule_name": "Base rate",
      "rule_version": 1,
      "sum_insured": 45000000,
      "rate_type": "PERCENTAGE",
      "percentage_rate": 0.035,
      "base_premium": 1575000,
      "per_unit_factor_code": null,
      "per_unit_value": 0,
      "per_unit_amount": 0,
      "per_unit_premium": 0,
      "fixed_amount": 0,
      "minimum_amount": 250000,
      "gross_premium": 1575000,
      "final_premium": 1575000,
      "minimum_applied": false,
      "discount_control": {
        "max_rate": 0.1,
        "max_amount": 50000,
        "approval_threshold_rate": 0.05,
        "approval_threshold_amount": 25000,
        "effective_from": "2026-01-01",
        "effective_to": "2026-12-31"
      },
      "loading_control": {
        "max_rate": 0.08,
        "max_amount": 40000,
        "approval_threshold_rate": 0.04,
        "approval_threshold_amount": 20000,
        "effective_from": "2026-01-01",
        "effective_to": "2026-12-31"
      },
      "charges": [],
      "total_charge_amount": 0,
      "taxable_charge_amount": 0,
      "non_taxable_charge_amount": 0,
      "premium_including_charges": 1575000,
      "factors": {
        "motor_usage": "PRIVATE",
        "claim_record": "NO_CLAIM",
        "sum_insured": 45000000
      },
      "validation_errors": [],
      "validation_warnings": []
    }
  ],
  "failed_risks": [
    {
      "client_reference": "VEHICLE-002",
      "risk_id": "risk-2",
      "status": "INCOMPLETE",
      "message": "Pricing factor validation failed",
      "validation_errors": [
        "Required factor \"claim_record\" (Claim Record) is missing"
      ],
      "validation_warnings": [],
      "details": {
        "status": "INCOMPLETE",
        "calculation_allowed": false
      }
    }
  ],
  "grand_total": 1575000,
  "successful_risk_count": 1,
  "failed_risk_count": 1
}
```

## Motor Fleet Calculation

Motor fleet pricing uses the same `POST /premium-calculation/multi` endpoint. The request is just a multi-risk batch with fleet-style client references and shared context.

Request:

```json
{
  "product_code": "SP005001000000",
  "quotation_type": "MOTOR",
  "currency_code": "TZS",
  "effective_date": "2026-07-27",
  "branch_id": "b4f6a36f-16fa-4515-9da3-5a9d2d6a8d13",
  "department_id": "8af91869-5d0b-48ea-8e9c-7db8f91ed8d1",
  "risks": [
    {
      "client_reference": "FLEET-ITEM-001",
      "risk_id": "risk-fleet-1",
      "sum_insured": 100000000,
      "factors": {
        "seat_capacity": 28,
        "claim_record": "NO_CLAIM",
        "vehicle_use": "PASSENGER"
      }
    },
    {
      "client_reference": "FLEET-ITEM-002",
      "risk_id": "risk-fleet-2",
      "sum_insured": 85000000,
      "factors": {
        "seat_capacity": 18,
        "claim_record": "NO_CLAIM",
        "vehicle_use": "PASSENGER"
      }
    }
  ]
}
```

Response characteristics:

- one batch `pricing_quote_id`
- one `risk` row per successfully priced fleet item
- `failed_risks` entries for items that could not be calculated
- one fleet-level `grand_total`

## Non-Motor Calculation

Request:

```json
{
  "client_reference": "PROPERTY-001",
  "risk_id": "22222222-2222-4222-8222-222222222222",
  "sum_insured": 10000000,
  "factors": {
    "construction_type": "MASONRY",
    "location_zone": "URBAN",
    "claim_record": "NO_CLAIM"
  },
  "effective_date": "2026-07-27",
  "quotation_type": "NON_MOTOR",
  "currency_code": "TZS"
}
```

Response characteristics:

- same single-risk schema as motor pricing
- risk-specific rule matching still uses company, risk, factor, and effective-date context
- taxes and levies are applied exactly the same way as motor pricing

## Failed Calculation

Validation failure request:

```json
{
  "client_reference": "VEHICLE-003",
  "risk_id": "f724d42f-7f6e-4ad7-bf10-0fde2ef84f93",
  "sum_insured": 10000000,
  "factors": {
    "seat_capacity": "NOT_A_NUMBER"
  }
}
```

Validation failure response:

```json
{
  "status": "INCOMPLETE",
  "calculation_allowed": false,
  "message": "Pricing factor validation failed",
  "errors": [
    {
      "field": "seat_capacity",
      "code": "INVALID_NUMBER",
      "message": "Factor \"seat_capacity\" must be a valid number"
    }
  ],
  "warnings": [],
  "validation_errors": [
    "Factor \"seat_capacity\" must be a valid number"
  ],
  "validation_warnings": []
}
```

Configuration failure response example:

```json
{
  "statusCode": 404,
  "message": "No active matching rating rule found for risk risk-123",
  "error": "Not Found"
}
```

## Referral-Required Calculation

The pricing API does not return a top-level `referral_required` flag today. Referral behavior is expressed through pricing controls and quotation governance.

Example calculation response fragment:

```json
{
  "discount_control": {
    "max_rate": 0.1,
    "max_amount": 50000,
    "approval_threshold_rate": 0.05,
    "approval_threshold_amount": 25000,
    "effective_from": "2026-01-01",
    "effective_to": "2026-12-31"
  },
  "loading_control": {
    "max_rate": 0.08,
    "max_amount": 40000,
    "approval_threshold_rate": 0.04,
    "approval_threshold_amount": 20000,
    "effective_from": "2026-01-01",
    "effective_to": "2026-12-31"
  }
}
```

Interpretation:

- a quotation discount above `0.05` or above `25000` becomes approval-required
- a quotation loading above `0.04` or above `20000` should be treated as referral-required by downstream workflows
- manual exchange rates can also trigger governance approval through `exchange_rate_snapshot.approval_required = true`

## Discount Request

Discount requests are part of quotation create or replace payloads rather than a standalone pricing endpoint.

Authoritative quotation payload fragment:

```json
{
  "cover_note_dtl": {
    "risks_covered": [
      {
        "risk_code": "SP005001000001",
        "pricing_quote_id": "PQ-2026-00000001",
        "sum_insured": 10000000,
        "sum_insured_equivalent": 10000000,
        "premium_rate": 0.01,
        "premium_before_discount": 100000,
        "premium_after_discount": 95000,
        "premium_excluding_tax_equivalent": 95000,
        "premium_including_tax": 112100,
        "discounts_offered": [
          {
            "discount_type": 2,
            "discount_rate": 0.05,
            "discount_amount": 5000,
            "request_reason_code": "LOYALTY",
            "request_comment": "Introductory loyalty discount",
            "approval_required": true,
            "approval_status": "PENDING"
          }
        ],
        "taxes_charged": [
          {
            "tax_code": "VAT-MAINLAND",
            "is_tax_exempted": "N",
            "tax_exemption_type": null,
            "tax_exemption_reference": null,
            "tax_rate": 0.18,
            "tax_amount": 17100
          }
        ]
      }
    ]
  }
}
```

Behavior notes:

- changing the discount request requires `pricing.request_discount`
- changing approval or rejection decision fields requires `pricing.approve_discount`

## Override Request

Endpoint:

- `POST /tenant/quotations/:id/risks/:riskId/premium-overrides`

Request:

```json
{
  "proposed_premium": 95000,
  "override_reason": "Retention concession for renewal business",
  "supporting_notes": "Competitor renewal terms were 5% lower."
}
```

Response characteristics:

- stores the pending override against the selected quotation risk
- captures original calculated premium, proposed premium, requester, and reason
- blocks duplicate pending overrides on the same risk

## Pricing Validation

The pricing endpoint itself returns structured validation failures as shown above. Quotation save and replace also run authoritative pricing validation against stored pricing quotes.

Typical quotation-side pricing validation failure:

```json
{
  "statusCode": 400,
  "message": "Pricing quote PQ-2026-00000001 expired on 2026-07-26T08:00:00.000Z. Recalculate the premium and try again.",
  "error": "Bad Request"
}
```

Typical quotation payload validation failure:

```json
{
  "statusCode": 400,
  "message": "Quotation payload validation failed",
  "validation_errors": [
    "premium_after_discount must equal premium_before_discount minus all discounts_offered"
  ]
}
```

## TIRA Pre-Submission Validation

Endpoint:

- `POST /tenant/quotations/:id/submit`

Request:

```json
{}
```

Successful pre-submission validation is silent to the caller and the quotation proceeds to TIRAMIS submission. Failure returns an error before any external submission occurs.

Pricing-expiry failure:

```json
{
  "statusCode": 400,
  "message": "Pricing quote PQ-2026-00000001 expired on 2026-07-26T08:00:00.000Z. Recalculate the premium and try again.",
  "error": "Bad Request"
}
```

Approval-gate failure:

```json
{
  "statusCode": 400,
  "message": "Quotation approval is not complete. Current approval status is PENDING.",
  "error": "Bad Request"
}
```

Payment-gate failure:

```json
{
  "statusCode": 400,
  "message": "Quotation payment is not settled. Only direct payment mode can be submitted without a settled invoice.",
  "error": "Bad Request"
}
```
