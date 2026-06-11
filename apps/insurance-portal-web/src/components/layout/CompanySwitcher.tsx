import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authApi } from '@/modules/shared/auth/api/auth'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

export function CompanySwitcher() {
  const { user, company, companies, setSession } = useAuthStore()
  const queryClient = useQueryClient()

  const switchMutation = useMutation({
    mutationFn: authApi.switchCompany,
    onSuccess: (tokens) => {
      setSession(tokens)
      queryClient.clear()
      toast.success('Company switched')
    },
  })

  if (!companies || companies.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-48">
          <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-sm">{company?.name ?? user?.companyName ?? 'Select Company'}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.companyId}
            onClick={() => switchMutation.mutate(c.companyId)}
            className={c.companyId === (company?.id ?? user?.companyId) ? 'bg-slate-50 font-medium' : ''}
          >
            {c.companyName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
