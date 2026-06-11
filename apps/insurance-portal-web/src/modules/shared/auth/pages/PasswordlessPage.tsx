import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authApi } from '@/modules/shared/auth/api/auth'
import { getApiErrorMessage } from '@/lib/api-error'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

const schema = z.object({ email: z.string().email() })

export function PasswordlessPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const { setSession } = useAuthStore()
  const [emailSent, setEmailSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

  const requestMutation = useMutation({
    mutationFn: (d: z.infer<typeof schema>) => authApi.passwordlessRequest(d.email),
    onSuccess: () => {
      setEmailSent(true)
      setErrorMessage(null)
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error))
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => authApi.passwordlessComplete(token!),
    onSuccess: (tokens) => {
      setSession(tokens)
      setErrorMessage(null)
      toast.success('Signed in!')
      navigate('/dashboard')
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error))
    },
  })

  useEffect(() => {
    if (token) {
      completeMutation.mutate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            {completeMutation.isPending && (
              <>
                <Loader2 className="h-16 w-16 text-blue-500 mx-auto animate-spin" />
                <h2 className="text-xl font-semibold">Signing you in...</h2>
              </>
            )}
            {completeMutation.isError && !errorMessage && (
              <>
                <p className="text-red-500">Link is invalid or expired.</p>
                <Link to="/passwordless" className="text-blue-600 hover:underline text-sm">
                  Request a new link
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <Mail className="h-10 w-10 text-blue-400 mx-auto" />
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="text-slate-500 text-sm">We've sent a magic sign-in link to your email.</p>
            <Link to="/login" className="text-sm text-slate-400 hover:underline block">
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldCheck className="h-9 w-9 text-blue-600" />
          <span className="text-2xl font-bold text-slate-900">{import.meta.env.VITE_APP_NAME}</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Passwordless sign in</CardTitle>
            <CardDescription>Receive a magic link in your email to sign in instantly</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => {
                  setErrorMessage(null)
                  requestMutation.mutate(d)
                })}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={requestMutation.isPending}>
                  {requestMutation.isPending ? 'Sending...' : 'Send magic link'}
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-slate-400 hover:underline">
                    Back to sign in
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
