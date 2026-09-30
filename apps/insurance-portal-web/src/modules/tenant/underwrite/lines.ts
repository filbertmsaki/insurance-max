import type { ComponentType } from 'react';
import { CarFront, Layers, Truck } from 'lucide-react';
import {
  UNDERWRITE_LINES,
  underwriteLineFromSlug,
  underwritePermission,
  type UnderwriteActionValue,
  type UnderwriteLine,
  type UnderwriteLineDefinition,
} from '@insurance-max/contracts';

export interface UnderwriteLineMeta extends UnderwriteLineDefinition {
  icon: ComponentType<{ className?: string }>;
  description: string;
  /** Whether the line's own quotation wizard is available yet. */
  hasWizard: boolean;
}

const LINE_PRESENTATION: Record<
  UnderwriteLine,
  Pick<UnderwriteLineMeta, 'icon' | 'description' | 'hasWizard'>
> = {
  MOTOR: {
    icon: CarFront,
    description: 'Single-vehicle motor cover notes and policies',
    hasWizard: true,
  },
  FLEET: {
    icon: Truck,
    description: 'Multi-vehicle fleet cover under one quotation and policy',
    hasWizard: true,
  },
  NON_MOTOR: {
    icon: Layers,
    description: 'Fire, marine, engineering, accident, liability and more',
    hasWizard: true,
  },
};

export const UNDERWRITE_LINE_META: readonly UnderwriteLineMeta[] =
  UNDERWRITE_LINES.map((definition) => ({
    ...definition,
    ...LINE_PRESENTATION[definition.line],
  }));

export function getUnderwriteLineMeta(
  line: UnderwriteLine,
): UnderwriteLineMeta {
  return UNDERWRITE_LINE_META.find((item) => item.line === line)!;
}

export function getUnderwriteLineMetaBySlug(
  slug: string | undefined,
): UnderwriteLineMeta | null {
  const line = underwriteLineFromSlug(slug ?? '');
  return line ? getUnderwriteLineMeta(line) : null;
}

/**
 * Permissions a route needs: the line gate plus the existing action
 * permission. The backend enforces the same pair.
 */
export function underwriteRoutePermissions(
  line: UnderwriteLine,
  action: UnderwriteActionValue,
  legacyPermission?: string,
): string[] {
  const gate = underwritePermission(line, action);
  return legacyPermission ? [gate, legacyPermission] : [gate];
}
