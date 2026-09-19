import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { portalApi, type CustomerCoverCheckResult } from '../api';

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
    onSuccess: setResult,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    checkMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer Portal"
        title="Check Vehicle Cover"
        description="Search by registration number or chassis number."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-slate-500" />
            Vehicle Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="registration-number">Registration number</Label>
              <Input
                id="registration-number"
                value={registrationNumber}
                onChange={(event) => setRegistrationNumber(event.target.value)}
                placeholder="T123ABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chassis-number">Chassis number</Label>
              <Input
                id="chassis-number"
                value={chassisNumber}
                onChange={(event) => setChassisNumber(event.target.value)}
                placeholder="Chassis number"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={
                  checkMutation.isPending ||
                  (!registrationNumber.trim() && !chassisNumber.trim())
                }
              >
                <Search className="h-4 w-4" />
                Check
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!result.active ? (
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="font-medium text-slate-950">
                  No active cover found
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  You can continue to buy cover for this vehicle.
                </div>
              </div>
            ) : (
              result.matches.map((match, index) => (
                <div
                  key={`${match.vehicle.registration_no ?? match.vehicle.chassis_no ?? 'vehicle'}-${match.expiry_date}-${index}`}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">
                        {match.vehicle.registration_no ??
                          match.vehicle.chassis_no ??
                          'Vehicle'}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {match.insurance_company}
                      </div>
                    </div>
                    <Badge variant="outline">{match.status}</Badge>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <ResultItem
                      label="Cover type"
                      value={match.cover_type ?? 'Active cover'}
                    />
                    <ResultItem label="Start" value={match.effective_date} />
                    <ResultItem label="Expiry" value={match.expiry_date} />
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
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
