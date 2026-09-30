import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/DetailSections';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { UnderwriteLineStats } from '../components/UnderwriteLineStats';
import { useUnderwriteOverview } from '../hooks';
import { getUnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';

export function UnderwriteDashboardPage() {
  const { data, isLoading, error, refetch } = useUnderwriteOverview();

  return (
    <div>
      <PageHeader
        title="Underwrite"
        description="Motor, Fleet and Non-Motor underwriting at a glance"
      />

      {error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <UnderwriteLineStats slug="motor" summary={undefined} loading />
      ) : !data?.length ? (
        <EmptyState
          title="No underwriting lines available"
          description="Ask an administrator to grant access to Motor, Fleet or Non-Motor."
        />
      ) : (
        <div className="space-y-5">
          {data.map((summary) => {
            const meta = getUnderwriteLineMeta(summary.line);
            return (
              <SectionCard
                key={summary.line}
                title={meta.label}
                description={meta.description}
                action={
                  <Link
                    to={underwritePaths.lineDashboard(meta.slug)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open {meta.label}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                }
              >
                <UnderwriteLineStats slug={meta.slug} summary={summary} />
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
