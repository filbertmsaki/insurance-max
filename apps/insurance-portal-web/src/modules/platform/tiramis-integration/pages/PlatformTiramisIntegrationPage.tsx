import { useState, type ReactNode } from 'react';
import { KeyRound, RefreshCcw, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import {
  TIRAMIS_ENVIRONMENT_LABELS,
  TIRAMIS_INTEGRATION_PERMISSIONS,
  TIRAMIS_NOTIFICATION_EVENTS,
  TIRAMIS_PERMISSIONS,
  fileToBase64,
  hasProfiles,
  parseIpList,
  type TiramisCertificateKind,
  type TiramisEnvironment,
  type TiramisFieldSource,
  type TiramisIntegrationOverview,
  type TiramisIntegrationPermission,
  type TiramisProfile,
  type TiramisProfileUpdate,
  type TiramisValidationStatus,
} from '../api';
import {
  useGenerateTiramisServiceKey,
  useRotateTiramisWebhookKey,
  useTiramisIntegrationOverview,
  useTiramisConnectionMutations,
  useUpdateTiramisProfile,
  useUpdateTiramisSettings,
  useUploadTiramisCertificate,
  useValidateTiramisProfile,
} from '../hooks';

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function validationVariant(status?: TiramisValidationStatus | null) {
  if (status === 'VALID') return 'success' as const;
  if (status === 'INVALID') return 'danger' as const;
  return 'warning' as const;
}

function sourceVariant(source?: TiramisFieldSource) {
  if (source === 'profile') return 'primary' as const;
  if (source === 'environment') return 'info' as const;
  if (source === 'missing') return 'danger' as const;
  return 'muted' as const;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function ConnectionTestSummary({
  result,
}: {
  result: Record<string, unknown>;
}) {
  const portal = recordValue(result.portalToTiramis);
  const portalDetails = recordValue(portal?.details);
  const webhook = recordValue(result.tiramisToPortal);
  const passed = result.success === true;
  const direction = (title: string, success: boolean, detail?: string) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div>
        <p className="font-medium">{title}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
      <Badge variant={success ? 'success' : 'danger'}>
        {success ? 'Passed' : 'Failed'}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Connection test</p>
        <Badge variant={passed ? 'success' : 'danger'}>
          {passed ? 'All checks passed' : 'Needs attention'}
        </Badge>
      </div>
      {direction(
        'Portal → TIRAMIS',
        portal?.success === true && portal?.authenticated === true,
        portalDetails?.serviceName
          ? `Authenticated as ${String(portalDetails.serviceName)}${portalDetails.environment ? ` (${String(portalDetails.environment)})` : ''}`
          : String(portal?.message ?? portalDetails?.message ?? ''),
      )}
      {direction(
        'TIRAMIS → Portal',
        webhook?.success === true,
        [
          webhook?.httpStatus ? `HTTP ${String(webhook.httpStatus)}` : null,
          webhook?.message ? String(webhook.message) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )}
      {typeof result.message === 'string' && result.message && (
        <p className="text-sm text-destructive">{String(result.message)}</p>
      )}
      {typeof result.testedAt === 'string' && (
        <p className="text-xs text-muted-foreground">
          Tested {formatDate(String(result.testedAt))}
        </p>
      )}
    </div>
  );
}

function ConnectionProfiles({
  overview,
  canManage,
}: {
  overview: TiramisIntegrationOverview;
  canManage: boolean;
}) {
  const connections = useTiramisConnectionMutations();
  const serviceKey = useGenerateTiramisServiceKey();
  const [env, setEnv] = useState<TiramisEnvironment>(
    overview.activeEnvironment,
  );
  const profile = overview.connections?.find(
    (item) => item.environment === env,
  );
  const [baseUrl, setBaseUrl] = useState(
    profile?.candidateBaseUrl ?? profile?.baseUrl ?? '',
  );
  const [sourceIp, setSourceIp] = useState(profile?.webhookSourceIp ?? '');
  const [portalIps, setPortalIps] = useState(
    profile?.portalOutboundIps?.join(', ') ?? '',
  );
  const [detectedIps, setDetectedIps] = useState<{
    portalOutboundIp: string;
    tiramisOutboundIp: string;
    detectedAt: string;
  } | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const save = () =>
    connections.update.mutate(
      {
        environment: env,
        data: {
          baseUrl,
          webhookSourceIp: sourceIp,
        },
      },
      { onSuccess: () => toast.success('Connection profile saved') },
    );
  const test = () =>
    connections.test.mutate(env, {
      onSuccess: (value) => {
        setResult(value);
        if (value.success === true)
          toast.success('Both connection directions passed');
        else toast.error('Connection test needs attention');
      },
    });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['uat', 'production'] as const).map((value) => (
          <Button
            key={value}
            variant={env === value ? 'default' : 'outline'}
            onClick={() => {
              setEnv(value);
              const next = overview.connections?.find(
                (item) => item.environment === value,
              );
              setBaseUrl(next?.candidateBaseUrl ?? next?.baseUrl ?? '');
              setSourceIp(next?.webhookSourceIp ?? '');
              setPortalIps(next?.portalOutboundIps?.join(', ') ?? '');
              setDetectedIps(null);
              setResult(next?.lastTestResult ?? null);
            }}
          >
            {envLabel(value)}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{envLabel(env)} service connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="TIRAMIS API base URL">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://tiramis.example.com/tiramis-api"
              disabled={!canManage}
            />
          </Field>
          <Field label="TIRAMIS callback source IP/CIDR">
            <Input
              value={sourceIp}
              onChange={(e) => setSourceIp(e.target.value)}
              placeholder="203.0.113.10 or CIDR"
              disabled={!canManage}
            />
          </Field>
          <Field label="Portal outbound IPs (for TIRAMIS service key)">
            <Input
              value={portalIps}
              onChange={(e) => setPortalIps(e.target.value)}
              placeholder="203.0.113.10, 203.0.113.11"
              disabled={!canManage}
            />
          </Field>
          {detectedIps && (
            <p className="text-xs text-muted-foreground">
              Receiver-observed suggestions from{' '}
              {formatDate(detectedIps.detectedAt)}. Verify these values for your
              proxy/NAT setup, then save the callback source IP and generate the
              service key to apply the Portal IP.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button
                variant="outline"
                onClick={() =>
                  connections.detectIps.mutate(env, {
                    onSuccess: (value) => {
                      setSourceIp(value.tiramisOutboundIp);
                      setPortalIps(value.portalOutboundIp);
                      setDetectedIps(value);
                      toast.success(
                        'Receiver-observed IP suggestions loaded; verify and save them',
                      );
                    },
                    onError: (error) => toast.error(getApiErrorMessage(error)),
                  })
                }
                disabled={
                  connections.detectIps.isPending ||
                  !baseUrl.trim() ||
                  baseUrl.trim() !==
                    (profile?.candidateBaseUrl ?? profile?.baseUrl ?? '')
                }
              >
                {connections.detectIps.isPending
                  ? 'Detecting IPs...'
                  : 'Detect source IPs'}
              </Button>
            )}
            {canManage && (
              <Button onClick={save} disabled={connections.update.isPending}>
                Save candidate
              </Button>
            )}
            {canManage && profile?.previousBaseUrl && (
              <Button
                variant="outline"
                onClick={() => setBaseUrl(profile.previousBaseUrl ?? '')}
              >
                Use previous server
              </Button>
            )}
            {canManage && (
              <Button
                variant="outline"
                onClick={() => {
                  const ips = parseIpList(portalIps);
                  if (!ips.length)
                    return toast.error('Enter at least one Portal outbound IP');
                  serviceKey.mutate(
                    { allowedIps: ips, environment: env },
                    {
                      onSuccess: () => {
                        setPortalIps(ips.join(', '));
                        toast.success(
                          `${envLabel(env)} service and webhook keys updated`,
                        );
                      },
                      onError: (error) =>
                        toast.error(getApiErrorMessage(error)),
                    },
                  );
                }}
                disabled={serviceKey.isPending}
              >
                Generate / rotate service key
              </Button>
            )}
            {canManage && (
              <Button
                variant="outline"
                onClick={test}
                disabled={connections.test.isPending}
              >
                Test both directions
              </Button>
            )}
            {canManage &&
              (env !== overview.activeEnvironment ||
                Boolean(profile?.candidateBaseUrl)) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    connections.activate.mutate(env, {
                      onSuccess: () => toast.success('Environment activated'),
                    })
                  }
                  disabled={
                    connections.activate.isPending ||
                    (result?.success !== true &&
                      profile?.lastTestResult?.success !== true)
                  }
                >
                  Activate tested profile
                </Button>
              )}
          </div>
          <div className="text-sm text-muted-foreground">
            Service key:{' '}
            {profile?.serviceApiKeyConfigured
              ? 'configured (encrypted)'
              : 'not configured'}
            . Validation: {profile?.validationStatus ?? 'NOT_VALIDATED'}.{' '}
            {profile?.candidateBaseUrl
              ? 'Candidate endpoint saved; production traffic stays on the active endpoint until activation.'
              : ''}
            {profile?.previousBaseUrl
              ? `Previous URL retained: ${profile.previousBaseUrl}`
              : ''}{' '}
            Configuration source: {profile?.configurationSource ?? 'database'}.
          </div>
          {(result || profile?.lastTestResult) && (
            <ConnectionTestSummary
              result={result ?? profile?.lastTestResult ?? {}}
            />
          )}
          {env === overview.activeEnvironment && (
            <p className="text-xs text-muted-foreground">
              This profile is active. Existing submissions continue using their
              recorded environment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function envLabel(env: TiramisEnvironment) {
  return TIRAMIS_ENVIRONMENT_LABELS[env];
}

function SourceBadge({ source }: { source?: TiramisFieldSource }) {
  if (!source) return null;
  return (
    <Badge variant={sourceVariant(source)} className="ml-2 text-[10px]">
      {source}
    </Badge>
  );
}

function Field({
  label,
  source,
  children,
}: {
  label: string;
  source?: TiramisFieldSource;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center">
        {label}
        <SourceBadge source={source} />
      </Label>
      {children}
    </div>
  );
}

// --- Overview ----------------------------------------------------------------

function OverviewSection({
  overview,
}: {
  overview: TiramisIntegrationOverview;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            {envLabel(overview.environment.name)}
            <Badge variant="success">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-4">
          <div>
            <div className="text-muted-foreground">Validation</div>
            <Badge
              variant={validationVariant(overview.environment.validationStatus)}
            >
              {overview.environment.validationStatus}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Validated at</div>
            <div>{formatDate(overview.environment.validatedAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Service key</div>
            <Badge
              variant={
                overview.environment.serviceApiKeyConfigured
                  ? 'success'
                  : 'warning'
              }
            >
              {overview.environment.serviceApiKeyConfigured
                ? 'Configured'
                : 'Not configured'}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Pending submissions</div>
            <div className="font-medium">
              {overview.environment.pendingSubmissions}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Insurer access</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          {(['LINKED', 'ACTIVE', 'REVOKED'] as const).map((status) => (
            <div key={status}>
              <div className="text-muted-foreground">{status}</div>
              <div className="text-2xl font-semibold">
                {overview.companies?.[status] ?? 0}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Environment profile panel -----------------------------------------------

interface ProfileFormState {
  clientCode: string;
  systemCode: string;
  systemName: string;
  baseUrl: string;
  allowExpiredCertificates: boolean;
  clientKey: string;
  clientCertificatePassword: string;
  publicCertificatePassword: string;
}

function toFormState(profile: TiramisProfile): ProfileFormState {
  return {
    clientCode: profile.clientCode ?? '',
    systemCode: profile.systemCode ?? '',
    systemName: profile.systemName ?? '',
    baseUrl: profile.baseUrl ?? '',
    allowExpiredCertificates: profile.allowExpiredCertificates,
    clientKey: '',
    clientCertificatePassword: '',
    publicCertificatePassword: '',
  };
}

/** Builds the PUT body; write-only secrets are only sent when filled. */
function buildProfileUpdate(form: ProfileFormState): TiramisProfileUpdate {
  const body: TiramisProfileUpdate = {
    clientCode: form.clientCode.trim(),
    systemCode: form.systemCode.trim(),
    systemName: form.systemName.trim(),
    baseUrl: form.baseUrl.trim(),
    allowExpiredCertificates: form.allowExpiredCertificates,
  };
  if (form.clientKey) body.clientKey = form.clientKey;
  if (form.clientCertificatePassword)
    body.clientCertificatePassword = form.clientCertificatePassword;
  if (form.publicCertificatePassword)
    body.publicCertificatePassword = form.publicCertificatePassword;
  return body;
}

function CertificateUpload({
  kind,
  label,
  path,
  passwordConfigured,
  disabled,
}: {
  kind: TiramisCertificateKind;
  label: string;
  path: string | null;
  passwordConfigured: boolean;
  disabled: boolean;
}) {
  const upload = useUploadTiramisCertificate();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [inputKey, setInputKey] = useState(0);

  const submit = async () => {
    if (!file) return;
    try {
      const contentBase64 = await fileToBase64(file);
      await upload.mutateAsync({
        kind,
        contentBase64,
        ...(password ? { password } : {}),
      });
      toast.success(`${label} uploaded`);
      setFile(null);
      setPassword('');
      setInputKey((k) => k + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between text-sm font-medium">
        {label}
        <Badge variant={path ? 'success' : 'warning'}>
          {path ? 'Uploaded' : 'Missing'}
        </Badge>
      </div>
      {path && (
        <div className="break-all text-xs text-muted-foreground">{path}</div>
      )}
      <div className="text-xs text-muted-foreground">
        Password: {passwordConfigured ? 'configured' : 'not configured'}
      </div>
      {!disabled && (
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            key={inputKey}
            type="file"
            accept=".pfx,.p12"
            aria-label={`${label} file`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Certificate password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!file || upload.isPending}
            onClick={() => void submit()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Upload
          </Button>
        </div>
      )}
    </div>
  );
}

function EnvironmentPanel({
  env,
  profile,
  canManage,
}: {
  env: TiramisEnvironment;
  profile: TiramisProfile;
  canManage: boolean;
}) {
  const [form, setForm] = useState<ProfileFormState>(() =>
    toFormState(profile),
  );
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [allowedIps, setAllowedIps] = useState('');
  const [lastValidation, setLastValidation] = useState<{
    errors?: string[];
    warnings?: string[];
  } | null>(null);

  const update = useUpdateTiramisProfile();
  const validate = useValidateTiramisProfile();
  const serviceKey = useGenerateTiramisServiceKey();
  const webhookKey = useRotateTiramisWebhookKey();

  const set = <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    update.mutate(buildProfileUpdate(form), {
      onSuccess: () => toast.success(`${envLabel(env)} profile saved`),
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });

  const runValidation = () =>
    validate.mutate(undefined, {
      onSuccess: (result) => {
        setLastValidation(result);
        if (result.valid) toast.success(result.message);
        else toast.error(result.message);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });

  const generateKey = () => {
    const ips = parseIpList(allowedIps);
    if (ips.length === 0) {
      toast.error('Enter at least one allowed IP address');
      return;
    }
    serviceKey.mutate(
      { allowedIps: ips, environment: env },
      {
        onSuccess: () => {
          toast.success('Service key generated and webhook key rotated');
          setKeyDialogOpen(false);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const rotateWebhook = () =>
    webhookKey.mutate(undefined, {
      onSuccess: () => toast.success('Webhook key rotated'),
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });

  const s = profile.sources ?? {};
  const textField = (
    key: 'clientCode' | 'systemCode' | 'systemName' | 'baseUrl',
    label: string,
  ) => (
    <Field label={label} source={s[key]}>
      <Input
        value={form[key]}
        disabled={!canManage}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  const secretField = (
    key:
      | 'clientKey'
      | 'clientCertificatePassword'
      | 'publicCertificatePassword',
    label: string,
    configured: boolean,
    masked?: string | null,
  ) => (
    <Field label={label} source={s[key]}>
      <Input
        type="password"
        autoComplete="new-password"
        value={form[key]}
        disabled={!canManage}
        placeholder={
          configured
            ? `Configured${masked ? ` (${masked})` : ''} � leave blank to keep`
            : 'Not configured'
        }
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {envLabel(env)} environment
          <Badge variant={validationVariant(profile.validationStatus)}>
            {profile.validationStatus}
          </Badge>
          <Badge
            variant={
              profile.portalWebhookApiKeyConfigured ? 'success' : 'muted'
            }
          >
            Webhook key{' '}
            {profile.portalWebhookApiKeyConfigured ? 'configured' : 'missing'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile.validationMessage && (
          <div className="rounded-md bg-muted p-3 text-sm">
            {profile.validationMessage}
            <div className="text-xs text-muted-foreground">
              Validated: {formatDate(profile.validatedAt)}
            </div>
          </div>
        )}
        {lastValidation &&
        (lastValidation.errors?.length || lastValidation.warnings?.length) ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lastValidation.errors?.map((e) => (
              <li key={`e-${e}`} className="text-red-600">
                {e}
              </li>
            ))}
            {lastValidation.warnings?.map((w) => (
              <li key={`w-${w}`} className="text-amber-700">
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {textField('clientCode', 'Client code')}
          {secretField(
            'clientKey',
            'Client key',
            Boolean(profile.clientKeyMasked),
            profile.clientKeyMasked,
          )}
          {textField('systemCode', 'System code')}
          {textField('systemName', 'System name')}
          {textField('baseUrl', 'Base URL')}
          <Field
            label="Allow expired certificates"
            source={s.allowExpiredCertificates}
          >
            <div className="pt-1">
              <Switch
                checked={form.allowExpiredCertificates}
                disabled={!canManage}
                onCheckedChange={(v) => set('allowExpiredCertificates', v)}
              />
            </div>
          </Field>
          {secretField(
            'clientCertificatePassword',
            'Client certificate password',
            profile.clientCertificatePasswordConfigured,
          )}
          {secretField(
            'publicCertificatePassword',
            'TIRA public certificate password',
            profile.publicCertificatePasswordConfigured,
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <CertificateUpload
            kind="clientPrivate"
            label="Client private certificate"
            path={profile.clientCertificatePath}
            passwordConfigured={profile.clientCertificatePasswordConfigured}
            disabled={!canManage}
          />
          <CertificateUpload
            kind="tiraPublic"
            label="TIRA public certificate"
            path={profile.publicCertificatePath}
            passwordConfigured={profile.publicCertificatePasswordConfigured}
            disabled={!canManage}
          />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={update.isPending}>
              Save
            </Button>
            <Button
              variant="outline"
              onClick={runValidation}
              disabled={validate.isPending}
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              Validate
            </Button>
            <Button variant="outline" onClick={() => setKeyDialogOpen(true)}>
              <KeyRound className="mr-1.5 h-4 w-4" />
              Generate / rotate service key
            </Button>
            <Button
              variant="outline"
              onClick={rotateWebhook}
              disabled={webhookKey.isPending}
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              Rotate webhook key
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Last updated {formatDate(profile.updatedAt)}
          {profile.updatedBy ? ` by ${profile.updatedBy}` : ''}. Any change
          resets validation.
        </p>
      </CardContent>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate {envLabel(env)} service key</DialogTitle>
            <DialogDescription>
              Generates or rotates the platform's TIRAMIS service key for this
              server. The portal webhook key is rotated as well.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`allowed-ips-${env}`}>
              Allowed IP addresses (comma separated)
            </Label>
            <Input
              id={`allowed-ips-${env}`}
              value={allowedIps}
              onChange={(e) => setAllowedIps(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateKey} disabled={serviceKey.isPending}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --- Integration settings ----------------------------------------------------

function NotificationEventsCard({
  env,
  profile,
  canManage,
}: {
  env: TiramisEnvironment;
  profile: TiramisProfile;
  canManage: boolean;
}) {
  const initial =
    profile.portalNotificationEvents ?? TIRAMIS_NOTIFICATION_EVENTS;
  const [selected, setSelected] = useState<string[]>(initial);
  const update = useUpdateTiramisProfile();

  const save = (events: string[]) =>
    update.mutate(
      { portalNotificationEvents: events },
      {
        onSuccess: () =>
          toast.success(`${envLabel(env)} notification events saved`),
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {envLabel(env)} notification events
          {profile.portalNotificationEvents === null && (
            <Badge variant="muted" className="ml-2">
              Defaults
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          {TIRAMIS_NOTIFICATION_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(event)}
                disabled={!canManage}
                onCheckedChange={(v) =>
                  setSelected((prev) =>
                    v === true
                      ? [...prev, event]
                      : prev.filter((item) => item !== event),
                  )
                }
              />
              {event}
            </label>
          ))}
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-amber-700">
            No events selected: all notifications will be disabled.
          </p>
        )}
        {canManage && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => save(selected)}
              disabled={update.isPending}
            >
              Save events
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => save([...TIRAMIS_NOTIFICATION_EVENTS])}
              disabled={update.isPending}
            >
              Use defaults
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsSection({
  overview,
  canManage,
}: {
  overview: TiramisIntegrationOverview;
  canManage: boolean;
}) {
  const [permissions, setPermissions] = useState<string[]>(
    overview.integrationPermissions ?? [],
  );
  const update = useUpdateTiramisSettings();

  const save = () =>
    update.mutate(
      permissions.filter((p): p is TiramisIntegrationPermission =>
        (TIRAMIS_INTEGRATION_PERMISSIONS as string[]).includes(p),
      ),
      {
        onSuccess: () => toast.success('Integration permissions saved'),
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Integration permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TIRAMIS_INTEGRATION_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={permissions.includes(permission)}
                disabled={!canManage}
                onCheckedChange={(v) =>
                  setPermissions((prev) =>
                    v === true
                      ? [...prev, permission]
                      : prev.filter((item) => item !== permission),
                  )
                }
              />
              {permission}
            </label>
          ))}
          {canManage && (
            <Button size="sm" onClick={save} disabled={update.isPending}>
              Save permissions
            </Button>
          )}
        </CardContent>
      </Card>
      {hasProfiles(overview.profile) && (
        <NotificationEventsCard
          key={(overview.profile.portalNotificationEvents ?? []).join(',')}
          env={overview.profile.environment}
          profile={overview.profile}
          canManage={canManage}
        />
      )}
    </div>
  );
}

export function PlatformTiramisIntegrationPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission(TIRAMIS_PERMISSIONS.manage);
  const overviewQuery = useTiramisIntegrationOverview();
  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="TIRAMIS Integration"
        description="Manage the platform's TIRAMIS credentials and insurer access centrally."
        action={
          overview ? (
            <Badge
              variant={
                overview.activeEnvironment === 'production' ? 'success' : 'info'
              }
            >
              Active: {envLabel(overview.activeEnvironment)}
            </Badge>
          ) : undefined
        }
      />

      {overviewQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
      {overviewQuery.isError && (
        <p className="text-sm text-red-600">
          {getApiErrorMessage(overviewQuery.error)}
        </p>
      )}

      {overview && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="settings">Integration settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewSection overview={overview} />
          </TabsContent>

          <TabsContent value="connection" className="mt-4">
            <ConnectionProfiles overview={overview} canManage={canManage} />
          </TabsContent>

          <TabsContent value="profile" className="mt-4 space-y-4">
            {hasProfiles(overview.profile) ? (
              <EnvironmentPanel
                key={`${overview.profile.environment}-${overview.profile.updatedAt ?? ''}-${overview.profile.validationStatus}`}
                env={overview.profile.environment}
                profile={overview.profile}
                canManage={canManage}
              />
            ) : (
              <p className="text-sm text-red-600">
                Profile unavailable: {overview.profile.error}
              </p>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsSection
              key={overview.integrationPermissions.join(',')}
              overview={overview}
              canManage={canManage}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
