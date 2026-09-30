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
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import {
  ASSESSMENT_DEDUCTIONS,
  assessmentSchema,
  netOfDeductions,
  toAssessmentPayload,
  type AssessmentFormValues,
} from '../stage-schemas';
import type { AssessmentPayload } from '../types';
import { formatClaimMoney } from '../utils';
import { ClaimErrorAlert } from './ClaimErrorAlert';
import { ClaimField } from './ClaimField';

/**
 * Record or edit a draft assessment (§11.1). TIRA receives the assessed
 * loss and the recommended claim amount; the breakdown stays internal.
 */
export function AssessmentDialog({
  title,
  initial,
  currency,
  isReassessment,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string;
  initial: AssessmentFormValues;
  currency?: string | null;
  isReassessment: boolean;
  pending: boolean;
  error: unknown;
  onSave: (payload: AssessmentPayload) => void;
  onClose: () => void;
}) {
  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: initial,
  });
  const values = useWatch({ control: form.control });
  const net = netOfDeductions(values);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isReassessment
              ? 'This reassessment supersedes the approved assessment once approved, and is reported to TIRA with IsReAssessment = Y.'
              : 'Saved as a draft. Submit it for approval when complete.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="assessment-form"
            className="space-y-2"
            onSubmit={form.handleSubmit((submitted) =>
              onSave(toAssessmentPayload(submitted)),
            )}
          >
            <StepSection title="Assessment report" first>
              <div className="grid gap-4 md:grid-cols-3">
                <ClaimField
                  form={form}
                  name="assessment_received_date"
                  label="Report received"
                  type="datetime-local"
                  required
                />
                <ClaimField
                  form={form}
                  name="assessor_name"
                  label="Assessor"
                  maxLength={180}
                />
                <ClaimField
                  form={form}
                  name="assessor_company"
                  label="Assessor firm"
                  maxLength={180}
                />
                <ClaimField
                  form={form}
                  name="inspection_date"
                  label="Inspection date"
                  type="date"
                />
              </div>
              <ClaimField
                form={form}
                name="assessment_report_summary"
                label="Report summary (sent to TIRA)"
                multiline
                rows={3}
                required
                maxLength={1000}
              />
            </StepSection>

            <StepSection
              title="Amounts"
              description={currency ? `All amounts in ${currency}.` : undefined}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <ClaimField
                  form={form}
                  name="assessment_amount"
                  label="Assessed loss"
                  type="number"
                  required
                />
                {ASSESSMENT_DEDUCTIONS.map((item) => (
                  <ClaimField
                    key={item.key}
                    form={form}
                    name={item.key}
                    label={item.label}
                    type="number"
                  />
                ))}
                <ClaimField
                  form={form}
                  name="approved_claim_amount"
                  label="Recommended claim amount"
                  type="number"
                  required
                  description="Reported to TIRA as ApprovedClaimAmount once approved."
                />
              </div>
              {net !== null ? (
                <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-slate-600">
                  <span>
                    Assessed loss less deductions:{' '}
                    <strong>{formatClaimMoney(net, currency)}</strong>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      form.setValue('approved_claim_amount', net.toFixed(2), {
                        shouldValidate: true,
                      })
                    }
                  >
                    Use as recommended amount
                  </Button>
                </div>
              ) : null}
            </StepSection>

            <StepSection title="Remarks">
              <ClaimField
                form={form}
                name="remarks"
                label="Internal remarks"
                multiline
                rows={2}
                maxLength={5000}
              />
            </StepSection>
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="assessment-form" disabled={pending}>
            {pending ? 'Saving...' : 'Save draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
