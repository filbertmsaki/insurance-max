import { useNavigate } from 'react-router-dom';
import { FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ContentStates';
import { SectionCard } from '@/components/shared/DetailSections';
import { UnderwriteLineStats } from '../components/UnderwriteLineStats';
import { useUnderwriteLineDashboard, useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';

function LineDashboard({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useUnderwriteLineDashboard(
    line.slug,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Underwrite"
        title={`${line.label} dashboard`}
        description={line.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(underwritePaths.quotations(line.slug))}
            >
              <FileText className="mr-2 h-4 w-4" />
              Quotations
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(underwritePaths.policies(line.slug))}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Policies
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-5">
          <UnderwriteLineStats
            slug={line.slug}
            summary={data}
            loading={isLoading}
          />
          {data?.by_class && data.by_class.length > 0 && (
            <SectionCard
              title="Policies by insurance class"
              description="Across the policies you can access."
            >
              <ul className="divide-y rounded-lg border">
                {data.by_class.map((item) => {
                  const share = data.policies?.total
                    ? Math.round((item.policies / data.policies.total) * 100)
                    : 0;
                  return (
                    <li
                      key={item.category_id ?? 'unclassified'}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-slate-900">
                        {item.category_name}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {item.policies} ({item.active} active)
                      </span>
                      <div
                        className="col-span-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

export function UnderwriteLineDashboardPage() {
  const line = useUnderwriteLineParam();
  // UnderwriteLineRoute has already rejected unknown lines.
  return line ? <LineDashboard key={line.slug} line={line} /> : null;
}
