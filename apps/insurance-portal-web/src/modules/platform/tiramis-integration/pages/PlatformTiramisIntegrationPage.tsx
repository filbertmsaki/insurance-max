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
  TIRAMIS_ENVIRONMENTS,
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
  useSwitchTiramisEnvironment,
  useTiramisIntegrationOverview,
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

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewSection({
  overview,
}: {
  overview: TiramisIntegrationOverview;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {TIRAMIS_ENVIRONMENTS.map((env) => {
          const summary = overview.environments[env];
          return (
            <Card key={env}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {envLabel(env)}
                  {overview.activeEnvironment === env && (
                    <Badge variant="success">Active</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Validation</span>
                  <Badge variant={validationVariant(summary?.validationStatus)}>
                    {summary?.validationStatus ?? 'NOT_VALIDATED'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Validated at</span>
                  <span>{formatDate(summary?.validatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service key</span>
                  <Badge
                    variant={
                      summary?.serviceApiKeyConfigured ? 'success' : 'warning'
                    }
                  >
                    {summary?.serviceApiKeyConfigured
                      ? 'Configured'
                      : 'Not configured'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Pending submissions
                  </span>
                  <span className="font-medium">
                    {summary?.pendingSubmissions ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
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

// ─── Environment profile panel ───────────────────────────────────────────────

interface ProfileFormState {
  clientCode: string;
  systemCode: string;
  systemName: string;
  baseUrl: string;
  callbackUrl: string;
  signatureAlgorithm: string;
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
    callbackUrl: profile.callbackUrl ?? '',
    signatureAlgorithm: profile.signatureAlgorithm ?? '',
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
    callbackUrl: form.callbackUrl.trim(),
    signatureAlgorithm: form.signatureAlgorithm.trim(),
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
  env,
  kind,
  label,
  path,
  passwordConfigured,
  disabled,
}: {
  env: TiramisEnvironment;
  kind: TiramisCertificateKind;
  label: string;
  path: string | null;
  passwordConfigured: boolean;
  disabled: boolean;
}) {
  const upload = useUploadTiramisCertificate(env);
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
  const [allowedIps, setAllowedIps] = useState('127.0.0.1');
  const [lastValidation, setLastValidation] = useState<{
    errors?: string[];
    warnings?: string[];
  } | null>(null);

  const update = useUpdateTiramisProfile(env);
  const validate = useValidateTiramisProfile(env);
  const serviceKey = useGenerateTiramisServiceKey(env);
  const webhookKey = useRotateTiramisWebhookKey(env);

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
    serviceKey.mutate(ips, {
      onSuccess: () => {
        toast.success('Service key generated and webhook key rotated');
        setKeyDialogOpen(false);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  const rotateWebhook = () =>
    webhookKey.mutate(undefined, {
      onSuccess: () => toast.success('Webhook key rotated'),
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });

  const s = profile.sources ?? {};
  const textField = (
    key:
      | 'clientCode'
      | 'systemCode'
      | 'systemName'
      | 'baseUrl'
      | 'callbackUrl'
      | 'signatureAlgorithm',
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
            ? `Configured${masked ? ` (${masked})` : ''} — leave blank to keep`
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
          {textField('callbackUrl', 'Callback URL')}
          {textField('signatureAlgorithm', 'Signature algorithm')}
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
            env={env}
            kind="clientPrivate"
            label="Client private certificate"
            path={profile.clientCertificatePath}
            passwordConfigured={profile.clientCertificatePasswordConfigured}
            disabled={!canManage}
          />
          <CertificateUpload
            env={env}
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
              environment. The portal webhook key is rotated as well.
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

// ─── Environment switch ──────────────────────────────────────────────────────

function EnvironmentSwitchSection({
  overview,
  canSwitch,
}: {
  overview: TiramisIntegrationOverview;
  canSwitch: boolean;
}) {
  const current = overview.activeEnvironment;
  const target: TiramisEnvironment = current === 'live' ? 'test' : 'live';
  const [open, setOpen] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const switchEnv = useSwitchTiramisEnvironment();
  const pendingLeaving =
    overview.environments[current]?.pendingSubmissions ?? 0;

  const submit = () =>
    switchEnv.mutate(
      {
        environment: target,
        confirmLive: target === 'live' ? confirmLive : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Switched to ${envLabel(target)}`);
          setOpen(false);
          setConfirmLive(false);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Active environment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          Currently active:
          <Badge variant={current === 'live' ? 'success' : 'info'}>
            {envLabel(current)}
          </Badge>
          <span className="text-muted-foreground">
            since {formatDate(overview.environmentSwitchedAt)}
          </span>
        </div>
        <p className="text-muted-foreground">
          Submissions already sent finish in their original environment; keep
          both environments configured until the old one has no pending
          submissions.
        </p>
        {canSwitch && (
          <Button onClick={() => setOpen(true)}>
            Switch to {envLabel(target)}
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to {envLabel(target)}?</DialogTitle>
            <DialogDescription>
              New TIRAMIS submissions for all insurers will be sent to the{' '}
              {envLabel(target)} environment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Pending submissions in {envLabel(current)}:{' '}
              <strong>{pendingLeaving}</strong>
            </p>
            <p className="text-muted-foreground">
              Submissions already sent finish in their original environment;
              keep both environments configured until the old one has no pending
              submissions.
            </p>
            {target === 'live' && (
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={confirmLive}
                  onCheckedChange={(v) => setConfirmLive(v === true)}
                />
                <span>
                  I confirm that real policies will be submitted to the TIRA
                  Production environment.
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                switchEnv.isPending || (target === 'live' && !confirmLive)
              }
            >
              Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Integration settings ────────────────────────────────────────────────────

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
  const update = useUpdateTiramisProfile(env);

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
      {hasProfiles(overview.profiles) && (
        <div className="grid gap-4 md:grid-cols-2">
          {TIRAMIS_ENVIRONMENTS.map((env) =>
            hasProfiles(overview.profiles) ? (
              <NotificationEventsCard
                key={`${env}-${(overview.profiles[env].portalNotificationEvents ?? []).join(',')}`}
                env={env}
                profile={overview.profiles[env]}
                canManage={canManage}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function PlatformTiramisIntegrationPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission(TIRAMIS_PERMISSIONS.manage);
  const canSwitch = hasPermission(TIRAMIS_PERMISSIONS.switchEnvironment);
  const overviewQuery = useTiramisIntegrationOverview();
  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="TIRAMIS Integration"
        description="Manage the platform's TIRAMIS credentials, active environment and insurer access centrally."
        action={
          overview ? (
            <Badge
              variant={
                overview.activeEnvironment === 'live' ? 'success' : 'info'
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
            <TabsTrigger value="environments">Environments</TabsTrigger>
            <TabsTrigger value="switch">Environment switch</TabsTrigger>
            <TabsTrigger value="settings">Integration settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewSection overview={overview} />
          </TabsContent>

          <TabsContent value="environments" className="mt-4 space-y-4">
            {hasProfiles(overview.profiles) ? (
              TIRAMIS_ENVIRONMENTS.map((env) =>
                hasProfiles(overview.profiles) ? (
                  <EnvironmentPanel
                    key={`${env}-${overview.profiles[env].updatedAt ?? ''}-${overview.profiles[env].validationStatus}`}
                    env={env}
                    profile={overview.profiles[env]}
                    canManage={canManage}
                  />
                ) : null,
              )
            ) : (
              <p className="text-sm text-red-600">
                Profiles unavailable: {overview.profiles.error}
              </p>
            )}
          </TabsContent>

          <TabsContent value="switch" className="mt-4">
            <EnvironmentSwitchSection
              overview={overview}
              canSwitch={canSwitch}
            />
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
