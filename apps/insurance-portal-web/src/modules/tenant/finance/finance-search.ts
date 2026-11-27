import { canSeeNavLeaf } from '@/components/layout/nav-config';
import type { AuthUser } from '@/types';
import { financeDestinations, financeDirectory } from './finance-navigation';

export function findFinanceLinks(
  user: AuthUser | null,
  query: string,
  includeDirectory = true,
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const links = includeDirectory
    ? [financeDirectory, ...financeDestinations]
    : financeDestinations;
  return links.filter((leaf) => {
    if (!canSeeNavLeaf(user, leaf)) return false;
    const search = [
      'Finance',
      leaf.subgroup,
      leaf.label,
      ...(leaf.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => search.includes(word));
  });
}
