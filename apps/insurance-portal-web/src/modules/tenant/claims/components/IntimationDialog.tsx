import { useForm } from 'react-hook-form';
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
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { ID_TYPE_OPTIONS } from '../constants';
import {
  intimationSchema,
  toIntimationPayload,
  type IntimationFormValues,
} from '../stage-schemas';
import type { IntimationPayload } from '../types';
import { ClaimErrorAlert } from './ClaimErrorAlert';
import { ClaimField } from './ClaimField';

const ASSESSMENT_OPTIONS = [
  { value: '1', label: 'In-house (insurer employee)' },
  { value: '2', label: 'External (registered loss adjuster)' },
];

/**
 * Prepare or edit a claim intimation (§10.1): initial reserve, how it was
 * estimated, and who assesses the loss. Saving a new intimation also books
 * the initial reserve, which then needs approval.
 */
export function IntimationDialog({
  title,
  initial,
  currency,
  isEdit,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string;
  initial: IntimationFormValues;
  currency?: string | null;
  isEdit: boolean;
  pending: boolean;
  error: unknown;
  onSave: (payload: IntimationPayload) => void;
  onClose: () => void;
}) {
  const form = useForm<IntimationFormValues>({
    resolver: zodResolver(intimationSchema),
    defaultValues: initial,
  });
  const foreignCurrency = !!currency && currency !== 'TZS';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Reported to TIRA as ClaimIntimationReq with the claimants on the
            claim at the time of submission.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="intimation-form"
            className="space-y-2"
            onSubmit={form.handleSubmit((values) =>
              onSave(toIntimationPayload(values)),
            )}
          >
            <StepSection title="Reserve" first>
              <div className="grid gap-4 md:grid-cols-2">
                <ClaimField
                  form={form}
                  name="claim_reserve_amount"
                  label={`Reserve amount${currency ? ` (${currency})` : ''}`}
                  type="number"
                  required
                  description={
                    isEdit
                      ? 'A change is booked as a reserve increase or decrease for approval.'
                      : 'Booked as the initial reserve, subject to approval.'
                  }
                />
                <ClaimField
                  form={form}
                  name="claim_reserve_method"
                  label="Reserve method"
                  placeholder="e.g. Case estimate, Average cost"
                  required
                  maxLength={100}
                />
                <ClaimField
                  form={form}
                  name="claim_estimated_amount"
                  label="Estimated claim amount"
                  type="number"
                />
                <ClaimField
                  form={form}
                  name="claim_intimation_date"
                  label="Intimation date"
                  type="datetime-local"
                  required
                />
                {foreignCurrency ? (
                  <ClaimField
                    form={form}
                    name="exchange_rate"
                    label={`Exchange rate (${currency} to TZS)`}
                    type="number"
                  />
                ) : null}
              </div>
            </StepSection>
            <StepSection
              title="Loss assessment"
              description="TIRA requires the assessor’s identity for both options."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <ClaimField
                  form={form}
                  name="loss_assessment_option"
                  label="Assessed by"
                  options={ASSESSMENT_OPTIONS}
                  required
                />
                <ClaimField
                  form={form}
                  name="assessor_name"
                  label="Assessor name"
                  required
                  maxLength={100}
                />
                <ClaimField
                  form={form}
                  name="assessor_id_type"
                  label="Assessor ID type"
                  options={ID_TYPE_OPTIONS}
                  required
                />
                <ClaimField
                  form={form}
                  name="assessor_id_number"
                  label="Assessor ID number"
                  required
                  maxLength={50}
                />
              </div>
            </StepSection>
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="intimation-form" disabled={pending}>
            {pending
              ? 'Saving...'
              : isEdit
                ? 'Save changes'
                : 'Prepare intimation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
