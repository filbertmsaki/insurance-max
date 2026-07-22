import { useEffect, useState } from 'react'
import { usersApi } from '@/modules/tenant/users/api/users'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

export function AuthBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!hydrated) {
      return undefined
    }

    if (!accessToken) {
      setProfile(null)
      return undefined
    }

    if (profile) {
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
  }, [accessToken, hydrated, profile, setProfile])

  return null
}
