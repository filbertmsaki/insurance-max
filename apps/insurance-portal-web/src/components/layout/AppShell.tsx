import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from './CommandPalette'
import { PageFooterProvider } from './PageFooterSlot'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const location = useLocation()

  // Close mobile sidebar on route change
  const [prevPathname, setPrevPathname] = useState(location.pathname)
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname)
    setMobileOpen(false)
  }

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <PageFooterProvider>
        {(footer) => (
          <div className="flex h-dvh overflow-hidden bg-slate-50">

            {/* ── Desktop sidebar (always in flow, width transitions) ── */}
            <div className="hidden md:flex shrink-0">
              <Sidebar
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
              />
            </div>

            {/* ── Mobile overlay ── */}
            <div
              className={cn(
                'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300',
                mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
              )}
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />

            {/* ── Mobile sidebar drawer ── */}
            <div
              className={cn(
                'fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ease-in-out',
                mobileOpen ? 'translate-x-0' : '-translate-x-full',
              )}
            >
              <Sidebar mobile onClose={() => setMobileOpen(false)} />
            </div>

            {/* ── Main content area ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header
                onMobileMenuToggle={() => setMobileOpen((o) => !o)}
                onOpenCommand={() => setCommandOpen(true)}
              />
              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
                  <Outlet />
                </div>
              </main>
              {footer && (
                // width matched to QuotationWizardPage's content column (the current sole consumer of usePageFooter)
                <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.25)] sm:px-6 lg:px-8">
                  <div className="mx-auto w-full max-w-[1380px]">{footer}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageFooterProvider>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </TooltipProvider>
  )
}
