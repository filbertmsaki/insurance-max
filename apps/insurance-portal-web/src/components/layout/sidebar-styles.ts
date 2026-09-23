import { cn } from '@/lib/utils';

// Shared link styling so the portal shell can reuse the exact same look.
export function sidebarLinkClass(isActive: boolean) {
  return cn(
    'group flex items-center gap-3 px-5 py-2.5 text-[14px] font-medium transition-colors duration-150 outline-none',
    'focus-visible:bg-white/10',
    isActive ? 'text-white' : 'text-vz-sidebar-item hover:text-white',
  );
}
