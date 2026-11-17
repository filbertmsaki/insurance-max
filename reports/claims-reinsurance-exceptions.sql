-- Read-only review of legacy generic reinsurance recoveries. Run only on an
-- authorized, read-only database or an isolated copy. A shared claim is a
-- candidate for review, not proof that two records represent the same loss.
WITH ceded AS (
  SELECT company_id, claim_id, COUNT(*) AS ceded_record_count,
         SUM(expected_recovery) AS ceded_expected,
         SUM(admitted_recovery) AS ceded_admitted,
         SUM(received_recovery) AS ceded_received
  FROM reinsurance_claim_recoveries
  WHERE deleted_at IS NULL AND status <> 'CANCELLED'
  GROUP BY company_id, claim_id
)
SELECT generic.company_id, generic.claim_id, generic.id AS legacy_recovery_id,
       generic.recovery_no, generic.status AS legacy_status,
       generic.expected_amount AS legacy_expected,
       generic.received_amount AS legacy_received,
       COALESCE(ceded.ceded_record_count, 0) AS ceded_record_count,
       ceded.ceded_expected, ceded.ceded_admitted, ceded.ceded_received,
       CASE WHEN ceded.ceded_record_count IS NULL THEN 'LEGACY_WITHOUT_CEDED_RECORD'
            WHEN ceded.ceded_record_count = 1 THEN 'POSSIBLE_OVERLAP'
            ELSE 'AMBIGUOUS_MULTIPLE_CEDED_RECORDS' END AS review_reason
FROM claim_recoveries generic
LEFT JOIN ceded ON ceded.company_id = generic.company_id AND ceded.claim_id = generic.claim_id
WHERE generic.recovery_type = 'REINSURANCE' AND generic.status <> 'CANCELLED'
ORDER BY generic.company_id, generic.claim_id, generic.id;
