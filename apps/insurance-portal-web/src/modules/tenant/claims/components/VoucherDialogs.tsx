import { useWatch } from 'react-hook-form';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import {
  ALL_CLAIMANTS,
  toVoucherAdjustPayload,
  toVoucherPayload,
  toVoucherResponsePayload,
  voucherAdjustSchema,
  voucherResponseSchema,
  voucherSchema,
  type VoucherAdjustFormValues,
  type VoucherFormValues,
  type VoucherResponseFormValues,
} from '../stage-schemas';
import type {
  ClaimClaimant,
  VoucherAdjustPayload,
  VoucherPayload,
  VoucherResponsePayload,
} from '../types';
import { formatClaimMoney, toDateTimeLocal } from '../utils';
import { ClaimField } from './ClaimField';
import { FormDialog } from './FormDialog';
import { useSchemaForm } from './use-schema-form';

/** Prepare or edit a draft voucher offering the claimant a settlement. */
export function VoucherDialog({
  title,
  initial,
  claimants,
  outstanding,
  currency,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string;
  initial: VoucherFormValues;
  claimants: ClaimClaimant[];
  outstanding: number;
  currency?: string | null;
  pending: boolean;
  error: unknown;
  onSave: (payload: VoucherPayload) => void;
  onClose: () => void;
}) {
  const form = useSchemaForm<VoucherFormValues>(voucherSchema, initial);

  return (
    <FormDialog
      id="voucher-form"
      title={title}
      description={`The offer cannot exceed the outstanding approved amount of ${formatClaimMoney(outstanding, currency)}. It goes for approval before it is issued.`}
      form={form}
      submitLabel="Save draft"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={(values) => {
        if (Number(values.claim_offer_amount) > outstanding) {
          form.setError('claim_offer_amount', {
            message: `The offer exceeds the outstanding approved amount (${formatClaimMoney(outstanding, currency)})`,
          });
          return;
        }
        onSave(toVoucherPayload(values));
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ClaimField
          form={form}
          name="claim_offer_amount"
          label={`Offer amount${currency ? ` (${currency})` : ''}`}
          type="number"
          required
        />
        <ClaimField
          form={form}
          name="claim_offer_communication_date"
          label="Offer communicated"
          type="datetime-local"
          required
        />
        <div className="md:col-span-2">
          <ClaimField
            form={form}
            name="claimant_id"
            label="Offer to"
            options={[
              { value: ALL_CLAIMANTS, label: 'All claimants' },
              ...claimants.map((claimant) => ({
                value: claimant.id,
                label: claimant.full_name ?? 'Claimant',
              })),
            ]}
            description="TIRA receives the identity of the claimants the voucher is addressed to."
          />
        </div>
      </div>
    </FormDialog>
  );
}

/** Record whether the claimant accepted the offer; this reports it to TIRA. */
export function VoucherResponseDialog({
  offer,
  currency,
  pending,
  error,
  onSave,
  onClose,
}: {
  offer: unknown;
  currency?: string | null;
  pending: boolean;
  error: unknown;
  onSave: (payload: VoucherResponsePayload) => void;
  onClose: () => void;
}) {
  const form = useSchemaForm<VoucherResponseFormValues>(voucherResponseSchema, {
    response: 'ACCEPT',
    claimant_response_date: toDateTimeLocal(new Date().toISOString()),
    reason: '',
  });
  const response = useWatch({ control: form.control, name: 'response' });

  return (
    <FormDialog
      id="voucher-response-form"
      title="Record the claimant's response"
      description={`Offer of ${formatClaimMoney(offer as never, currency)}. Saving reports the voucher to TIRA with OfferAccepted, including any adjustment or reconciliation recorded so far.`}
      form={form}
      submitLabel="Record response"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={(values) => onSave(toVoucherResponsePayload(values))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ClaimField
          form={form}
          name="response"
          label="Response"
          options={[
            { value: 'ACCEPT', label: 'Accepted the offer' },
            { value: 'REJECT', label: 'Rejected the offer' },
          ]}
          required
        />
        <ClaimField
          form={form}
          name="claimant_response_date"
          label="Response date"
          type="datetime-local"
          required
        />
      </div>
      <ClaimField
        form={form}
        name="reason"
        label={response === 'REJECT' ? 'Why the claimant rejected it' : 'Notes'}
        multiline
        rows={2}
        maxLength={2000}
      />
    </FormDialog>
  );
}

/**
 * Adjustment and reconciliation of an issued voucher (§12.1). A reconciled
 * amount becomes the amount payable against the voucher.
 */
export function VoucherAdjustDialog({
  initial,
  outstanding,
  currency,
  pending,
  error,
  onSave,
  onClose,
}: {
  initial: VoucherAdjustFormValues;
  outstanding: number;
  currency?: string | null;
  pending: boolean;
  error: unknown;
  onSave: (payload: VoucherAdjustPayload) => void;
  onClose: () => void;
}) {
  const form = useSchemaForm<VoucherAdjustFormValues>(
    voucherAdjustSchema,
    initial,
  );

  return (
    <FormDialog
      id="voucher-adjust-form"
      title="Adjust or reconcile the offer"
      description="Record each one in full: TIRA needs the date, reason or summary, and amount."
      form={form}
      submitLabel="Save"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={(values) => {
        if (
          values.reconciled_amount &&
          Number(values.reconciled_amount) > outstanding
        ) {
          form.setError('reconciled_amount', {
            message: `Exceeds the outstanding approved amount (${formatClaimMoney(outstanding, currency)})`,
          });
          return;
        }
        onSave(toVoucherAdjustPayload(values));
      }}
    >
      <StepSection title="Adjustment" first>
        <div className="grid gap-4 md:grid-cols-2">
          <ClaimField
            form={form}
            name="adjustment_date"
            label="Adjustment date"
            type="datetime-local"
          />
          <ClaimField
            form={form}
            name="adjustment_amount"
            label="Adjustment amount"
            type="number"
          />
        </div>
        <ClaimField
          form={form}
          name="adjustment_reason"
          label="Adjustment reason"
          multiline
          rows={2}
          maxLength={1000}
        />
      </StepSection>
      <StepSection title="Reconciliation">
        <div className="grid gap-4 md:grid-cols-2">
          <ClaimField
            form={form}
            name="reconciliation_date"
            label="Reconciliation date"
            type="datetime-local"
          />
          <ClaimField
            form={form}
            name="reconciled_amount"
            label="Reconciled amount"
            type="number"
            description="Becomes the amount payable against this voucher."
          />
        </div>
        <ClaimField
          form={form}
          name="reconciliation_summary"
          label="Reconciliation summary"
          multiline
          rows={2}
          maxLength={1000}
        />
      </StepSection>
    </FormDialog>
  );
}
