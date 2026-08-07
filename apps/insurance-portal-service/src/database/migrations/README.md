# Migration naming note

Some migration filenames in this folder use a `PhaseN...` prefix (e.g.
`Phase2PricingStandards`, `Phase7PricingRateBooks`, `Phase12DiscountLoadingControls`,
`Phase13ManualPremiumOverrides`, `Phase16ChargeRules`, `Phase17ExchangeRateSnapshots`,
`Phase22MigrationAndBackwardCompatibility`, `Phase25PricingSecurityAndAuthorization`,
`Phase2FinancePolicyLifecycle`, `Phase2AuthenticationHardening`, `Phase3AuthorizationAndAudit`,
`Phase18*`).

**These numbers belong to an internal pricing-engine/feature-delivery numbering
track and are unrelated to this project's master Phase 0–18 roadmap** (see
`docs/phase-0-18-implementation-gap-audit.md`). The same numeral means two
different things depending on which track a filename belongs to — for example
`Phase13ManualPremiumOverrides` has nothing to do with master-roadmap Phase 13
(policy transactions).

Do not rename existing migration files to resolve this: migration class names
are the identity TypeORM uses to track what has already run (stored in the
`migrations` table), so renaming an already-executed migration makes TypeORM
treat it as new and can cause it to re-run or conflict on any database that
has already migrated. New migrations should avoid the bare `PhaseN` prefix
going forward to prevent further collisions with the master roadmap numbering.
