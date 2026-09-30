import { Link } from 'react-router-dom';
import { AlertTriangle, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyValueGrid } from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import { ClaimField } from '../../components/ClaimField';
import { CLAIMANT_TYPE_OPTIONS, ID_TYPE_OPTIONS } from '../../constants';
import { claimsPaths } from '../../paths';
import {
  formatClaimDate,
  formatClaimDateTime,
  formatClaimMoney,
} from '../../utils';
import { incidentFieldsFor, type ClaimFormValues } from '../schema';
import { riskTitle } from '../helpers';
import type { ClaimWizard } from '../useClaimWizard';

const label = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string,
) => options.find((option) => option.value === value)?.label ?? value ?? '-';

export function ReviewStep({ wizard }: { wizard: ClaimWizard }) {
  const { form, policy, duplicate, saveError } = wizard;
  const values = form.watch();
  const risk = policy.data?.risks.find(
    (item) => item.id === values.policy_risk_id,
  );
  const currency = policy.data?.currency;
  const incidentLabels = incidentFieldsFor(policy.data?.business_line);
  const incidentItems = incidentLabels
    .filter((field) => values.incident_details[field.key]?.trim())
    .map((field) => ({
      label: field.label,
      value: values.incident_details[field.key],
    }));

  return (
    <div className="space-y-6">
      {duplicate ? (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>This may be a duplicate claim</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              It matches{' '}
              {duplicate.id ? (
                <Link
                  className="font-medium underline"
                  to={claimsPaths.detail(duplicate.id)}
                  target="_blank"
                >
                  {duplicate.claim_no}
                </Link>
              ) : (
                duplicate.claim_no
              )}{' '}
              (same policy, risk, loss date, loss type and claimants). If this
              is a separate loss, give the reason and save again.
            </p>
            <ClaimField<ClaimFormValues>
              form={form}
              name="duplicate_override_reason"
              label="Why this is a separate claim"
              multiline
              rows={2}
              required
              maxLength={2000}
            />
          </AlertDescription>
        </Alert>
      ) : saveError ? (
        <ClaimErrorAlert
          error={saveError}
          title="The claim could not be saved"
        />
      ) : null}

      <StepSection title="Policy and risk" first>
        <KeyValueGrid
          items={[
            { label: 'Policy', value: policy.data?.policy_no ?? '-' },
            {
              label: 'Policyholder',
              value: policy.data?.customer?.name ?? '-',
            },
            {
              label: 'Period of cover',
              value: `${formatClaimDate(policy.data?.start_date)} – ${formatClaimDate(policy.data?.end_date)}`,
            },
            { label: 'Risk', value: risk ? riskTitle(risk) : 'Whole policy' },
            {
              label: 'TIRA cover note',
              value:
                risk?.cover_note_reference_number ??
                policy.data?.cover_note_no ??
                '-',
            },
          ]}
        />
      </StepSection>

      <StepSection title="Incident">
        <KeyValueGrid
          items={[
            {
              label: 'Loss date',
              value: formatClaimDateTime(values.loss_date),
            },
            {
              label: 'Reported',
              value: formatClaimDateTime(values.claim_report_date),
            },
            { label: 'Location', value: values.loss_location || '-' },
            { label: 'Nature of loss', value: values.loss_nature || '-' },
            { label: 'Type of loss', value: values.loss_type || '-' },
            {
              label: 'Estimated amount',
              value: values.estimated_amount
                ? formatClaimMoney(values.estimated_amount, currency)
                : '-',
            },
            {
              label: 'Claim form received',
              value: values.claim_form_dully_filled ? 'Yes' : 'No',
            },
            { label: 'Priority', value: humanizeCode(values.priority) },
            ...incidentItems,
          ]}
        />
        <p className="whitespace-pre-line pt-2 text-sm text-slate-700">
          {values.description}
        </p>
      </StepSection>

      <StepSection title={`Claimants (${values.claimants.length})`}>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {values.claimants.map((claimant, index) => (
            <div
              key={claimant.id ?? index}
              className="flex flex-wrap justify-between gap-2 p-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {claimant.uses_policyholder
                    ? (policy.data?.customer?.name ?? 'Policyholder')
                    : claimant.full_name}
                  {claimant.is_primary ? ' · primary' : ''}
                </p>
                <p className="text-slate-500">
                  {label(CLAIMANT_TYPE_OPTIONS, claimant.claimant_type)}
                  {!claimant.uses_policyholder && claimant.id_type
                    ? ` · ${label(ID_TYPE_OPTIONS, claimant.id_type)} ${claimant.identification_number ?? ''}`
                    : ''}
                </p>
              </div>
              {claimant.amount_claimed ? (
                <span className="tabular-nums text-slate-700">
                  {formatClaimMoney(claimant.amount_claimed, currency)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </StepSection>

      <Alert>
        <Send className="h-4 w-4" />
        <AlertDescription>
          Submitting sends a ClaimNotificationRefReq to TIRAMIS. The claim stays
          “Notification submitted” until TIRA responds with the claim reference
          number, which is then locked on the claim.
        </AlertDescription>
      </Alert>
    </div>
  );
}
