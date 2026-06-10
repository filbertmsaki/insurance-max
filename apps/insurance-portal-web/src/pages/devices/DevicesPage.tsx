import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Shield, ShieldOff, Trash2, Smartphone, Monitor, Laptop } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { devicesApi } from '@/api/devices'
import { useState } from 'react'
import type { Device } from '@/types'

function DeviceIcon({ type }: { type: string | null }) {
  if (type?.toLowerCase().includes('mobile') || type?.toLowerCase().includes('phone')) {
    return <Smartphone className="h-8 w-8 text-slate-400" />
  }
  if (type?.toLowerCase().includes('tablet')) {
    return <Monitor className="h-8 w-8 text-slate-400" />
  }
  return <Laptop className="h-8 w-8 text-slate-400" />
}

export function DevicesPage() {
  const queryClient = useQueryClient()
  const [removeId, setRemoveId] = useState<string | null>(null)

  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  })

  const trustMutation = useMutation({
    mutationFn: devicesApi.trustDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Device trusted')
    },
  })

  const untrustMutation = useMutation({
    mutationFn: devicesApi.untrustDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Device untrusted')
    },
  })

  const removeMutation = useMutation({
    mutationFn: devicesApi.removeDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setRemoveId(null)
      toast.success('Device removed')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Devices" description="Manage your trusted devices" />

      {!devices?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Smartphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No devices found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {devices.map((device: Device) => (
            <Card key={device.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <DeviceIcon type={device.device_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-slate-900">
                        {device.device_name ?? 'Unknown Device'}
                      </h3>
                      {device.trusted && (
                        <Badge variant="success" className="text-xs flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Trusted
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {[device.os, device.browser].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Last used: {format(new Date(device.last_used_at), 'MMM d, yyyy HH:mm')}
                    </p>
                    {device.trusted_at && (
                      <p className="text-xs text-slate-400">
                        Trusted since: {format(new Date(device.trusted_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        device.trusted
                          ? untrustMutation.mutate(device.id)
                          : trustMutation.mutate(device.id)
                      }
                      disabled={trustMutation.isPending || untrustMutation.isPending}
                    >
                      {device.trusted ? (
                        <><ShieldOff className="mr-1 h-4 w-4" /> Untrust</>
                      ) : (
                        <><Shield className="mr-1 h-4 w-4" /> Trust</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => setRemoveId(device.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove Device"
        description="Are you sure you want to remove this device? You'll need to re-authenticate on it."
        confirmLabel="Remove"
        onConfirm={() => removeMutation.mutate(removeId!)}
        loading={removeMutation.isPending}
      />
    </div>
  )
}
