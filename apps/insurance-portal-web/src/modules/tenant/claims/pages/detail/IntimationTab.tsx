import { useState } from 'react';
import { AlertTriangle, Pencil, Plus, RefreshCcw, Send } from 'lucide-react';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { claimsApi } from '../../api';
import {
  activeClaimants,
  claimantMissingFields,
  operationFor,
  userName,
} from '../../claim-records';
import { RegulatoryStatusBadge } from '../../components/ClaimBadges';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import { IntimationDialog } from '../../components/IntimationDialog';
import { ID_TYPE_OPTIONS } from '../../constants';
import { useClaimAction } from '../../hooks';
import { intimationDefaults } from '../../stage-schemas';
import type {
  ClaimDetail,
  ClaimIntimation,
  IntimationPayload,
} from '../../types';
import { formatClaimDateTime, formatClaimMoney } from '../../utils';

const INTIMATION_TONE: Record<string, 'muted' | 'info' | 'success' | 'danger'> =
  {
    DRAFT: 'muted',
    SUBMITTED: 'info',
    ACCEPTED: 'success',
    FAILED: 'danger',
  };

const idTypeLabel = (value: unknown) =>
  ID_TYPE_OPTIONS.find((option) => option.value === String(value))?.label ??
  '-';

/** Claimants still missing TIRA fields, listed before an intimation is sent. */
function ClaimantReadiness({ claim }: { claim: ClaimDetail }) {
  const incomplete = activeClaimants(claim)
    .map((claimant) => ({ claimant, missing: claimantMissingFields(claimant) }))
    .filter((item) => item.missing.length > 0);

  if (incomplete.length === 0) return null;

  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Complete the claimants before submitting</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {incomplete.map(({ claimant, missing }) => (
            <li key={claimant.id}>
              {claimant.full_name ?? 'Claimant'} is missing {missing.join(', ')}
            </li>
          ))}
        </ul>
        <p className="mt-1">Edit them on the Claimants tab.</p>
      </AlertDescription>
    </Alert>
  );
}

export function IntimationTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const actions = new Set(claim.allowed_actions ?? []);
  const intimations = claim.intimations ?? [];
  const canEdit =
    hasPermission(ClaimsPermissions.INTIMATION_CREATE) ||
    hasPermission(ClaimsPermissions.UPDATE);
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; intimation: ClaimIntimation } | null
  >(null);
  const [submitting, setSubmitting] = useState<ClaimIntimation | null>(null);

  const save = useClaimAction(
    claim.id,
    (payload: IntimationPayload) =>
      dialog?.mode === 'edit'
        ? claimsApi.updateIntimation(dialog.intimation.id, payload)
        : claimsApi.createIntimation(claim.id, payload),
    dialog?.mode === 'edit' ? 'Intimation updated' : 'Intimation prepared',
  );
  const submit = useClaimAction(
    claim.id,
    (intimation: ClaimIntimation) =>
      claimsApi.submitIntimation(intimation.id, intimation.status === 'FAILED'),
    'Intimation submitted to TIRAMIS',
  );

  const hasOpen = intimations.some((item) =>
    ['DRAFT', 'SUBMITTED', 'FAILED'].includes(item.status),
  );
  const claimantsReady = activeClaimants(claim).every(
    (claimant) => claimantMissingFields(claimant).length === 0,
  );

  return (
    <div className="space-y-4">
      {actions.has('submit_intimation') ? (
        <ClaimantReadiness claim={claim} />
      ) : null}
      <ClaimErrorAlert
        error={submit.error}
        title="The intimation was not submitted"
      />

      {intimations.length === 0 ? (
        <SectionCard
          title="Claim intimation"
          description="Reports the reserve, assessor and claimants to TIRA (§10)."
          action={
            actions.has('create_intimation') ? (
              <Button onClick={() => setDialog({ mode: 'create' })}>
                <Plus className="mr-1.5 h-4 w-4" />
                Prepare intimation
              </Button>
            ) : undefined
          }
        >
          <EmptyState
            text={
              claim.claim_reference_number
                ? 'No intimation has been prepared yet.'
                : 'An intimation can be prepared once TIRA has issued the claim reference number.'
            }
          />
        </SectionCard>
      ) : null}

      {actions.has('create_intimation') &&
      intimations.length > 0 &&
      !hasOpen ? (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus className="mr-1.5 h-4 w-4" />
            New intimation
          </Button>
        </div>
      ) : null}

      {intimations.map((intimation) => {
        const operation = operationFor(claim, 'INTIMATION', intimation.id);
        const editable = ['DRAFT', 'FAILED'].includes(intimation.status);
        const failed = intimation.status === 'FAILED';

        return (
          <SectionCard
            key={intimation.id}
            title={`Intimation ${intimation.claim_intimation_number ?? ''}`}
            description={`Prepared ${formatClaimDateTime(intimation.created_at)} by ${userName(claim, intimation.created_by)}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={INTIMATION_TONE[intimation.status] ?? 'muted'}>
                  {humanizeCode(intimation.status)}
                </Badge>
                {operation ? (
                  <RegulatoryStatusBadge status={operation.status} />
                ) : null}
              </div>
            }
          >
            <div className="space-y-4">
              {failed && operation ? (
                <Alert variant="destructive">
                  <AlertTitle>TIRA did not accept this intimation</AlertTitle>
                  <AlertDescription>
                    {[
                      operation.final_response_code,
                      operation.final_response_message,
                    ]
                      .filter(Boolean)
                      .join(' – ') ||
                      operation.acknowledgement_message ||
                      'No reason was returned.'}
                  </AlertDescription>
                </Alert>
              ) : null}
              <KeyValueGrid
                items={[
                  {
                    label: 'Intimation date',
                    value: formatClaimDateTime(
                      intimation.claim_intimation_date,
                    ),
                  },
                  {
                    label: 'Reserve',
                    value: formatClaimMoney(
                      intimation.claim_reserve_amount,
                      intimation.currency_code,
                    ),
                    meta: intimation.claim_reserve_method ?? undefined,
                  },
                  {
                    label: 'Estimated amount',
                    value: formatClaimMoney(
                      intimation.claim_estimated_amount,
                      intimation.currency_code,
                    ),
                  },
                  {
                    label: 'Assessed by',
                    value:
                      intimation.loss_assessment_option === 2
                        ? 'External loss adjuster'
                        : 'In-house',
                  },
                  { label: 'Assessor', value: intimation.assessor_name ?? '-' },
                  {
                    label: 'Assessor ID',
                    value: `${idTypeLabel(intimation.assessor_id_type)} ${intimation.assessor_id_number ?? ''}`,
                  },
                  ...(intimation.submitted_at
                    ? [
                        {
                          label: 'Submitted',
                          value: formatClaimDateTime(intimation.submitted_at),
                          meta: userName(claim, intimation.submitted_by),
                        },
                      ]
                    : []),
                ]}
              />
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button
                      variant="outline"
                      onClick={() => setDialog({ mode: 'edit', intimation })}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                  ) : null}
                  {actions.has('submit_intimation') ? (
                    <Button
                      onClick={() => setSubmitting(intimation)}
                      disabled={!claimantsReady || submit.isPending}
                      title={
                        claimantsReady
                          ? undefined
                          : 'Complete the claimant details first'
                      }
                    >
                      {failed ? (
                        <RefreshCcw className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Send className="mr-1.5 h-4 w-4" />
                      )}
                      {failed ? 'Resubmit to TIRA' : 'Submit to TIRA'}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SectionCard>
        );
      })}

      {dialog ? (
        <IntimationDialog
          title={
            dialog.mode === 'edit'
              ? `Edit intimation ${dialog.intimation.claim_intimation_number ?? ''}`
              : 'Prepare claim intimation'
          }
          initial={intimationDefaults(
            dialog.mode === 'edit' ? dialog.intimation : null,
            claim.estimated_amount,
          )}
          currency={claim.currency_code}
          isEdit={dialog.mode === 'edit'}
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            setDialog(null);
          }}
          onSave={(payload) =>
            save.mutate(payload, { onSuccess: () => setDialog(null) })
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!submitting}
        onOpenChange={(open) => !open && setSubmitting(null)}
        title="Submit claim intimation to TIRA"
        description={`Intimation ${submitting?.claim_intimation_number ?? ''} and ${activeClaimants(claim).length} claimant(s) will be sent to TIRAMIS. Claimants cannot be changed once TIRA has it.`}
        confirmLabel="Submit"
        variant="default"
        loading={submit.isPending}
        onConfirm={() =>
          submitting &&
          submit.mutate(submitting, { onSettled: () => setSubmitting(null) })
        }
      />
    </div>
  );
}
