import { financeHref } from '@/modules/tenant/finance/finance-navigation';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { NavLeaf } from '@/components/layout/nav-config';
import { findFinanceLinks } from './finance-search';

function TaskLinks({ items }: { items: NavLeaf[] }) {
  const { pathname, search } = useLocation();
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.to}>
          <Link
            className="block rounded px-2 py-1.5 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-primary"
            to={financeHref(item.to, pathname, search)}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FinanceDirectoryPage() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const sections = new Map<string, NavLeaf[]>();
  for (const item of findFinanceLinks(user, query, false)) {
    const group = item.subgroup || 'Overview and self-service';
    sections.set(group, [...(sections.get(group) ?? []), item]);
  }
  return (
    <section className="space-y-5">
      <PageHeader
        title="Finance directory"
        description="Find a finance workspace, report or task."
      />
      <div className="relative max-w-lg">
        <Search
          className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
          aria-hidden
        />
        <Input
          type="search"
          className="pl-9"
          aria-label="Find a finance task"
          placeholder="Search tasks, for example trial balance"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {sections.size === 0 && (
        <div role="status">
          <p>No finance tasks match your search.</p>
          <Button variant="link" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </div>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from(sections, ([group, items]) => {
          const main = items.filter((item) => !item.directoryOnly);
          const more = items.filter((item) => item.directoryOnly);
          return (
            <section key={group} className="rounded-lg border bg-white p-4">
              <h2 className="mb-2 font-semibold">{group}</h2>
              {query.trim() || !main.length ? (
                <TaskLinks items={items} />
              ) : (
                <>
                  <TaskLinks items={main} />
                  {more.length > 0 && (
                    <details className="mt-2 border-t pt-2">
                      <summary className="cursor-pointer rounded px-2 py-2 text-sm font-medium">
                        More tasks ({more.length})
                      </summary>
                      <TaskLinks items={more} />
                    </details>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
