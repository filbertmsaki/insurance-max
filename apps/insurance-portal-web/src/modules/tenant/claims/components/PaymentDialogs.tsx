import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import {
  paymentSchema,
  toPaymentPayload,
  type PaymentFormValues,
} from '../stage-schemas';
import type { ClaimClaimant, PaymentPayload } from '../types';
import { formatClaimMoney } from '../utils';
import { PAYMENT_MODE_OPTIONS } from '../constants';
import { ClaimErrorAlert } from './ClaimErrorAlert';
import { ClaimField } from './ClaimField';

const PAYEE_TYPES = [
  { value: 'CLAIMANT', label: 'Claimant' },
  { value: 'GARAGE', label: 'Garage / repairer' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'ASSESSOR', label: 'Assessor' },
  { value: 'OTHER', label: 'Other' },
];

const YES_NO = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
];

/**
 * A payment instruction (§13.1). It is approved, then disbursed by finance;
 * only a confirmed payment is reported to TIRA.
 */
export function PaymentDialog({
  initial,
  payable,
  claimants,
  currency,
  pending,
  error,
  onSave,
  onClose,
}: {
  initial: PaymentFormValues;
  payable: number;
  claimants: ClaimClaimant[];
  currency?: string | null;
  pending: boolean;
  error: unknown;
  onSave: (payload: PaymentPayload) => void;
  onClose: () => void;
}) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: initial,
  });
  const values = useWatch({ control: form.control });
  const litigated = values.claim_resulted_litigation === 'Y';
  const toClaimant = values.payee_type === 'CLAIMANT';
  const byTransfer = values.payment_mode === '3';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New claim payment</DialogTitle>
          <DialogDescription>
            Up to {formatClaimMoney(payable, currency)} can still be paid on
            this claim. Partial payments are allowed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="payment-form"
            className="space-y-2"
            onSubmit={form.handleSubmit((submitted) => {
              if (Number(submitted.paid_amount) > payable) {
                form.setError('paid_amount', {
                  message: `Only ${formatClaimMoney(payable, currency)} is still payable`,
                });
                return;
              }
              onSave(toPaymentPayload(submitted));
            })}
          >
            <StepSection title="Payment" first>
              <div className="grid gap-4 md:grid-cols-3">
                <ClaimField
                  form={form}
                  name="paid_amount"
                  label={`Amount${currency ? ` (${currency})` : ''}`}
                  type="number"
                  required
                />
                <ClaimField
                  form={form}
                  name="payment_mode"
                  label="Payment mode"
                  options={PAYMENT_MODE_OPTIONS}
                  required
                />
                <ClaimField
                  form={form}
                  name="payment_reference"
                  label="Internal reference"
                  maxLength={120}
                />
              </div>
            </StepSection>

            <StepSection title="Payee">
              <div className="grid gap-4 md:grid-cols-3">
                <ClaimField
                  form={form}
                  name="payee_type"
                  label="Paid to"
                  options={PAYEE_TYPES}
                  required
                />
                <ClaimField
                  form={form}
                  name="claimant_id"
                  label="For claimant"
                  options={claimants.map((claimant) => ({
                    value: claimant.id,
                    label: claimant.full_name ?? 'Claimant',
                  }))}
                  description="The claimant reported to TIRA with this payment."
                />
                {!toClaimant ? (
                  <ClaimField
                    form={form}
                    name="payee_name"
                    label="Payee name"
                    required
                    maxLength={180}
                  />
                ) : null}
              </div>
              {byTransfer ? (
                <div className="grid gap-4 pt-2 md:grid-cols-3">
                  <ClaimField
                    form={form}
                    name="bank_name"
                    label="Bank"
                    maxLength={120}
                  />
                  <ClaimField
                    form={form}
                    name="account_name"
                    label="Account name"
                    maxLength={180}
                  />
                  <ClaimField
                    form={form}
                    name="account_number"
                    label="Account number"
                    maxLength={60}
                    description="Shown masked after saving."
                  />
                </div>
              ) : null}
            </StepSection>

            <StepSection title="Reported to TIRA">
              <div className="grid gap-4 md:grid-cols-3">
                <ClaimField
                  form={form}
                  name="parties_notified"
                  label="Parties notified"
                  options={YES_NO}
                  required
                />
                <ClaimField
                  form={form}
                  name="claim_resulted_litigation"
                  label="Claim resulted in litigation"
                  options={YES_NO}
                  required
                />
              </div>
              {litigated ? (
                <ClaimField
                  form={form}
                  name="litigation_reason"
                  label="Litigation reason"
                  multiline
                  rows={2}
                  required
                  maxLength={1000}
                />
              ) : null}
            </StepSection>
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={pending}>
            {pending ? 'Saving...' : 'Save draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Finance confirms the money actually left; this posts the journal. */
export function ConfirmDisbursementDialog({
  title,
  defaultMethod,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  defaultMethod: string;
  pending: boolean;
  error: unknown;
  onConfirm: (data: {
    payment_method: string;
    provider_reference?: string;
  }) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState(defaultMethod);
  const [reference, setReference] = useState('');
  const missing = !method.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Confirming posts the claim disbursement to the finance journal and
            reports the payment to TIRA.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disbursement-method" required>
              Payment method
            </Label>
            <Input
              id="disbursement-method"
              maxLength={40}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disbursement-reference">
              Bank / provider reference
            </Label>
            <Input
              id="disbursement-reference"
              maxLength={180}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
        </div>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || missing}
            onClick={() =>
              onConfirm({
                payment_method: method.trim(),
                provider_reference: reference.trim() || undefined,
              })
            }
          >
            {pending ? 'Confirming...' : 'Confirm paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
