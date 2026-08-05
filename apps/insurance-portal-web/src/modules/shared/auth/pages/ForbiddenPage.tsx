import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="text-6xl font-semibold">403</div>

        <h1 className="mt-4 text-2xl font-semibold">Access denied</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Your current role or company context does not permit this
          operation.
        </p>

        <Button asChild className="mt-6">
          <Link to="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
