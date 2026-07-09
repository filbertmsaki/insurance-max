import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const PageFooterContext = createContext<((node: ReactNode) => void) | null>(null)

export function PageFooterProvider({
  children,
  onFooterChange,
}: {
  children: (footer: ReactNode) => ReactNode
  onFooterChange?: never
}) {
  const [footer, setFooter] = useState<ReactNode>(null)
  return (
    <PageFooterContext.Provider value={setFooter}>
      {children(footer)}
    </PageFooterContext.Provider>
  )
}

/**
 * Lets a routed page (e.g. the quotation wizard) render its bottom action bar
 * as a shrink-0 sibling of AppShell's scrollable <main>, instead of inside
 * main's own scroll flow — so the bar can never end up covering the sidebar
 * or leaving trailing scroll-padding beneath it. Pages that don't call this
 * leave the slot empty and AppShell renders no extra footer element at all.
 */
export function usePageFooter(node: ReactNode) {
  const setFooter = useContext(PageFooterContext)
  useEffect(() => {
    setFooter?.(node)
    return () => setFooter?.(null)
  }, [setFooter, node])
}
