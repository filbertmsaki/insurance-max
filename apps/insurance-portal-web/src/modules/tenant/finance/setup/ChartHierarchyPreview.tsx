import {
  chartDraftIssue,
  type ChartDraftAccount,
} from './chartDraftValidation';

type Account = ChartDraftAccount & { name: string };

/** Preview only: the reviewed backend snapshot remains the source of truth. */
export function ChartHierarchyPreview({ accounts }: { accounts: Account[] }) {
  if (!accounts.length) return null;
  if (chartDraftIssue(accounts, []))
    return (
      <p className="text-sm text-slate-600">
        Complete account codes and parent relationships to preview the
        hierarchy.
      </p>
    );
  const children = new Map<string | null, Account[]>();
  for (const account of accounts) {
    const group = children.get(account.parentCode) ?? [];
    group.push(account);
    children.set(account.parentCode, group);
  }
  for (const group of children.values())
    group.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    );
  const stack = [...(children.get(null) ?? [])]
    .reverse()
    .map((account) => ({ account, depth: 0 }));
  const ordered: { account: Account; depth: number }[] = [];
  while (stack.length) {
    const item = stack.pop()!;
    ordered.push(item);
    for (const child of [...(children.get(item.account.code) ?? [])].reverse())
      stack.push({ account: child, depth: item.depth + 1 });
  }
  return (
    <section
      className="space-y-2 rounded-md border p-4"
      aria-label="Draft account hierarchy"
    >
      <h3 className="font-semibold">Account hierarchy preview</h3>
      <p className="text-sm">This is the current draft, not an active chart.</p>
      <ul className="max-h-64 overflow-y-auto text-sm">
        {ordered.map(({ account, depth }) => (
          <li
            key={account.code}
            style={{ paddingInlineStart: `${Math.min(depth, 8) * 1.25}rem` }}
            className="border-t py-1"
          >
            <span className="font-medium">
              {account.code} — {account.name || 'Unnamed account'}
            </span>
            <span className="text-slate-600">
              {' '}
              · {account.type || 'Type not chosen'} ·{' '}
              {account.posting ? 'Posting' : 'Heading'}
              {account.control ? ' · Control' : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
