import { createContext, useContext, type ReactNode } from 'react';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { underwritePaths } from '../paths';

/**
 * Where the quotation wizard sends the user (list, detail, edit). Defaults to
 * the line's Underwrite routes; the unified Motor Insurance module provides
 * its own so the user stays inside it.
 */
export interface WizardNavigation {
  quotations: (line: UnderwriteLineSlug) => string;
  quotationDetail: (line: UnderwriteLineSlug, id: string) => string;
  quotationEdit: (line: UnderwriteLineSlug, id: string) => string;
  /** Label for "Back to …" links; defaults to "<line> quotations". */
  backLabel?: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- default value co-located with its provider
export const defaultWizardNavigation: WizardNavigation = {
  quotations: (line) => underwritePaths.quotations(line),
  quotationDetail: (line, id) => underwritePaths.quotationDetail(line, id),
  quotationEdit: (line, id) => underwritePaths.quotationEdit(line, id),
};

const WizardNavigationContext = createContext<WizardNavigation>(
  defaultWizardNavigation,
);

export function WizardNavigationProvider({
  value,
  children,
}: {
  value: WizardNavigation;
  children: ReactNode;
}) {
  return (
    <WizardNavigationContext.Provider value={value}>
      {children}
    </WizardNavigationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useWizardNavigation(): WizardNavigation {
  return useContext(WizardNavigationContext);
}
