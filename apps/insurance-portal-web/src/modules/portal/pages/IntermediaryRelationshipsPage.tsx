import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { portalApi } from '../api';
import { PartnerAmendmentsPanel } from '@/modules/shared/partners/PartnerAmendmentsPanel';

export function IntermediaryRelationshipsPage() {
  const client = useQueryClient();
  const [insurerId, setInsurerId] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const relationshipsQuery = useQuery({
    queryKey: ['intermediary', 'relationships'],
    queryFn: portalApi.intermediaryPartnerRelationships,
  });
  const insurersQuery = useQuery({
    queryKey: ['intermediary', 'relationship-insurers'],
    queryFn: portalApi.relationshipInsurers,
  });
  const requestMutation = useMutation({
    mutationFn: () =>
      portalApi.requestInsurerAppointment(
        insurerId,
        requestNote.trim() || undefined,
      ),
    onSuccess: async () => {
      toast.success('Appointment request sent to the insurer');
      setInsurerId('');
      setRequestNote('');
      await client.invalidateQueries({
        queryKey: ['intermediary', 'relationships'],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not send appointment request',
      ),
  });
  const withdrawMutation = useMutation({
    mutationFn: (id: string) =>
      portalApi.withdrawInsurerAppointment(
        id,
        'Withdrawn by partner organization',
      ),
    onSuccess: async () => {
      toast.success('Appointment request withdrawn');
      await client.invalidateQueries({
        queryKey: ['intermediary', 'relationships'],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not withdraw request',
      ),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intermediary portal"
        title="Insurer connections"
        description="Request appointments and track each insurer’s approval and product access."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request an appointment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label>Insurer</Label>
            <Select value={insurerId} onValueChange={setInsurerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an insurer" />
              </SelectTrigger>
              <SelectContent>
                {(insurersQuery.data ?? []).map((insurer) => (
                  <SelectItem key={insurer.id} value={insurer.id}>
                    {insurer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Request note</Label>
            <Textarea
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Briefly explain the appointment request"
              rows={2}
            />
          </div>
          <Button
            disabled={!insurerId || requestMutation.isPending}
            onClick={() => requestMutation.mutate()}
          >
            Send request
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your insurer appointments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="p-2">Insurer</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Effective</th>
                <th className="p-2">Access</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(relationshipsQuery.data ?? []).map((relationship) => (
                <tr key={relationship.id} className="border-b">
                  <td className="p-2">
                    {relationship.insurer_company?.name ??
                      relationship.insurer_company?.id}
                  </td>
                  <td className="p-2">
                    {relationship.partner_type.replaceAll('_', ' ')}
                  </td>
                  <td className="p-2">
                    <Badge variant="outline">{relationship.status}</Badge>
                  </td>
                  <td className="p-2">
                    {relationship.start_date ?? '—'} –{' '}
                    {relationship.end_date ?? 'Open-ended'}
                  </td>
                  <td className="p-2">
                    {relationship.status === 'ACTIVE'
                      ? relationship.scope_mode === 'LEGACY'
                        ? 'Legacy grants'
                        : 'Insurer-configured'
                      : 'Unavailable'}
                  </td>
                  <td className="p-2">
                    {relationship.status === 'PENDING' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={withdrawMutation.isPending}
                        onClick={() => withdrawMutation.mutate(relationship.id)}
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {relationshipsQuery.isLoading ? (
            <p className="py-4 text-sm text-slate-500">Loading appointments…</p>
          ) : null}
          {!relationshipsQuery.isLoading && !relationshipsQuery.data?.length ? (
            <p className="py-4 text-sm text-slate-500">
              No appointments yet. Send a request to start working with an
              insurer.
            </p>
          ) : null}
          {relationshipsQuery.isError ? (
            <p className="py-4 text-sm text-red-600">
              Could not load insurer appointments.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active agreement terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(relationshipsQuery.data ?? [])
            .filter((relationship) => relationship.status === 'ACTIVE')
            .map((relationship) => (
              <details key={relationship.id} className="rounded border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {relationship.insurer_company?.name ??
                    relationship.insurer_company?.id}{' '}
                  · {relationship.partner_type.replaceAll('_', ' ')}
                </summary>
                <div className="mt-3">
                  <PartnerAmendmentsPanel
                    relationshipId={relationship.id}
                    apiRoot="/partner-relationships"
                  />
                </div>
              </details>
            ))}
          {relationshipsQuery.data?.every(
            (relationship) => relationship.status !== 'ACTIVE',
          ) ? (
            <p className="text-sm text-slate-500">
              Agreement changes become available after an appointment is active.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
