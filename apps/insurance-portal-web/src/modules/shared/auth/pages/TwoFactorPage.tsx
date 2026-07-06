import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import OtpInput from 'react-otp-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authApi } from '@/modules/shared/auth/api/auth'
import { getApiErrorMessage } from '@/lib/api-error'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

export function TwoFactorPage() {
  const navigate = useNavigate()
  const { tempToken, setSession } = useAuthStore()
  const [code, setCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return unsubscribe
  }, [])

  const mutation = useMutation({
    mutationFn: () =>
      authApi.complete2fa({
        tempToken: tempToken!,
        token: useBackup ? backupCode : code,
      }),
    onSuccess: (tokens) => {
      setSession(tokens)
      setErrorMessage(null)
      toast.success('Welcome back!')
      navigate('/dashboard')
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error))
    },
  })

  if (!hydrated) {
    return null
  }

  if (!tempToken) {
    navigate('/login')
    return null
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
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>
              {useBackup
                ? 'Enter one of your backup codes'
                : 'Enter the 6-digit code from your authenticator app'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            {!useBackup ? (
              <div className="flex justify-center">
                <OtpInput
                  value={code}
                  onChange={setCode}
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
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Backup code</label>
                <Input
                  placeholder="Enter backup code"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => mutation.mutate()}
              disabled={
                mutation.isPending ||
                (!useBackup && code.length < 6) ||
                (useBackup && backupCode.trim().length === 0)
              }
            >
              {mutation.isPending ? 'Verifying...' : 'Verify'}
            </Button>

            <button
              type="button"
              onClick={() => { setUseBackup((v) => !v); setCode(''); setBackupCode(''); setErrorMessage(null) }}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              {useBackup ? 'Use authenticator code instead' : 'Use a backup code instead'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
