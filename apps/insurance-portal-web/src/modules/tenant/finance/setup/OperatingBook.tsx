import { useState } from 'react';
import { FIN01_MODULES } from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { setupApi, type SetupOverview } from './api';
import type { FoundationScope } from '../foundation/api';

export function OperatingBook({
  overview,
  scope,
  selectedControl,
  showAll,
  canRelease,
  busy,
  run,
  openStep,
}: {
  selectedControl?: string | null;
  showAll?: () => void;
  overview: SetupOverview;
  scope: FoundationScope;
  canRelease: boolean;
  busy: boolean;
  run: (work: () => Promise<unknown>) => void;
  openStep: (id: string) => void;
}) {
  const [releaseId, setRelease] = useState(''),
    [reason, setReason] = useState('');
  const operating = overview.operating,
    active = operating?.activation,
    releases = operating?.approvedReleases ?? [];
  const release = releases.find((r) => r.id === releaseId),
    final = overview.steps.find((s) => s.id === 'G04-10')?.latest;
  const selected = FIN01_MODULES.find(([code]) => code === selectedControl);
  const modules = selected ? [selected] : FIN01_MODULES;
  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="font-semibold">
        Finance readiness for {overview.inventory.book.book_code}
      </h2>
      <p role="status">
        {active
          ? (active.current ? 'Active ' : 'On hold ') +
            active.bookRole.toLowerCase() +
            ' book · ' +
            active.startsOn +
            ' through ' +
            active.endsBefore +
            ' (exclusive)'
          : 'Awaiting book activation'}
      </p>
      {selected && (
        <Button variant="outline" type="button" onClick={showAll}>
          Show all setup controls
        </Button>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>Module</th>
            <th>Review</th>
            <th>Setup steps</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(([code, name, ...dependencies]) => {
            const steps = dependencies.map((id) =>
              overview.steps.find((s) => s.id === id),
            );
            const missing = steps.find((s) => !s?.complete);
            const releaseNeeded = [
              'FIN-01.03',
              'FIN-01.05',
              'FIN-01.15',
              'FIN-01.16',
            ].includes(code);
            return (
              <tr key={code} className="border-t">
                <th className="p-2">
                  {code} · {name}
                </th>
                <td>
                  {operating?.issues?.[code]?.join(' ') ??
                    (active?.current
                      ? 'Active'
                      : active
                        ? 'Reviewed'
                        : missing
                          ? (missing.issues[0] ?? 'Awaiting independent review')
                          : releaseNeeded && !releases.length
                            ? 'Awaiting the approved live ledger release'
                            : 'Reviewed')}
                </td>
                <td>
                  {dependencies.map((id) => (
                    <button
                      type="button"
                      key={id}
                      className="mr-2 underline"
                      onClick={() => openStep(id)}
                    >
                      {id}
                    </button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canRelease && operating && (
        <div className="grid max-w-xl gap-3">
          {!active && (
            <label>
              Approved live release
              <select
                className="block w-full rounded border p-2"
                value={releaseId}
                onChange={(e) => setRelease(e.target.value)}
              >
                <option value="">Select a release…</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    Version {r.version} · {r.startsOn} to {r.endsBefore}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Decision reason
            <textarea
              className="block w-full rounded border p-2"
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {active ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() =>
                run(() =>
                  setupApi.withdrawBook(scope, active.id, reason.trim()),
                )
              }
            >
              Withdraw book activation
            </Button>
          ) : (
            <Button
              disabled={
                busy ||
                !reason.trim() ||
                !release ||
                !final ||
                !overview.complete ||
                overview.completionMeaning === 'DEMONSTRATION_ONLY'
              }
              onClick={() => {
                if (release && final)
                  run(() =>
                    setupApi.activateBook(scope, final, release, reason.trim()),
                  );
              }}
            >
              Activate reviewed book
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
