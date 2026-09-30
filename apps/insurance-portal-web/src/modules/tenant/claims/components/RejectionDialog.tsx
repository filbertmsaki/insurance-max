import { useWatch } from 'react-hook-form';
import {
  rejectionSchema,
  TIRA_REJECTION_REASON_MAX,
  toRejectionPayload,
  type RejectionFormValues,
} from '../stage-schemas';
import type { RejectionPayload } from '../types';
import { ClaimField } from './ClaimField';
import { FormDialog } from './FormDialog';
import { useSchemaForm } from './use-schema-form';

/**
 * Recommend rejecting a claim (§14.1). The recommendation goes through the
 * authority matrix; the final approval rejects the claim and reports it.
 */
export function RejectionDialog({
  initial,
  intimated,
  currency,
  pending,
  error,
  onSave,
  onClose,
}: {
  initial: RejectionFormValues;
  /** Without an accepted intimation TIRA cannot receive the rejection. */
  intimated: boolean;
  currency?: string | null;
  pending: boolean;
  error: unknown;
  onSave: (payload: RejectionPayload) => void;
  onClose: () => void;
}) {
  const form = useSchemaForm<RejectionFormValues>(rejectionSchema, initial);
  const tiraReason =
    useWatch({ control: form.control, name: 'tira_rejection_reason' }) ?? '';

  return (
    <FormDialog
      id="rejection-form"
      title="Recommend rejection"
      description={
        intimated
          ? 'The rejection goes for approval. Once approved the claim is rejected and reported to TIRA.'
          : 'The claim was not intimated, so TIRA cannot receive a rejection (ClaimRejectionReq needs the intimation number). Once approved it is rejected internally and can be closed.'
      }
      form={form}
      submitLabel="Submit for approval"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={(values) => onSave(toRejectionPayload(values))}
    >
      <ClaimField
        form={form}
        name="rejection_reason"
        label="Reason for rejection"
        multiline
        rows={4}
        maxLength={5000}
        required
        description="The full reason kept on the claim file and used in the rejection letter."
      />
      <ClaimField
        form={form}
        name="tira_rejection_reason"
        label="Reason reported to TIRA"
        maxLength={TIRA_REJECTION_REASON_MAX}
        required
        description={`${tiraReason.length}/${TIRA_REJECTION_REASON_MAX} characters (RejectionReason).`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ClaimField
          form={form}
          name="policy_clause_reference"
          label="Policy clause"
          maxLength={200}
          placeholder="e.g. Exclusion 4(b)"
        />
        <ClaimField
          form={form}
          name="claim_amount"
          label={`Claimed amount${currency ? ` (${currency})` : ''}`}
          type="number"
          description="Defaults to the estimate; decides the approval level."
        />
        <ClaimField
          form={form}
          name="claim_resulted_litigation"
          label="Resulted in litigation"
          options={[
            { value: 'N', label: 'No' },
            { value: 'Y', label: 'Yes' },
          ]}
          required
        />
      </div>
      <ClaimField
        form={form}
        name="recommendation"
        label="Recommendation notes"
        multiline
        rows={2}
        maxLength={5000}
      />
    </FormDialog>
  );
}
