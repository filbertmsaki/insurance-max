import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
  UnderwriteAction,
  underwriteLineEntryPermissions,
  underwriteLineFromSlug,
  type UnderwriteLineSlug,
} from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwriteApi } from './api';
import { getUnderwriteLineMetaBySlug, type UnderwriteLineMeta } from './lines';

export const underwriteKeys = {
  all: ['underwrite'] as const,
  overview: () => [...underwriteKeys.all, 'overview'] as const,
  lineDashboard: (line: UnderwriteLineSlug) =>
    [...underwriteKeys.all, line, 'dashboard'] as const,
  quotations: (line: UnderwriteLineSlug) =>
    [...underwriteKeys.all, line, 'quotations'] as const,
  quotation: (line: UnderwriteLineSlug, id: string) =>
    [...underwriteKeys.all, line, 'quotation', id] as const,
  policies: (line: UnderwriteLineSlug) =>
    [...underwriteKeys.all, line, 'policies'] as const,
  policy: (line: UnderwriteLineSlug, id: string) =>
    [...underwriteKeys.all, line, 'policy', id] as const,
  transactions: (line: UnderwriteLineSlug, kind: string) =>
    [...underwriteKeys.all, line, kind] as const,
  tiraQueue: (line: UnderwriteLineSlug, kind: 'failed' | 'pending') =>
    [...underwriteKeys.all, line, 'tira', kind] as const,
};

/**
 * The line addressed by the current `/apps/underwrite/<line>/...` route. Static
 * routes such as `/apps/underwrite/fleet/policies/:id` have no `:line` param, so
 * fall back to the path segment.
 */
export function useUnderwriteLineParam(): UnderwriteLineMeta | null {
  const { line } = useParams<{ line: string }>();
  const { pathname } = useLocation();
  return getUnderwriteLineMetaBySlug(line ?? underwriteSlugFromPath(pathname));
}

export function underwriteSlugFromPath(pathname: string): string | undefined {
  return /^\/apps\/underwrite\/([^/]+)/.exec(pathname)?.[1];
}

export function useUnderwriteOverview() {
  const { user, authorizationContext, hasPermission } = useAuthStore();
  return useQuery({
    queryKey: [...underwriteKeys.overview(), { user, authorizationContext }],
    queryFn: underwriteApi.getOverview,
    enabled:
      user?.scope === 'company' &&
      hasPermission(UNDERWRITE_DASHBOARD_VIEW_PERMISSION),
    staleTime: 30_000,
  });
}

export function useUnderwriteLineDashboard(line: UnderwriteLineSlug) {
  const { user, authorizationContext, hasPermission } = useAuthStore();
  const resolvedLine = underwriteLineFromSlug(line);
  return useQuery({
    queryKey: [
      ...underwriteKeys.lineDashboard(line),
      { user, authorizationContext },
    ],
    queryFn: () => underwriteApi.getLineDashboard(line),
    enabled:
      user?.scope === 'company' &&
      !!resolvedLine &&
      underwriteLineEntryPermissions(resolvedLine, UnderwriteAction.VIEW).some(
        hasPermission,
      ),
    staleTime: 30_000,
  });
}

/**
 * Confirms a record belongs to the line (the backend answers 404 otherwise)
 * before a shared detail screen renders it.
 */
export function useUnderwriteRecordCheck(
  kind: 'quotation' | 'policy',
  line: UnderwriteLineSlug,
  id: string | undefined,
) {
  const quotation = useQuery({
    queryKey: underwriteKeys.quotation(line, id ?? ''),
    queryFn: () => underwriteApi.getQuotation(line, id!),
    enabled: kind === 'quotation' && !!id,
    retry: false,
    staleTime: 30_000,
  });
  const policy = useQuery({
    queryKey: underwriteKeys.policy(line, id ?? ''),
    queryFn: () => underwriteApi.getPolicy(line, id!),
    enabled: kind === 'policy' && !!id,
    retry: false,
    staleTime: 30_000,
  });

  const active = kind === 'quotation' ? quotation : policy;
  return {
    isLoading: active.isLoading,
    isError: active.isError,
    quotation: quotation.data,
    policy: policy.data,
  };
}
