# Insurance Max — Project Status & Remaining Work

Date: 2026-08-08
Purpose: a single reference for what this project is, what a full gap audit found, what has since been fixed, and what's still open. Written mid-remediation, after completing milestones M0–M4 of the plan below.

## 1. What this project is

Insurance Max is a multi-tenant insurance platform built as an NX-style monorepo:

- **`apps/insurance-portal-service`** — the core backend. Multi-tenant company/branch/user management, RBAC, the insurance product/rating engine, customers, quotations, policies, policy transactions (endorsements/cancellations/renewals), claims, complaints, reinsurance, regulatory compliance, billing/finance, reporting/analytics, documents/e-signature, customer & intermediary self-service portals, and SaaS billing for the platform itself.
- **`apps/tiramis`** — a separate microservice that integrates with TIRA (Tanzania's insurance regulator) — submits cover notes/policies/claims/reinsurance, tracks acknowledgements and final responses, and handles regulator callbacks.
- **`apps/insurance-portal-web`** — the React frontend.
- **`libs/*`** — shared config, persistence, contracts, observability, and portal-shared helper libraries.

Both backend services use PostgreSQL via TypeORM with migration-based schema management (no `synchronize: true` anywhere). Redis backs sessions, 2FA challenges, and BullMQ queues.

## 2. The gap audit

A full read-only audit against the project's Phase 0–18 roadmap is in **[`docs/phase-0-18-implementation-gap-audit.md`](phase-0-18-implementation-gap-audit.md)** — read that for the complete matrix and detailed findings. Headline result: **3 of 19 phases fully complete, 15 partial, 1 broken, 0 fully unimplemented.** The backend was further along than expected in most areas, but a few gaps were serious:

- **Phase 12 (Endorsements/Cancellations) was BROKEN**: an endorsement or cancellation could be fully approved and paid for, and then never actually take effect on the policy or get filed with the regulator — the code path that was supposed to apply it was dead code that nothing called.
- **Fabricated data presented as real**: the analytics forecast engine returned a hardcoded formula, not a real projection, through a real-looking API.
- **Missing entirely**: certificate/PDF generation for issued policies; Claims, Complaints, and Reinsurance frontend UI (the backends were ready, nothing on screen).
- Several **dead/orphaned modules** (schema and code with zero real usage) and **CI gates that were quietly broken** (a stale route-inventory snapshot).

## 3. The remediation plan

Full plan with architectural decisions: `C:\Users\Developer\.claude\plans\generic-hopping-dewdrop.md` (local to this machine, not in the repo). It breaks the backlog into 17 milestones, M0–M16, sequenced roughly by priority and dependency. **M0 through M4 are done and verified** (build + full test suite + live app boot after each). M5–M16 remain.

### Done

| # | Milestone | What was actually built |
|---|---|---|
| **M0** | Unblock CI + cleanup | Regenerated the stale route-inventory CI snapshot. Deleted 2 genuinely-empty, never-committed scaffold folders (`tenant/distribution`, `tiramis-listener`) and 2 dead stub modules (`regulatory-sync`, `platform/user-roles`) — importantly, the audit's "duplicate module registration" finding turned out to be a false positive (one entry in `imports`, one in `exports` — normal NestJS practice), corrected before acting on it. |
| **M1** | Fix endorsements/cancellations (the BROKEN phase) | Built the real "apply to policy" logic (creates the next `PolicyVersion`, updates premium totals/status, clears the pending-transaction lock) plus full TIRAMIS resubmission wiring (payload builder, submission service via `forwardRef` to avoid a circular module dependency, new submit/retry endpoints, async callback routing back to accept/reject/apply). Found and fixed a real latent bug along the way: the existing rejection path would have permanently blocked retries after a transient network failure, not just genuine regulatory rejections — added a distinct retryable-failure path. |
| **M2** | Certificate generation + finish `cover-notes` | Replaced a hand-rolled, layout-free "raw PDF syntax" generator with real `pdf-lib` rendering (benefits the whole document-template pipeline). Built `CertificateGenerationService` (policy/motor certificates with a QR verification code, stored through the existing documents infrastructure). Finished the entity-only `cover-notes` module (service + controller + new `cover-notes:read` permission). A test caught a real bug before it shipped: `'NON_MOTOR'.includes('MOTOR')` is `true` in JS, which would have mis-classified every non-motor certificate — fixed by querying the actual `quotation_flow` field instead. |
| **M3** | Fix fabricated forecasts + reporting/KPI | Forecasts now use real linear-regression/moving-average math over `analytics_daily_metrics` instead of a hardcoded formula. Built a real weighted-average KPI calculator for `tiramis.success_rate` (the generic sum-fallback is mathematically wrong for a percentage metric — verified the other two seeded KPIs were fine as sums). Built `ProductPerformanceSnapshotService` + a daily cron job to actually populate `product_performance_snapshots`, which nothing had ever written to — verified the aggregation SQL directly against the real database. |
| **M4** | Finish `company-configs` / `system-configs` | Both were entity-only with zero consumers. Built full CRUD (service + controller + DTOs + validation) for both — per-company platform-managed settings and platform-wide settings respectively. Added `company-configs:read` / `system-configs:read` permissions; mutations gated to the `OWNER` role matching the existing sibling-module convention. Deliberately did *not* force these into unrelated business logic (e.g. retrofitting the cancellation-method default) — no confirmed real consumer existed, and the plan explicitly allowed clean CRUD as the fallback when forcing a fit would add risk without real value. |

Every milestone was verified the same way: `npm run build:insurance-portal-service`, the full backend test suite (currently **154 suites / 998 tests, all passing**), and a live app boot confirming the DI graph resolves and new routes are mapped and correctly permission-gated — not just "it compiles."

### Remaining

| # | Milestone | Scope |
|---|---|---|
| **M5** | Enforce product/category access-control | `user_category_access` / `department_category_access` / `branch_category_access` (and product equivalents) are written to but never read by product/category/risk listing — access control on the product catalogue isn't actually enforced end-to-end. |
| **M6** | Money + TIRAMIS test coverage | ~20 finance services and the entire `apps/tiramis` retry/callback pipeline have little to no test coverage despite being the highest money/regulatory stakes in the repo. |
| **M7** | Frontend: Claims module | New module — backend is ready, no UI exists at all. |
| **M8** | Frontend: Complaints module | Same — no UI exists. |
| **M9** | Frontend: Reinsurance module | Same — no UI exists (treaties, facultative placements). |
| **M10** | Live-gate reinsurance capacity + bordereaux/premium-accounts | Capacity checks exist but aren't enforced at cession creation (over-cession is currently possible); bordereaux/premium-account subsystems have tables and entities with zero service/controller wiring. |
| **M11** | Regulatory-compliance test coverage | ~2270 lines of levy/obligation/returns logic with zero tests. |
| **M12** | Real e-signature crypto + real retention enforcement | "Signing" today is a status-flag flip, not a cryptographic signature; document "verification" doesn't recompute/compare the stored checksum; retention's `dryRun()` is hardcoded to report zero matches. |
| **M13** | Quotation customer-snapshot + asset verification | A migration added `quotations.customer_snapshot*` columns and a `quotation_risk_assets` table that nothing in the code ever references — finish wiring them or fold the intent elsewhere. |
| **M14** | Customer/Intermediary portal frontend gaps | Backend supports invoices/receipts/policies/quotations/commissions for both portals; the frontend only wires dashboard/profile/documents/notifications/messages/signatures. |
| **M15** | Remove dead `/billing/*` frontend module | Superseded by `/finance/*`, which is the live implementation — the old routes just redirect today. |
| **M16** | SaaS billing benchmark rebuild + `PORTAL_ADMIN` role | `platform-intelligence`'s benchmark rebuild is an explicit not-implemented stub; the seeded `PORTAL_ADMIN` role (~45 permissions) has no confirmed assignment path anywhere in the code. |

## 4. Things worth knowing before continuing

- **Two unrelated "Phase N" numbering schemes exist in migration filenames.** An early pricing-engine-internal track (`Phase2PricingStandards` … `Phase25PricingSecurityAndAuthorization`) is unrelated to this project's master roadmap (the Phase 0–18 referenced throughout this document). Documented in `apps/insurance-portal-service/src/database/migrations/README.md` — do not rename existing migration files to fix this; TypeORM tracks executed migrations by class name, so renaming one that's already run causes it to re-run or conflict.
- **An automated checkpoint system commits to `main` periodically** with generic messages ("changes", "test changes", etc.) — don't be alarmed by unfamiliar commits; check `git log`/`git show --stat` to see what actually changed.
- **A stale git worktree exists** at `.claude/worktrees/agent-a8cdd3fc35d59a62f` (its own branch, `worktree-agent-a8cdd3fc35d59a62f`, last touched 2026-08-06) — it's on a separate branch and hasn't been the cause of anything on `main`, but its presence under the repo root means path-substring-matching tools (including `jest <path>` CLI filters) can accidentally pick up its files too. Prefer the full test suite or `--testPathPatterns` with a precise anchor when in doubt.
- **`uploads/` was untracked-but-not-ignored**, so real estatement documents/PDFs generated by e2e test runs were getting swept into commits. Added to `.gitignore` (2026-08-08). ~84 already-tracked files from prior sessions remain in git history — worth a deliberate cleanup decision (not done here since it's a git-history change, not something to do silently).
- **Local dev environment notes**: Postgres runs as a Windows service (`postgresql-x64-17`) that occasionally stops; if `Start-Service` fails without admin rights, `& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" start -D "...\17\data"` works directly. Redis runs inside WSL2 (`Ubuntu` distro, `redis-server` on `127.0.0.1:6379`) — if it's not up yet when the portal service starts, the app degrades gracefully but stops retrying after `REDIS_RETRY_ATTEMPTS`; restart the app once Redis is confirmed reachable.
- **Every milestone so far has been done with real database/app verification**, not just type-checking — wipe/migrate/seed, start the real app, hit real endpoints. Keep doing this for M5 onward; several of the audit's original findings (the "duplicate registration" false positive, the `NON_MOTOR`/`MOTOR` substring bug) were only caught by actually running things, not by reading code.
