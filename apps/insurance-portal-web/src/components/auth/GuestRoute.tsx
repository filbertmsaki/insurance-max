import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function GuestRoute() {
  const { user } = useAuthStore()
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return unsubscribe
  }, [])

  if (!hydrated) {
    return null
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
