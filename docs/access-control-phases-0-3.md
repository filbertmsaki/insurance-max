# Insurance MAX access control: Phases 0–3

Status: implementation foundation. This document records current repository behavior and the role/scope decisions implemented in Phases 0–3. Approval thresholds and the failed-TIRA correction policy remain Phase 5 and Phase 4 work respectively.

## Phase 0 — requirements inventory

### Existing controls

- Company memberships, role assignments, direct permission assignments, active branch/department assignments, and `quotation_policy_data_scope` already exist.
- The existing scope enum is `USER`, `DEPARTMENT`, `BRANCH`, and `COMPANY`; scoped query helpers add the active company ID and apply ownership/branch/department/company filters.
- Quotation endpoints already distinguish read, create, update, complete, approval, TIRA submission/retry, cancellation, and draft deletion.
- Endorsement, renewal, and cancellation endpoints have granular workflow permissions. Policy transaction workflows already enforce lifecycle state and maker-checker for transaction approval.
- Underwrite line permissions are additional gates over legacy action permissions.

### Phase 0 decisions for this implementation

- Company isolation is mandatory for every tenant business record.
- `USER` means own/assigned records; `DEPARTMENT` means the selected assigned department; `BRANCH` means the selected assigned branch; `COMPANY` means records in the active company.
- Role names do not bypass permissions. Approval, submission, issue, and administration remain separate permissions.
- Platform support access should be separately granted and audited; platform role alone does not expose tenant transactions.
- Scope metadata added in Phase 1 is optional on old records for compatibility and will be made required through a future controlled migration after all grant-writing paths accept it.

## Phase 1 — scoped grant data model

The migration `1791500000000-ScopedBusinessPermissions` adds nullable scope metadata to direct company permission grants and creates `role_permission_scopes`. Direct grants support one of four scope values and optional branch/department target IDs. Role grants use a permission-specific scope default for all branches/departments assigned to each role member. Existing direct grants are backfilled from the membership’s current scope.

Role permission scopes are editable from the role form and returned with role details. Unconfigured role permissions retain the legacy membership scope during rollout. Branch and department role scopes are intersected with each member’s current assignments; direct grants can optionally target one assigned branch or department.

## Phase 2 — least-privilege role policy

Use these bundles as the standard company role catalog. Company-specific assignment of actions remains subject to scope and record-state rules.

| Role | Default business permissions | Administration |
|---|---|---|
| Platform Admin | No tenant business permissions by default; separate, audited support grants only | Platform configuration, permission catalog, platform roles and support tooling |
| Company Admin | Read across company; explicitly assigned business actions only | Company memberships, roles, permissions, branches, departments, company settings and data-scope assignment |
| Underwriting Manager | Company/branch read, create, update, submit, transaction management, approval only within separately configured authority | No platform administration; no company security administration by default |
| Approver | Read within assigned scope; approve, reject, request changes only for assigned transaction types | None |
| Underwriter | Own create/update; scoped read; submit for approval; transaction creation/progression as granted | None |
| Normal Business User | Own quotation create/manage; permitted-scope read; submitted correction only under Phase 4 rule; draft deletion only | No company management |
| Agent | Own/channel quotation work and related customer/policy reads | None |
| Broker | Own/broker-of-record quotation work and related customer/policy reads | None |
| Customer | Own portal quotations/policies and customer-facing renewal/cancellation requests | None |

Do not assign `quotations:delete`, `policies:delete`, or administrative role/permission-management permissions to ordinary business roles. Do not infer approval or TIRA authority from role names.

## Phase 3 — backend resource authorization

Use the active authenticated membership as the source of `company_id`; never accept company/owner/branch/department authority from a request body. Every service query must constrain by active company and use the scope helper for record visibility. Branch and department targets must be validated against both company and membership assignments. Mutations must additionally verify record owner/assignment and current workflow state.

Apply scope consistently to list, detail, dashboard, export, search, and aggregate operations for quotations, policies, and policy transactions. Underwrite routes continue to require both line and action permissions. Cross-company IDs should resolve as not found.

## Phase 4–11 backlog

4. Enforce quotation ownership, submitted locking, and correctable failed-TIRA exception.
5. Centralize amount/risk authority and maker-checker policy for all approvals.
6. Complete transaction-specific policy, endorsement, renewal, and cancellation gates.
7. Restrict deletion and retain lifecycle history.
8. Complete immutable audit coverage for sensitive actions.
9. Align all frontend menu, button, and form states with backend authorization outcomes.
10. Dry-run grant migration and roll out by company with monitoring and rollback.
11. Verify role/action/scope/status boundaries and regression behavior.
