import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  tiramisConfigApi,
  type CompanyTiramisConfiguration,
} from '../api/tiramis-config'

const schema = z.object({
  company_code: z.string().min(1, 'Required').max(30),
  insurer_company_code: z.string().max(30).optional().or(z.literal('')),
  client_code: z.string().max(60).optional().or(z.literal('')),
  system_code: z.string().min(1, 'Required').max(100),
  system_name: z.string().max(150).optional().or(z.literal('')),
  callback_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

type ApiErrorLike = { response?: { data?: { message?: string } } }

function ValidationBadge({ status }: { status: CompanyTiramisConfiguration['validationStatus'] }) {
  if (status === 'VALID') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Validated
      </Badge>
    )
  }
  if (status === 'INVALID') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        <XCircle className="mr-1 h-3 w-3" /> Invalid
      </Badge>
    )
  }
  return <Badge variant="outline">Not validated</Badge>
}

function EnvironmentPanel({
  environment,
  config,
  canEdit,
}: {
  environment: 'test' | 'live'
  config?: CompanyTiramisConfiguration
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(!config)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_code: config?.companyCode ?? '',
      insurer_company_code: config?.insurerCompanyCode ?? '',
      client_code: config?.clientCode ?? '',
      system_code: config?.systemCode ?? '',
      system_name: config?.systemName ?? '',
      callback_url: config?.callbackUrl ?? '',
    },
  })

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      tiramisConfigApi.upsertMyConfiguration(environment, {
        company_code: values.company_code,
        insurer_company_code: values.insurer_company_code || undefined,
        client_code: values.client_code || undefined,
        system_code: values.system_code,
        system_name: values.system_name || undefined,
        callback_url: values.callback_url || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiramis-my-configurations'] })
      toast.success(`${environment.toUpperCase()} configuration saved`)
      setEditing(false)
    },
    onError: (error: ApiErrorLike) =>
      toast.error(error?.response?.data?.message ?? 'Unable to save configuration'),
  })

  const validateMutation = useMutation({
    mutationFn: () => tiramisConfigApi.validateMyConfiguration(environment),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tiramis-my-configurations'] })
      if (result.valid) {
        toast.success('Configuration validated successfully')
      } else {
        toast.error(result.message ?? 'Configuration failed validation')
      }
    },
    onError: (error: ApiErrorLike) =>
      toast.error(error?.response?.data?.message ?? 'Unable to validate configuration'),
  })

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base capitalize">{environment} environment</CardTitle>
          <CardDescription>
            {environment === 'live'
              ? 'Production TIRAMIS credentials used for real submissions.'
              : 'Sandbox TIRAMIS credentials used for testing.'}
          </CardDescription>
        </div>
        {config && <ValidationBadge status={config.validationStatus} />}
      </CardHeader>
      <CardContent>
        {editing ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Code</FormLabel>
                      <FormControl><Input placeholder="INS001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insurer_company_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurer Company Code</FormLabel>
                      <FormControl><Input placeholder="Optional, defaults to company code" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Code</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Code</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="callback_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Callback URL</FormLabel>
                      <FormControl><Input placeholder="https://…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                {config && (
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save configuration'}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-slate-500">Company Code:</span> {config?.companyCode}</div>
              <div><span className="text-slate-500">Insurer Code:</span> {config?.insurerCompanyCode ?? '—'}</div>
              <div><span className="text-slate-500">System Code:</span> {config?.systemCode ?? '—'}</div>
              <div><span className="text-slate-500">System Name:</span> {config?.systemName ?? '—'}</div>
              {config?.validationMessage && (
                <div className="col-span-2 text-slate-500">
                  Last validation message: {config.validationMessage}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {validateMutation.isPending ? 'Validating…' : 'Validate'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TiramisConfigTab({ canEdit }: { canEdit: boolean }) {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['tiramis-my-configurations'],
    queryFn: tiramisConfigApi.getMyConfigurations,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const testConfig = configs?.find((c) => c.environment === 'test')
  const liveConfig = configs?.find((c) => c.environment === 'live')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <EnvironmentPanel environment="test" config={testConfig} canEdit={canEdit} />
      <EnvironmentPanel environment="live" config={liveConfig} canEdit={canEdit} />
    </div>
  )
}
