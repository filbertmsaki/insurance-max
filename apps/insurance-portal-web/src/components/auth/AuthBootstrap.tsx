import { useEffect } from 'react'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/store/auth.store'

export function AuthBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const setProfile = useAuthStore((state) => state.setProfile)

  useEffect(() => {
    let cancelled = false

    if (!accessToken) {
      setProfile(null)
      return undefined
    }

    void usersApi
      .getMe()
      .then((profile) => {
        if (!cancelled) {
          setProfile(profile)
        }
      })
      .catch(() => {
        // The API client already handles token refresh/revocation paths.
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, setProfile])

  return null
}
