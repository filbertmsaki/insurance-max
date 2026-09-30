import { useState } from 'react';
import { Lock, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { claimsApi } from '../../api';
import {
  activeClaimants,
  claimantMissingFields,
  claimantsLocked,
} from '../../claim-records';
import { ClaimantDialog } from '../../components/ClaimantDialog';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import {
  CLAIMANT_CATEGORY_OPTIONS,
  CLAIMANT_TYPE_OPTIONS,
  ID_TYPE_OPTIONS,
  PARTY_TYPE_OPTIONS,
} from '../../constants';
import { useClaimAction } from '../../hooks';
import type { ClaimantPayload, ClaimClaimant, ClaimDetail } from '../../types';
import { formatClaimMoney } from '../../utils';
import {
  claimantFromRecord,
  emptyClaimant,
  policyholderClaimant,
} from '../../wizard/schema';

const optionLabel = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: unknown,
) =>
  value == null || value === ''
    ? '-'
    : (options.find((option) => option.value === String(value))?.label ??
      String(value));

type Editing =
  | { mode: 'add'; policyholder: boolean }
  | { mode: 'edit'; claimant: ClaimClaimant };

export function ClaimantsTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const claimants = activeClaimants(claim);
  const locked = claimantsLocked(claim);
  const canEdit =
    !locked &&
    (hasPermission(ClaimsPermissions.UPDATE) ||
      hasPermission(ClaimsPermissions.INTIMATION_CREATE));
  const hasPolicyholder = claimants.some(
    (claimant) => claimant.uses_policyholder,
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<ClaimClaimant | null>(null);

  const save = useClaimAction(
    claim.id,
    (payload: ClaimantPayload) =>
      editing?.mode === 'edit'
        ? claimsApi.updateClaimant(editing.claimant.id, payload)
        : claimsApi.addClaimant(claim.id, payload),
    'Claimant saved',
  );
  const remove = useClaimAction(
    claim.id,
    (claimant: ClaimClaimant) => claimsApi.removeClaimant(claimant.id),
    'Claimant removed',
  );

  return (
    <div className="space-y-4">
      {locked ? (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            The claimants were reported to TIRA with the intimation and can no
            longer be changed.
          </AlertDescription>
        </Alert>
      ) : null}
      <ClaimErrorAlert
        error={remove.error}
        title="The claimant was not removed"
      />

      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={hasPolicyholder}
            onClick={() => setEditing({ mode: 'add', policyholder: true })}
          >
            <UserRound className="mr-1.5 h-4 w-4" />
            Add policyholder
          </Button>
          <Button
            onClick={() => setEditing({ mode: 'add', policyholder: false })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add claimant
          </Button>
        </div>
      ) : null}

      {claimants.length === 0 ? (
        <EmptyState text="No claimants recorded." />
      ) : null}

      {claimants.map((claimant) => {
        const missing = claimantMissingFields(claimant);
        return (
          <SectionCard
            key={claimant.id}
            title={claimant.full_name ?? 'Claimant'}
            description={[
              optionLabel(CLAIMANT_TYPE_OPTIONS, claimant.claimant_type),
              claimant.is_primary ? 'Primary' : null,
              claimant.uses_policyholder ? 'Policyholder record' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            action={
              <div className="flex items-center gap-1">
                {missing.length > 0 ? (
                  <Badge variant="warning">Missing {missing.join(', ')}</Badge>
                ) : (
                  <Badge variant="success">Ready for TIRA</Badge>
                )}
                {canEdit ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${claimant.full_name ?? 'claimant'}`}
                      onClick={() => setEditing({ mode: 'edit', claimant })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${claimant.full_name ?? 'claimant'}`}
                      disabled={claimants.length === 1}
                      onClick={() => setRemoving(claimant)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            }
          >
            <KeyValueGrid
              items={[
                {
                  label: 'TIRA category',
                  value: optionLabel(
                    CLAIMANT_CATEGORY_OPTIONS,
                    claimant.claimant_category,
                  ),
                },
                {
                  label: 'Type',
                  value: optionLabel(PARTY_TYPE_OPTIONS, claimant.party_type),
                },
                {
                  label: 'ID',
                  value: `${optionLabel(ID_TYPE_OPTIONS, claimant.id_type)} ${claimant.identification_number ?? ''}`,
                },
                { label: 'Phone', value: claimant.phone ?? '-' },
                { label: 'Email', value: claimant.email ?? '-' },
                {
                  label: 'Address',
                  value:
                    [
                      claimant.street,
                      claimant.district,
                      claimant.region,
                      claimant.country_code,
                    ]
                      .filter(Boolean)
                      .join(', ') || '-',
                },
                {
                  label: 'Amount claimed',
                  value: formatClaimMoney(
                    claimant.amount_claimed,
                    claim.currency_code,
                  ),
                },
              ]}
            />
          </SectionCard>
        );
      })}

      {editing ? (
        <ClaimantDialog
          title={
            editing.mode === 'edit'
              ? `Edit ${editing.claimant.full_name ?? 'claimant'}`
              : editing.policyholder
                ? 'Add the policyholder as claimant'
                : 'Add claimant'
          }
          initial={
            editing.mode === 'edit'
              ? claimantFromRecord(editing.claimant)
              : editing.policyholder
                ? policyholderClaimant(claimants.length === 0)
                : emptyClaimant({ is_primary: claimants.length === 0 })
          }
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            setEditing(null);
          }}
          onSave={(payload) =>
            save.mutate(payload, { onSuccess: () => setEditing(null) })
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove claimant"
        description={`${removing?.full_name ?? 'This claimant'} will be removed from the claim.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing, { onSettled: () => setRemoving(null) })
        }
      />
    </div>
  );
}
