import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import OtpInput from 'react-otp-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth.store'

const phoneSchema = z.object({
  phone: z.string().regex(/^(\+255|255|0)[67]\d{8}$/, 'Invalid Tanzanian phone'),
})

export function PhoneLoginPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()
  const [otpId, setOtpId] = useState<string | null>(null)
  const [otp, setOtp] = useState('')

  const form = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
  })

  const sendOtpMutation = useMutation({
    mutationFn: (d: z.infer<typeof phoneSchema>) => authApi.sendOtp(d.phone),
    onSuccess: (data) => {
      setOtpId(data.otpId)
      toast.success('OTP sent to your phone')
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () => authApi.phoneLogin({ otp_id: otpId!, otp }),
    onSuccess: (tokens) => {
      setTokens(tokens.access_token, tokens.refresh_token)
      toast.success('Signed in!')
      navigate('/dashboard')
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldCheck className="h-9 w-9 text-blue-600" />
          <span className="text-2xl font-bold text-slate-900">{import.meta.env.VITE_APP_NAME}</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in with phone</CardTitle>
            <CardDescription>
              {!otpId
                ? 'Enter your Tanzanian phone number to receive an OTP'
                : 'Enter the 6-digit code sent to your phone'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!otpId ? (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((d) => sendOtpMutation.mutate(d))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone number</FormLabel>
                        <FormControl>
                          <Input placeholder="+255712345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={sendOtpMutation.isPending}>
                    {sendOtpMutation.isPending ? 'Sending OTP...' : 'Send OTP'}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    numInputs={6}
                    renderSeparator={<span className="w-2" />}
                    renderInput={(props) => (
                      <input
                        {...props}
                        className="!w-10 h-12 text-center border border-slate-200 rounded-md text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => verifyMutation.mutate()}
                  disabled={otp.length < 6 || verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setOtpId(null); setOtp('') }}
                  className="w-full text-sm text-slate-500 hover:underline"
                >
                  Change phone number
                </button>
              </div>
            )}

            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-slate-400 hover:underline">
                Back to email sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
