import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KeyValueGrid } from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { usePolicyLookup } from '../../hooks';
import type { PolicyLookupDetail, PolicyLookupResult } from '../../types';
import { formatClaimDate, formatClaimMoney } from '../../utils';
import { policyholderClaimant } from '../schema';
import type { ClaimWizard } from '../useClaimWizard';

function useDebounced(value: string, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function PolicySummary({ policy }: { policy: PolicyLookupDetail }) {
  return (
    <div className="space-y-3">
      <KeyValueGrid
        items={[
          { label: 'Policy', value: policy.policy_no ?? '-' },
          {
            label: 'Cover note',
            value:
              policy.cover_note_no ?? policy.policy_reference_number ?? '-',
          },
          { label: 'Policyholder', value: policy.customer?.name ?? '-' },
          {
            label: 'Period of cover',
            value: `${formatClaimDate(policy.start_date)} – ${formatClaimDate(policy.end_date)}`,
          },
          {
            label: 'Line',
            value: policy.business_line
              ? humanizeCode(policy.business_line)
              : '-',
          },
          {
            label: 'Sum insured',
            value: formatClaimMoney(policy.sum_insured, policy.currency),
          },
        ]}
      />
      {policy.open_claims > 0 ? (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This policy already has {policy.open_claims} open claim
            {policy.open_claims === 1 ? '' : 's'}. Check it is not the same loss
            before continuing.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function PolicyStep({ wizard }: { wizard: ClaimWizard }) {
  const { form, policy } = wizard;
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const lookup = usePolicyLookup(debounced);
  // Users limited to their own records only find policies they issued.
  const ownRecordsOnly = useAuthStore(
    (state) => !!state.authorizationContext?.dataScope?.ownRecordsOnly,
  );
  const selectedId = form.watch('policy_id');
  const policyError = form.formState.errors.policy_id?.message;

  // A new policy starts with its policyholder as the primary claimant and,
  // when it has a single risk, that risk selected.
  useEffect(() => {
    if (!policy.data || policy.data.id !== selectedId) return;

    if (form.getValues('claimants').length === 0) {
      form.setValue('claimants', [policyholderClaimant(true)]);
    }
    if (policy.data.risks.length === 1 && !form.getValues('policy_risk_id')) {
      form.setValue('policy_risk_id', policy.data.risks[0].id);
    }
  }, [form, policy.data, selectedId]);

  function select(result: PolicyLookupResult) {
    if (result.id === selectedId) return;
    form.setValue('policy_id', result.id, { shouldValidate: true });
    form.setValue('policy_risk_id', '');
    form.setValue('claimants', []);
  }

  return (
    <div className="space-y-6">
      <StepSection
        title="Find the policy"
        description="Search by policy number, cover note or TIRA reference, customer name or number, or vehicle registration or chassis number."
        first
      >
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            aria-label="Search policies"
            className="pl-9"
            placeholder="e.g. POL-2026-00012, T123ABC, Asha Juma"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        {policyError ? (
          <p className="text-sm font-medium text-red-600">{policyError}</p>
        ) : null}

        {debounced.trim().length >= 2 ? (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {lookup.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : lookup.isError ? (
              <p className="p-4 text-sm text-red-600">
                The policy search failed. Try again.
              </p>
            ) : (lookup.data ?? []).length === 0 ? (
              <div className="space-y-1 p-4 text-sm text-slate-500">
                <p>No policy you can access matches “{debounced.trim()}”.</p>
                {ownRecordsOnly ? (
                  <p>
                    Your access is limited to records you created, so policies
                    issued by others are not listed. A company administrator can
                    give you branch or company data access.
                  </p>
                ) : null}
              </div>
            ) : (
              lookup.data!.map((result) => {
                const selected = result.id === selectedId;
                return (
                  <div
                    key={result.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {result.policy_no ?? result.cover_note_no}
                        </span>
                        {result.business_line ? (
                          <Badge variant="secondary">
                            {humanizeCode(result.business_line)}
                          </Badge>
                        ) : null}
                        {result.policy_status ? (
                          <Badge variant="outline">
                            {humanizeCode(result.policy_status)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">
                        {result.customer_name ?? '-'} ·{' '}
                        {formatClaimDate(result.start_date)} –{' '}
                        {formatClaimDate(result.end_date)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      onClick={() => select(result)}
                    >
                      {selected ? (
                        <>
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          Selected
                        </>
                      ) : (
                        'Select'
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </StepSection>

      {selectedId ? (
        <StepSection
          title="Selected policy"
          description="Policy details are read-only here."
        >
          {policy.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : policy.data ? (
            <PolicySummary policy={policy.data} />
          ) : (
            <p className="text-sm text-red-600">
              The selected policy could not be loaded.
            </p>
          )}
        </StepSection>
      ) : null}
    </div>
  );
}
