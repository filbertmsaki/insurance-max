import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { authApi } from '@/modules/shared/auth/api/auth'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldCheck className="h-9 w-9 text-blue-600" />
          <span className="text-2xl font-bold text-slate-900">{import.meta.env.VITE_APP_NAME}</span>
        </div>
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {status === 'loading' && (
              <>
                <Loader2 className="h-16 w-16 text-blue-500 mx-auto animate-spin" />
                <h2 className="text-xl font-semibold">Verifying your email...</h2>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold">Email verified!</h2>
                <p className="text-slate-500 text-sm">Your email has been verified successfully.</p>
                <Link to="/login">
                  <Button className="mt-2">Sign in to your account</Button>
                </Link>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                <h2 className="text-xl font-semibold">Verification failed</h2>
                <p className="text-slate-500 text-sm">
                  The verification link is invalid or has expired.
                </p>
                <Link to="/login" className="text-blue-600 hover:underline text-sm block">
                  Back to sign in
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
