import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { ClaimField } from '../../components/ClaimField';
import { NOTIFICATION_SOURCE_OPTIONS, PRIORITY_OPTIONS } from '../../constants';
import { formatClaimDate } from '../../utils';
import { outsideCover } from '../helpers';
import { incidentFieldsFor, type ClaimFormValues } from '../schema';
import type { ClaimWizard } from '../useClaimWizard';

export function IncidentStep({ wizard }: { wizard: ClaimWizard }) {
  const { form, policy } = wizard;
  const lossDate = form.watch('loss_date');
  const details = form.watch('incident_details');
  const formFilled = form.watch('claim_form_dully_filled');
  const incidentFields = incidentFieldsFor(policy.data?.business_line);
  const isOutside = outsideCover(
    lossDate,
    policy.data?.start_date,
    policy.data?.end_date,
  );

  return (
    <div className="space-y-6">
      <StepSection
        title="Loss"
        description="These details are reported to TIRA in the claim notification (§9)."
        first
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ClaimField<ClaimFormValues>
            form={form}
            name="loss_date"
            label="Date and time of loss"
            type="datetime-local"
            required
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="claim_report_date"
            label="Date and time reported"
            type="datetime-local"
            required
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="loss_location"
            label="Location of loss"
            required
            maxLength={100}
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="loss_nature"
            label="Nature of loss"
            placeholder="e.g. Collision, Fire, Theft"
            required
            maxLength={100}
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="loss_type"
            label="Type of loss"
            placeholder="e.g. Own damage, Bodily injury"
            required
            maxLength={100}
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="estimated_amount"
            label="Estimated loss amount"
            type="number"
          />
        </div>

        {isOutside ? (
          <Alert variant="warning" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The loss date is outside the period of cover (
              {formatClaimDate(policy.data?.start_date)} –{' '}
              {formatClaimDate(policy.data?.end_date)}). Only users allowed to
              override cover validation can register this claim.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            id="claim_form_dully_filled"
            checked={formFilled}
            onCheckedChange={(checked) =>
              form.setValue('claim_form_dully_filled', checked === true)
            }
          />
          <Label htmlFor="claim_form_dully_filled" className="font-normal">
            A duly filled claim form has been received
          </Label>
        </div>
      </StepSection>

      <StepSection title="What happened">
        <div className="grid gap-4 md:grid-cols-2">
          <ClaimField<ClaimFormValues>
            form={form}
            name="claim_title"
            label="Short title"
            maxLength={200}
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="police_report_number"
            label="Police report number"
            maxLength={100}
          />
        </div>
        <ClaimField<ClaimFormValues>
          form={form}
          name="description"
          label="Description"
          multiline
          rows={4}
          required
          maxLength={5000}
        />
        <ClaimField<ClaimFormValues>
          form={form}
          name="cause_of_loss"
          label="Cause of loss"
          multiline
          rows={2}
          maxLength={2000}
        />
      </StepSection>

      <StepSection
        title={
          policy.data?.business_line === 'NON_MOTOR'
            ? 'Property details'
            : 'Vehicle incident details'
        }
        description="Kept on the claim file only; not sent to TIRA."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {incidentFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`incident-${field.key}`}>{field.label}</Label>
              {field.multiline ? (
                <Textarea
                  id={`incident-${field.key}`}
                  rows={2}
                  value={details[field.key] ?? ''}
                  onChange={(event) =>
                    form.setValue(
                      `incident_details.${field.key}`,
                      event.target.value,
                    )
                  }
                />
              ) : (
                <Input
                  id={`incident-${field.key}`}
                  value={details[field.key] ?? ''}
                  onChange={(event) =>
                    form.setValue(
                      `incident_details.${field.key}`,
                      event.target.value,
                    )
                  }
                />
              )}
            </div>
          ))}
        </div>
      </StepSection>

      <StepSection title="Reporting">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ClaimField<ClaimFormValues>
            form={form}
            name="notification_source"
            label="Reported via"
            options={NOTIFICATION_SOURCE_OPTIONS}
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="reporter_name"
            label="Reported by"
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="reporter_phone"
            label="Reporter phone"
            type="tel"
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="reporter_email"
            label="Reporter email"
            type="email"
          />
          <ClaimField<ClaimFormValues>
            form={form}
            name="priority"
            label="Priority"
            options={PRIORITY_OPTIONS}
            required
          />
        </div>
        <ClaimField<ClaimFormValues>
          form={form}
          name="internal_notes"
          label="Internal notes"
          multiline
          rows={2}
        />
      </StepSection>
    </div>
  );
}
