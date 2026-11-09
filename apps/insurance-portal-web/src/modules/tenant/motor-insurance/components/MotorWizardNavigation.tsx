import type { ReactNode } from 'react';
import {
  WizardNavigationProvider,
  type WizardNavigation,
} from '@/modules/tenant/underwrite/wizard/wizardNavigation';
import { motorInsurancePaths } from '../paths';

const NAVIGATION: WizardNavigation = {
  quotations: () => motorInsurancePaths.quotations,
  quotationDetail: (_line, id) => motorInsurancePaths.quotationDetail(id),
  quotationEdit: (_line, id) => motorInsurancePaths.quotationEdit(id),
  backLabel: 'Back to motor quotations',
};

/** Keeps the existing wizards inside the Motor Insurance module. */
export function MotorWizardNavigation({
  children,
  headerBadge,
}: {
  children: ReactNode;
  headerBadge?: ReactNode;
}) {
  return (
    <WizardNavigationProvider
      value={headerBadge ? { ...NAVIGATION, headerBadge } : NAVIGATION}
    >
      {children}
    </WizardNavigationProvider>
  );
}
