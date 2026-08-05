import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, XCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import OtpInput from 'react-otp-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { usersApi } from '@/modules/tenant/users/api/users';

const profileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z
    .string()
    .regex(/^(\+255|255|0)[67]\d{8}$/, 'Invalid Tanzanian phone'),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1),
    new_password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

function ProfileTab() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: usersApi.getMe,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: me
      ? { first_name: me.first_name, last_name: me.last_name, phone: me.phone }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (d: z.infer<typeof profileSchema>) => usersApi.updateMe(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))}
            className="space-y-4 max-w-md"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-sm text-slate-500">
              <span>Email: </span>
              <strong>{me?.email}</strong>
            </div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function PasswordTab() {
  const [showPw, setShowPw] = useState(false);
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

  const changeMutation = useMutation({
    mutationFn: (d: z.infer<typeof passwordSchema>) =>
      usersApi.changePassword({
        old_password: d.old_password,
        new_password: d.new_password,
      }),
    onSuccess: () => {
      toast.success('Password changed');
      form.reset();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => changeMutation.mutate(d))}
            className="space-y-4 max-w-md"
          >
            <FormField
              control={form.control}
              name="old_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input type={showPw ? 'text' : 'password'} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type={showPw ? 'text' : 'password'} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type={showPw ? 'text' : 'password'} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {showPw ? 'Hide' : 'Show'} passwords
              </button>
            </label>
            <Button type="submit" disabled={changeMutation.isPending}>
              {changeMutation.isPending ? 'Changing...' : 'Change password'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function TwoFactorTab() {
  const {
    data: me,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['me'],
    queryFn: usersApi.getMe,
  });

  const [setupData, setSetupData] = useState<{
    qr_code_url: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [regenCode, setRegenCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: usersApi.setup2fa,
    onSuccess: (data) => setSetupData(data),
  });

  const verifyMutation = useMutation({
    mutationFn: () => usersApi.verify2fa(verifyCode),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      setSetupData(null);
      setVerifyCode('');
      refetch();
      toast.success('2FA enabled');
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => usersApi.disable2fa(disableCode),
    onSuccess: () => {
      setDisableCode('');
      refetch();
      toast.success('2FA disabled');
    },
  });

  const regenMutation = useMutation({
    mutationFn: () => usersApi.regenerateBackupCodes(regenCode),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      setRegenCode('');
      toast.success('Backup codes regenerated');
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {me?.is_two_factor_enabled ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700">
                  2FA is enabled
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-slate-400" />
                <span className="text-slate-500">2FA is not enabled</span>
              </>
            )}
          </div>

          {!me?.is_two_factor_enabled && !setupData && (
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? 'Setting up...' : 'Enable 2FA'}
            </Button>
          )}

          {setupData && (
            <div className="space-y-4 max-w-sm">
              <p className="text-sm text-slate-600">
                Scan this QR code with your authenticator app (Google
                Authenticator, Authy, etc.)
              </p>
              <div className="flex justify-center p-4 bg-white border rounded-lg">
                <QRCodeSVG value={setupData.qr_code_url} size={192} />
              </div>
              <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-xs text-slate-500 mb-1">Manual entry key:</p>
                <code className="text-sm font-mono break-all">
                  {setupData.secret}
                </code>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Enter verification code
                </label>
                <OtpInput
                  value={verifyCode}
                  onChange={setVerifyCode}
                  numInputs={6}
                  renderSeparator={<span className="w-2" />}
                  renderInput={(props) => (
                    <input
                      {...props}
                      className="!w-10 h-12 text-center border border-slate-200 rounded-md text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                />
                <Button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyCode.length < 6 || verifyMutation.isPending}
                >
                  Verify & Enable
                </Button>
              </div>
            </div>
          )}

          {me?.is_two_factor_enabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Disable 2FA (requires code)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="6-digit code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    className="max-w-36"
                  />
                  <Button
                    variant="destructive"
                    onClick={() => disableMutation.mutate()}
                    disabled={
                      disableCode.length < 6 || disableMutation.isPending
                    }
                  >
                    Disable 2FA
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Regenerate backup codes (requires code)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="6-digit code"
                    value={regenCode}
                    onChange={(e) => setRegenCode(e.target.value)}
                    className="max-w-36"
                  />
                  <Button
                    variant="outline"
                    onClick={() => regenMutation.mutate()}
                    disabled={regenCode.length < 6 || regenMutation.isPending}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {backupCodes && (
        <Card>
          <CardHeader>
            <CardTitle>Backup Codes</CardTitle>
            <CardDescription>
              Save these codes. Each can be used once to sign in if you lose
              access to your authenticator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert
              variant="warning"
              className="mb-4 bg-amber-50 border-amber-200"
            >
              <AlertDescription className="text-amber-800">
                Store these codes in a safe place. They won't be shown again.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code) => (
                <button
                  key={code}
                  onClick={() => copyCode(code)}
                  className="flex items-center justify-between p-2 bg-slate-50 border rounded hover:bg-slate-100 transition-colors"
                >
                  <span>{code}</span>
                  {copiedCode === code ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ProfilePage() {
  const [params] = useSearchParams();
  const defaultTab = params.get('tab') ?? 'profile';

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account settings and security"
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Change Password</TabsTrigger>
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="2fa" className="mt-4">
          <TwoFactorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
