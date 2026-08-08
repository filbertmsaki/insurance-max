import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { engagementApi } from '../api';

export function NotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const [eventCode, setEventCode] = useState('CLAIM_ASSIGNED');
  const [channel, setChannel] = useState('IN_APP');
  const [mode, setMode] = useState('ENABLED');

  const preferencesQuery = useQuery({
    queryKey: ['engagement', 'notification-preferences'],
    queryFn: engagementApi.listNotificationPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const items = preferencesQuery.data
        ? preferencesQuery.data.map(({ id: _id, ...item }) => item)
        : [];

      items.push({
        event_code: eventCode,
        channel,
        mode,
        quiet_hours_from: null,
        quiet_hours_to: null,
        marketing_consent: false,
        transactional_required: false,
      });

      return engagementApi.updateNotificationPreferences(items);
    },
    onSuccess: () => {
      toast.success('Preferences updated');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'notification-preferences'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title="Notification Preferences"
        description="Per-event channel preference overrides for the current user."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Add preference</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="pref-event">Event code</Label>
            <Input
              id="pref-event"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref-channel">Channel</Label>
            <Input
              id="pref-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref-mode">Mode</Label>
            <Input
              id="pref-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              Save preference
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(preferencesQuery.data ?? []).map((preference) => (
                <TableRow key={preference.id}>
                  <TableCell>{preference.event_code}</TableCell>
                  <TableCell>{preference.channel}</TableCell>
                  <TableCell>{preference.mode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
