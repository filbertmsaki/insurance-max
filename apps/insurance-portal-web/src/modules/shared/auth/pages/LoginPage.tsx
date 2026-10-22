import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi } from '@/modules/shared/auth/api/auth';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession, setTempToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setErrorMessage(null);

      if (data.requiresEmailVerification) {
        setErrorMessage(
          data.message ?? 'Please verify your email address before signing in.',
        );
        return;
      }

      if (data.requires2FA && data.tempToken) {
        setTempToken(data.tempToken);
        navigate('/2fa');
        return;
      }
      if (data.access_token && data.refresh_token) {
        setSession(data);
        toast.success('Welcome back!');
        const from = location.state as
          | { from?: { pathname?: string; search?: string } }
          | undefined;
        const nextPath = from?.from?.pathname
          ? `${from.from.pathname}${from.from.search ?? ''}`
          : '/apps/dashboard';
        navigate(nextPath, { replace: true });
      }
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error));
    },
  });

  const onSubmit = (values: LoginForm) => {
    setErrorMessage(null);
    mutation.mutate(values);
  };

  return (
    <div className="vz-auth">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="px-6 pb-2 pt-8 sm:px-8">
            <CardTitle role="heading" aria-level={1} className="text-xl">
              Sign in
            </CardTitle>
            <CardDescription>
              Enter your email and password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 pt-4 sm:px-8">
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form
                onSubmit={(event) => {
                  void form.handleSubmit(onSubmit)(event);
                }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="you@example.com"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end text-sm">
                  <Link
                    to="/forgot-password"
                    className="text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="success"
                  className="w-full"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Signing in…' : 'Sign in'}
                </Button>

                <div className="text-center text-sm text-slate-500">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Create one
                  </Link>
                </div>

                <div className="border-t border-slate-200 pt-4 text-center">
                  <Link
                    to="/phone-login"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Sign in with phone instead
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
