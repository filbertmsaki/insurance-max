import { useContext, type ReactNode } from 'react';
import { WizardSectionTitleContext } from './WizardSectionTitleContext';

export function WizardSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const visible = useContext(WizardSectionTitleContext);
  return <h3 className={visible ? className : 'sr-only'}>{children}</h3>;
}
