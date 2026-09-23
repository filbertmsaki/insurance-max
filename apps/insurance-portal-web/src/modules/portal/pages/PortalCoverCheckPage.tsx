import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  CarFront,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error';

import { portalApi, type CustomerCoverCheckResult } from '../api';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

export function PortalCoverCheckPage() {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [result, setResult] = useState<CustomerCoverCheckResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: () =>
      portalApi.checkVehicleCover({
        registration_number: registrationNumber.trim() || undefined,
        chassis_number: chassisNumber.trim() || undefined,
      }),
    onMutate: () => setResult(null),
    onSuccess: setResult,
  });

  const searchedFor = registrationNumber.trim() || chassisNumber.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    checkMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check Vehicle Cover"
        description="Search by registration number or chassis number. We check policies on this platform and the TIRA national register."
      />

      <Card>
        <CardHeader className="border-b border-slate-200/70 py-4">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500" />
            Vehicle Search
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="registration-number">Registration number</Label>
              <Input
                id="registration-number"
                value={registrationNumber}
                onChange={(event) =>
                  setRegistrationNumber(event.target.value.toUpperCase())
                }
                placeholder="T123ABC"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chassis-number">Chassis number</Label>
              <Input
                id="chassis-number"
                value={chassisNumber}
                onChange={(event) =>
                  setChassisNumber(event.target.value.toUpperCase())
                }
                placeholder="Chassis number"
                autoComplete="off"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full md:w-auto"
                disabled={
                  checkMutation.isPending ||
                  (!registrationNumber.trim() && !chassisNumber.trim())
                }
              >
                <Search className="h-4 w-4" />
                {checkMutation.isPending ? 'Checking…' : 'Check'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {checkMutation.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(checkMutation.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Card>
          <CardHeader className="border-b border-slate-200/70 py-4">
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {!result.active ? (
              <div className="flex flex-col gap-4 rounded-md border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                    <ShieldX className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800">
                      No active cover found
                      {searchedFor ? ` for ${searchedFor}` : ''}
                    </div>
                    <div className="mt-0.5 text-[13px] text-slate-600">
                      Neither this platform nor TIRA has an active cover for
                      this vehicle. You can buy cover for it now.
                    </div>
                  </div>
                </div>
                <Button asChild variant="success" className="shrink-0">
                  <Link to="/customer/buy-cover">Buy cover</Link>
                </Button>
              </div>
            ) : (
              result.matches.map((match, index) => (
                <div
                  key={`${match.vehicle.registration_no ?? match.vehicle.chassis_no ?? 'vehicle'}-${match.expiry_date}-${index}`}
                  className="rounded-md border border-green-200 bg-green-50/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <CarFront className="h-4 w-4 text-slate-500" />
                          {match.vehicle.registration_no ??
                            match.vehicle.chassis_no ??
                            'Vehicle'}
                        </div>
                        <div className="mt-0.5 text-[13px] text-slate-600">
                          Insured by {match.insurance_company}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {match.source ? (
                        <Badge variant="outline">
                          {match.source === 'TIRA'
                            ? 'Verified with TIRA'
                            : 'On this platform'}
                        </Badge>
                      ) : null}
                      <Badge variant="success">{match.status}</Badge>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <ResultItem
                      label="Cover type"
                      value={match.cover_type ?? 'Active cover'}
                    />
                    <ResultItem
                      label="Start"
                      value={formatDate(match.effective_date)}
                    />
                    <ResultItem
                      label="Expiry"
                      value={formatDate(match.expiry_date)}
                    />
                    {match.vehicle.make || match.vehicle.model ? (
                      <ResultItem
                        label="Vehicle"
                        value={[match.vehicle.make, match.vehicle.model]
                          .filter(Boolean)
                          .join(' ')}
                      />
                    ) : null}
                  </dl>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-800">{value}</dd>
    </div>
  );
}
