# FIN-01 deferred dependencies and production acceptance

| Dependency | Owner | Required evidence or action |
| --- | --- | --- |
| Actual product and book mappings | Product owner, Finance and engineering | Use the source-pinned inactive product mapping contract to review every current product/version and risk, disabled rule references and exclusions for each book; implement and certify the missing operational posting adapters, account-role and branch/currency treatments. |
| 2027 demo cutover | Finance engineering and QA | Supply isolated licence, product, calendar and authority fixtures covering the cutover; reconcile source and open items in the integrated scope. Synthetic validation openings have been independently reviewed for each book but are not live cutover certificates. |
| Integrated posting controls | Finance engineering and QA | Exercise source ownership, duplicate recognition and reversal across three books within one database. |
| Authenticated UI | QA and application access owner | Verify each book's setup and readiness on desktop and mobile using authorized test identities. |
| Actual licence and registration | Company administrator and compliance | Provide current company-owned legal evidence and independently review exact versions. |
| Real mandates and policies | Company administrator and Finance | Appoint independent people and approve applicable policy versions with exact scoped evidence. |
| Actual opening and release | Finance controller and release authority | Certify reconciled opening and open items for an approved prospective cutover; independently approve and deploy the scoped release. |
| Independent service B40–B42 | Architecture and Finance | Remove shared transaction dependencies and demonstrate migration, recovery, reconciliation and cutover before extraction. |

No synthetic evidence, approval or opening authorizes live company posting.
