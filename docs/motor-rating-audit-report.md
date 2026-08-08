# Motor Rating Refactor Audit Report

Date: 2026-07-30
Scope: Phase 1 audit before Motor-only rating cleanup and rebuild.

## Executive Summary

The current pricing stack already has the right broad building blocks for a safe Motor-only refactor:

- Structured pricing rate types exist.
- Rate books exist with draft, review, approve, publish, and retire lifecycle states.
- Immutable pricing quote snapshots already exist.
- Quotations already preserve `pricing_quote_id` references and validate stored pricing against snapshots.

The main problem is not the pricing engine foundation. The problem is configuration contamination:

- `rating_factors` currently contains many fields that are not rating inputs.
- `risk_required_factors` is seeded using name heuristics rather than tariff-driven risk requirements.
- Motor per-seat and age/weight classifications are only partially modeled.
- fixed-premium risks still flow through APIs and frontend behavior that assume `sum_insured`.
- legacy formula text is still used as a compatibility bridge for several Motor risks.

## 1. Rating-Factor Tables And Entities

Primary rating-factor entities and tables:

- `rating_factors`
  - Entity: `apps/insurance-portal-service/src/modules/tenant/rating-factors/entities/rating-factor.entity.ts`
  - Service: `apps/insurance-portal-service/src/modules/tenant/rating-factors/rating-factors.service.ts`
  - Controller: `apps/insurance-portal-service/src/modules/tenant/rating-factors/rating-factors.controller.ts`
- `risk_required_factors`
  - Entity: `apps/insurance-portal-service/src/modules/tenant/risk-required-factors/entities/risk-required-factor.entity.ts`
  - Service: `apps/insurance-portal-service/src/modules/tenant/risk-required-factors/risk-required-factors.service.ts`
  - Controller: `apps/insurance-portal-service/src/modules/tenant/risk-required-factors/risk-required-factors.controller.ts`

Current `rating_factors` model fields:

- `code`
- `name`
- `data_type`
- `options`
- `default_value`
- `is_required`
- `is_active`

Audit finding:

- The model does not currently capture the requested `unit` concept.
- `data_type` is generic (`NUMBER`, `TEXT`, `BOOLEAN`, `DATE`, `SELECT`, `MULTI_SELECT`) rather than domain-aware.
- `is_required` exists both on the master factor and on the risk mapping, which can create conflicting semantics.

## 2. Risk-Factor Mapping Tables

Risk-to-factor mapping is currently handled through:

- `risk_required_factors`
  - `risk_id`
  - `factor_id`
  - `is_required`
  - `sort_order`

Audit finding:

- This mapping is the main place where the current misconfiguration is expressed.
- The existing seeder assigns many operational and TIRAMIS-related fields to risks that should not be part of rating input.

## 3. Rate-Book Tables

Rate-book persistence:

- `pricing_rate_books`
  - Entity: `apps/insurance-portal-service/src/modules/tenant/pricing-rate-books/entities/pricing-rate-book.entity.ts`
  - Service: `apps/insurance-portal-service/src/modules/tenant/pricing-rate-books/pricing-rate-books.service.ts`

Lifecycle support already exists:

- `DRAFT`
- `UNDER_REVIEW`
- `APPROVED`
- `PUBLISHED`
- `REJECTED`
- `RETIRED`

Audit finding:

- This is suitable for the requested production-safe Motor rebuild.
- Published books are already protected from direct editing; clone-and-publish is the existing pattern.

## 4. Rating-Rule Tables

Primary rule persistence:

- `risk_rating_rules`
  - Entity: `apps/insurance-portal-service/src/modules/tenant/risk-rating-rules/entities/risk-rating-rule.entity.ts`
  - Service: `apps/insurance-portal-service/src/modules/tenant/risk-rating-rules/risk-rating-rules.service.ts`
  - Configuration validator: `apps/insurance-portal-service/src/modules/tenant/risk-rating-rules/risk-rating-rule-configuration-validator.service.ts`

Current rule fields already include most of the requested structure:

- `risk_id`
- `rate_book_id`
- `rate_type`
- `percentage_rate`
- `fixed_amount`
- `per_unit_amount`
- `per_unit_factor_code`
- `minimum_amount`
- `priority`
- `rule_version`
- `is_active`
- audit columns

Additional current fields:

- discount/loading controls
- legacy `formula`

Audit finding:

- The core schema is close to the target state.
- The main cleanup required is removing dependence on legacy `formula` for Motor rules and rebuilding rules into structured fields only.

## 5. Rule-Condition Tables

Rule conditions are stored in:

- `risk_rule_conditions`
  - Entity: `apps/insurance-portal-service/src/modules/tenant/risk-rule-conditions/entities/risk-rule-condition.entity.ts`
  - Service: `apps/insurance-portal-service/src/modules/tenant/risk-rule-conditions/risk-rule-conditions.service.ts`

Condition support already includes:

- `EQUALS`
- `NOT_EQUALS`
- `GREATER_THAN`
- `GREATER_THAN_OR_EQUAL`
- `LESS_THAN`
- `LESS_THAN_OR_EQUAL`
- `BETWEEN`
- `IN`
- `NOT_IN`

Audit finding:

- The condition model is sufficient for weight-band and age-band validation and rule selection.
- No Motor-specific rule-condition seeder is currently rebuilding weight/age selection explicitly.

## 6. Calculation And Pricing Services

Backend pricing flow currently spans:

- `pricing-validation.service.ts`
- `rating-factor-validator.service.ts`
- `rating-rule-matcher.service.ts`
- `premium-breakdown.service.ts`
- `structured-pricing-calculator.service.ts`
- pricing strategies:
  - `percentage-pricing.strategy.ts`
  - `fixed-pricing.strategy.ts`
  - `percentage-plus-fixed-pricing.strategy.ts`
  - `percentage-plus-per-unit-pricing.strategy.ts`
  - `per-unit-pricing.strategy.ts`
- `pricing-engine.service.ts`
- `pricing-charge.service.ts`
- `pricing-quote.service.ts`
- `quotation-recalculation.service.ts`
- `pricing-runtime-cache.service.ts`

Audit findings:

- The engine already uses `decimal.js`-backed helpers and structured strategies.
- `FORMULA` rules are intentionally non-executable now; only recognized legacy shorthand is bridged.
- `pricing-engine.service.ts` still normalizes `sum_insured` for every request and the DTO still requires it even for fixed-premium risks.
- `rating-factor-validator.service.ts` currently performs generic type validation only; it does not yet enforce Motor-specific rules like positive seats, weight bands, or future-year rejection.

## 7. DTOs Accepting Rating Factors

Backend DTOs:

- `apps/insurance-portal-service/src/modules/tenant/premium-calculation/dto/calculate-premium.dto.ts`
  - `CalculateSingleRiskPremiumDto`
  - `CalculateMultiRiskPremiumDto`

Quote submission DTOs influenced by pricing output:

- `apps/insurance-portal-service/src/modules/tenant/quotations/dto/quotation-payload.dto.ts`

Audit findings:

- `CalculateSingleRiskPremiumDto` requires `sum_insured` unconditionally.
- `factor_values` is still accepted as a deprecated alias.
- quotation payload DTOs do not accept raw factor definitions directly, but they depend on the persisted rating output fields and `pricing_quote_id`.

## 8. Frontend Forms Displaying Rating Factors

Generic pricing UI:

- `apps/insurance-portal-web/src/modules/pricing/components/RatingFactorFields.tsx`
- `apps/insurance-portal-web/src/modules/pricing/components/RiskPricingForm.tsx`
- `apps/insurance-portal-web/src/modules/pricing/hooks/usePricingCalculator.ts`

Quotation wizard flow:

- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/components/RiskRow.tsx`
- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/steps/RiskPremiumStep.tsx`
- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/hooks/useRiskPremiumCalculation.ts`
- `apps/insurance-portal-web/src/modules/tenant/quotations/wizard/utils/riskFactorResolver.ts`

Product-engine admin UI:

- `apps/insurance-portal-web/src/modules/tenant/product-engine/pages/rating-factors/RatingFactorsPage.tsx`
- `apps/insurance-portal-web/src/modules/tenant/product-engine/pages/rating-rules/RatingRulesPage.tsx`
- `apps/insurance-portal-web/src/modules/tenant/product-engine/pages/risks/RisksPage.tsx`

Audit findings:

- The frontend still maps many non-rating fields into the factor payload through `riskFactorResolver.ts`.
- The generic factor field component is dynamic enough for the target design.
- Automatic wizard premium recalculation is currently disabled via `AUTO_CALCULATION_DISABLED = true` in `useRiskPremiumCalculation.ts`, so dynamic Motor recalculation is not presently active.

## 9. Seeders Creating Rating Factors And Rating Rules

Relevant seeders and scripts:

- `002-product-engine.seed.ts`
- `003-rating-factors.seed.ts`
- `004-risk-factor-link.seed.ts`
- `rate-text-parser.ts`
- `scripts/audit-rate-parsing.ts`

Audit findings:

- `003-rating-factors.seed.ts` creates many non-rating factors.
- `004-risk-factor-link.seed.ts` assigns factors by risk/product name heuristics instead of Motor tariff logic.
- `002-product-engine.seed.ts` seeds rules directly into `risk_rating_rules` and does not create rate-book versions for the existing seed path.
- legacy formula parsing is still part of the seed pipeline for Motor.

## 10. Migrations Affecting Pricing

Key pricing migrations identified:

- `1779875576591-Migration.ts`
  - initial pricing factor, rule, and required-factor tables
- `1785100000000-Phase2PricingStandards.ts`
  - percentage-rate normalization and pricing standard updates
- `1785200000000-Phase7PricingRateBooks.ts`
  - rate-book tables and related structure
- `1785300000000-Phase8PricingQuoteSnapshots.ts`
  - immutable pricing quote snapshots
- `1785400000000-Phase9QuotationPricingAuthority.ts`
  - quotation pricing authority controls
- `1785500000000-Phase12DiscountLoadingControls.ts`
  - discount/loading rule fields and constraints
- `1785600000000-Phase13ManualPremiumOverrides.ts`
  - premium override persistence
- `1788700000000-Phase17ExchangeRateSnapshots.ts`
  - exchange-rate snapshot handling
- `1788800000000-Phase22MigrationAndBackwardCompatibility.ts`
  - snapshot backfill and compatibility checks
- `1788900000000-Phase25PricingSecurityAndAuthorization.ts`
  - pricing permissions

Audit finding:

- Historical pricing protection is already embedded in migrations and quotation validation flows, so the cleanup migration must preserve these references rather than delete through them.

## 11. Quotation Pricing Snapshots

Snapshot storage:

- `pricing_quotes`
  - Entity: `apps/insurance-portal-service/src/modules/tenant/pricing/entities/pricing-quote.entity.ts`
  - Persistence: `apps/insurance-portal-service/src/modules/tenant/pricing/application/pricing-quote.service.ts`

Historical quotation linkage:

- quotation risks store `pricing_quote_id`
- quotation validation checks pricing quote ownership, expiry, and sum insured consistency
- approved premium overrides are tied to quotation risk rows, not rate-book data

Audit findings:

- Historical quote snapshots are already immutable in practice and must be retained.
- Snapshot payloads already contain `input_payload`, `factor_payload`, `result_payload`, `rate_book_id`, `rate_book_version`, and matched rule metadata.

## 12. TIRAMIS And Operational Fields Currently Mixed Into Rating Factors

Current seeded factors that should not remain in Motor rating configuration include:

- `payment_mode`
- `currency_code`
- `exchange_rate`
- `sale_point_code`
- `officer_name`
- `officer_title`
- `policy_holder_type`
- `policy_holder_id_type`
- `region_code`
- `district_code`
- `tax_code`
- `is_tax_exempted`
- `motor_category`
- `motor_type`
- `registration_number`
- `chassis_number`
- `make`
- `model`
- `body_type`
- `engine_number`
- `engine_capacity`
- `fuel_used`
- `motor_usage`
- `owner_name`
- `owner_category`
- `policy_start_date`

Audit finding:

- These are currently used as factor inputs by both the seeders and `riskFactorResolver.ts`, even though they belong to quotation, vehicle, customer, tax, operational, or TIRAMIS contexts.

## 13. Non-Motor Categories Currently Using The Same Pricing Engine

Non-Motor categories seeded into the same engine:

- `GIT`
- `MISC`
- `ENGINEERING`
- `FIRE`
- `MARINE`

Audit finding:

- They currently share the same pricing engine, rule entity, and factor-validation pipeline.
- The Motor refactor must explicitly return a controlled configuration error for non-Motor products that no longer have active rules after cleanup.

## 14. Current Motor Tariff Footprint In Seed Data

Motor seed scope currently present:

- products: 5
  - `SP014001000000`
  - `SP014002000000`
  - `SP014003000000`
  - `SP014004000000`
  - `SP014005000000`
- Motor risks: 51
- Motor rules: 51

Current seeded Motor rule patterns:

- `PERCENTAGE`
- `FIXED`
- `PERCENTAGE_PLUS_FIXED`
- legacy formula-backed cases that resolve to:
  - `PERCENTAGE_PLUS_PER_UNIT`
  - `PER_UNIT`

Audit findings:

- Passenger-carrying per-seat risks still rely on legacy text like `15,000 per seat` or `5.5% + 15,000 per seat`.
- Weight bands and age bands are represented by separate risk codes and names, not by explicit condition-driven validation.

## 15. Dependencies Likely To Break If Old Factors Are Removed

Primary breakpoints:

- `riskFactorResolver.ts`
  - currently builds factor payloads from quotation, vehicle, and operational fields
- `rating-factor-validator.service.ts`
  - assumes factor definitions still exist for any supplied code
- `risk-rating-rule-configuration-validator.service.ts`
  - validates per-unit factor codes and condition factor codes against active `rating_factors`
- `rating-rule-matcher.service.ts`
  - still normalizes legacy factor names such as `vehicle_weight_kg` and `cargo_weight_ton`
- `useRiskPremiumCalculation.ts`
  - assumes rule preview plus current factor list shape and currently has disabled auto-calculation
- quotation persistence and validator
  - require backend-issued `pricing_quote_id`
  - compare quotation pricing against stored snapshots
- rate-book lifecycle
  - published books cannot be edited directly

## 16. Key Design Gaps Against The Requested Target

Gap 1:

- `sum_insured` is still mandatory at the pricing API layer for every risk.
- Target behavior requires fixed and per-seat-only risks to work without mandatory sum insured.

Gap 2:

- factor data is typed generically but not validated with Motor-specific semantics.
- Target behavior requires strict checks for seat capacity, gross weight, year of manufacture, and requiredness by risk/rate type.

Gap 3:

- non-rating information is mixed into the factor catalog and risk-factor mappings.
- Target behavior requires only four Motor pricing factors:
  - `sum_insured`
  - `seat_capacity`
  - `gross_weight_tons`
  - `year_of_manufacture`

Gap 4:

- Motor passenger-carrying and some legacy tariffs still depend on formula text parsing.
- Target behavior requires structured rule fields only, with no dependence on free-text formulas for newly rebuilt Motor rules.

Gap 5:

- the current system does not yet expose the exact requested `GET /insurance-risks/:riskId/rating-requirements` contract.
- Existing closest API is `GET /risk-required-factors/by-risk/:riskId`.

Gap 6:

- wizard auto-calculation is currently disabled.
- Target behavior requires local validation, debounced backend recalculation, and minimum-premium display.

## 17. Additional Runtime Issues Found During Audit

Issue 1:

- `pricing-engine.service.ts` sets `raw_premium` from `breakdown.base_premium`.
- For `FIXED`, `PERCENTAGE_PLUS_FIXED`, `PERCENTAGE_PLUS_PER_UNIT`, and `PER_UNIT`, that does not represent the true raw premium defined in the requested contract.

Issue 2:

- `pricing-quote.service.ts` builds breakdown items with `premium_after_discount` from `risk.final_premium`, which is the post-minimum value before taxes and before later quotation-level adjustment semantics.
- This is likely to produce ambiguous breakdown reporting when we tighten the Motor calculation contract.

Issue 3:

- current factor naming includes `vehicle_weight_kg` and `cargo_weight_ton`, but the requested Motor target factor is `gross_weight_tons`.
- A deliberate migration path will be required to avoid mismatched rule references.

## 18. Recommended Safe Refactor Direction

Recommended implementation sequence, aligned to the requested order:

1. Add a cleanup/archive migration that:
   - archives referenced rules and rate books
   - deletes only unreferenced draft/test configuration
   - preserves `pricing_quotes` and quotation-linked historical data
2. Introduce the new Motor factor catalog and mapping rules.
3. Rebuild Motor rate books and rules into structured fields only.
4. Add Motor-specific validation and risk-selection checks.
5. Replace frontend factor derivation with Motor-only dynamic factor rendering.
6. Tighten premium snapshot payloads and automated tests.
7. Disable non-Motor runtime pricing with a controlled configuration error until the next phase.

## 19. Records To Preserve During Cleanup

Must preserve:

- insurance categories
- insurance products
- TIRAMIS product codes
- insurance risks
- TIRAMIS risk codes
- `pricing_quotes`
- quotation records
- quotation risk rows
- approved premium overrides
- audit logs

Can be cleaned, archived, or rebuilt carefully:

- `risk_required_factors`
- obsolete `rating_factors`
- obsolete `risk_rule_conditions`
- obsolete `risk_rating_rules`
- unpublished or invalid draft/test `pricing_rate_books`

## 20. Immediate Next Implementation Targets

The next code changes should focus on:

- a Motor cleanup/archive migration
- the new four-factor Motor seed model
- structured Motor rule rebuild into versioned rate books
- a Motor rating-requirements endpoint
- Motor-specific validator updates
- wizard dynamic field rendering and recalculation re-enable
