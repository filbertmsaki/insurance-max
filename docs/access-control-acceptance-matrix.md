# Access-control acceptance matrix (Phase 11)

Run in a staging database with at least two companies, two branches, two departments, and users for every listed role. This matrix is a release gate. Record API request, actor membership, target record company/scope/state, expected outcome, observed outcome, and audit event ID for every row.

| ID | Scenario | Expected backend outcome | Required evidence |
|---|---|---|---|
| TEN-01 | User in company A requests company B quotation, policy, endorsement, renewal, or cancellation by ID | Not found/denied; no record data returned or mutation made | Response and no cross-company side effect |
| SCOPE-01 | USER permission reads/writes own record | Allowed only for owned/assigned records | Requester and owner IDs |
| SCOPE-02 | DEPARTMENT permission targets an assigned department | Allowed for that department only | Department IDs and query result |
| SCOPE-03 | BRANCH permission targets an assigned branch | Allowed for that branch only | Branch IDs and query result |
| SCOPE-04 | COMPANY permission within active company | Allowed across that company only | Company IDs and query result |
| SCOPE-05 | Branch/department grant references a different company or an unassigned target | Rejected at grant time or denied at use; fail closed | Grant response and authorization log |
| ROLE-01 | Platform Admin without explicit tenant support/business grant accesses tenant transaction | Denied | Active role/grants and response |
| ROLE-02 | Company Admin opens company membership/role settings | Allowed with administrative permission | Permission and successful response |
| ROLE-03 | Normal business user opens company management | Denied and menu absent | API response and UI capture |
| QUO-01 | Normal user creates quotation | Created with server-derived company, owner, branch, and department | Persisted ownership values |
| QUO-02 | Normal user views a different user's quotation within permitted branch | Read allowed; mutation denied | List/detail and attempted update response |
| QUO-03 | Normal user edits own unsubmitted draft | Allowed when permission and workflow state permit | Before/after record and audit history |
| QUO-04 | Normal user edits submitted quotation with pending/successful TIRA state | Denied | Response and unchanged payload/version |
| QUO-05 | Normal user corrects another user's failed TIRA submission in their active branch | Allowed only through correction path, with update grant; reason and correction audit retained | TIRA attempt, changed-field audit, actor/branch |
| QUO-06 | Normal user corrects failed TIRA record from another branch, or a business-status failure without failed TIRA result | Denied | Response and unchanged payload |
| QUO-07 | Delete quotation with approval/payment/TIRA/portal/financial/transaction history | Denied | Response; record and related history retained |
| QUO-08 | Delete untouched draft | Soft-deleted and critical audit event committed atomically | Deleted timestamp and audit hash/event ID |
| POL-01 | Direct update/delete of system-issued policy contract terms | Denied; use policy transaction | Response; policy version unchanged |
| POL-02 | Delete any policy from frontend or direct API | UI action absent; API returns conflict and logs denied attempt | UI capture, response, audit event |
| POL-03 | Create endorsement for canceled/ineligible policy or out-of-period effective date | Denied by eligibility checks | Eligibility blockers |
| POL-04 | Apply debit endorsement without required approval/payment/TIRA outcome | Denied | Transaction stage/status and response |
| REN-01 | Renewal before/after configured window, for canceled/unsynchronized/already-renewed policy, or with active transaction | Denied with blocker | Eligibility response and source policy state |
| REN-02 | Customer accepts renewal offer | Acceptance recorded; policy not issued until required underwriting/payment/TIRA steps finish | Renewal and policy status history |
| CAN-01 | Cancellation with open claims and no completed claims review | Cannot complete/apply | Claims review state and response |
| CAN-02 | Cancellation over configured approval limit or sensitive reason | Separate authorized approver required | Rule snapshot, approver identity, decision event |
| CAN-03 | Cancellation without configured direct approval exception | Approval required by default | Rule snapshot and lifecycle state |
| APPROVE-01 | Requester or quotation approval submitter attempts self-approval, including Company Admin | Denied | Maker and checker IDs; unchanged approval state |
| APPROVE-02 | Actor lacks permission/authority or record is not pending approval | Denied | Grant set, workflow status, response |
| AUD-01 | Role, direct permission, scope grant/revoke | Immutable audit event with actor, company, target and before/after state | Audit event/hash-chain verification |
| AUD-02 | Create/edit/delete/submit/retry/approve/reject/issue/renew/endorse/cancel/refund/reconcile | Lifecycle or audit event captures actor, reason, status and correlation/regulatory reference | Event chain for transaction |
| UI-01 | Role or record state changes action eligibility | Menus/buttons/forms update from current authorization/workflow context | UI capture and matching backend response |
| UI-02 | Direct API call bypasses hidden/disabled UI action | Backend still denies unauthorized request | Network response and no side effect |
| MIG-01 | Run access report before scope activation | Every potential broadening, incomparable target, invalid target, company-wide grant, and legacy fallback reviewed | CSV, summary, reviewer/date/sign-off |
| MIG-02 | Direct/role scope management and action scope checks | Scope is enforced in code; staging must verify each transaction action and report findings before activation | Deployment checklist sign-off |

## Release decision

Do not activate per-permission scope behavior until `scripts/access-control-review.mjs` reports no unexplained broadening, incomparable target, invalid target, or unreviewed company-wide access, and backend scope enforcement is implemented. Any exception requires a named company owner, documented business reason, and expiry/review date.

No acceptance run was performed as part of creating this matrix. It must be completed against a staging tenant before release.
