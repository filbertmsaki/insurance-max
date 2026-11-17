import { useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import type { SetupOverview } from './api';
import { chartDraftIssue } from './chartDraftValidation';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
type Account = {
  code: string;
  name: string;
  type: AccountType | '';
  normalBalance: 'DR' | 'CR' | '';
  posting: boolean;
  control: boolean;
  parentCode: string | null;
};
type Role = {
  code: string;
  accountCode: string | null;
  accountType: AccountType | '';
  dimensionsText: string;
  dependenciesText: string;
};
const types: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
];
const cls = 'w-full rounded-md border border-slate-300 bg-white p-2 text-sm';
const reviewedChart = z.object({
  schema: z.literal('FINANCE_CHART_SNAPSHOT_V1'),
  proposal: z.object({
    schema: z.literal('FINANCE_CHART_V1'),
    chartCode: z.string().min(1),
    supportedProfiles: z.array(z.string()),
    accounts: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
        normalBalance: z.enum(['DR', 'CR']),
        posting: z.boolean(),
        control: z.boolean(),
        parentCode: z.string().nullable(),
      }),
    ),
    roles: z.array(
      z.object({
        code: z.string(),
        accountCode: z.string().nullable(),
        accountType: z.enum([
          'ASSET',
          'LIABILITY',
          'EQUITY',
          'INCOME',
          'EXPENSE',
        ]),
        requiredDimensions: z.array(z.string()),
        dependencyRefs: z.array(z.string()),
      }),
    ),
  }),
});

/** Prepares a scoped chart proposal; it never approves or activates it. */
export function ChartDraftEditor({
  overview,
  submit,
  loadPredecessor,
}: {
  overview: SetupOverview;
  submit: (input: unknown, reason: string) => void;
  loadPredecessor?: (
    row: SetupOverview['inventory']['configurations'][number],
  ) => Promise<{ payload: Record<string, unknown> }>;
}) {
  const [key, setKey] = useState('');
  const [chartCode, setChartCode] = useState('');
  const [version, setVersion] = useState('1');
  const [predecessor, setPredecessor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('');
  const [sourceReason, setSourceReason] = useState('');
  const [sourceChoices, setSourceChoices] = useState<
    Record<
      string,
      { state: 'HELD' | 'PROPOSED'; roleCode: string | null; reason: string }
    >
  >({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const predecessorSequence = useRef(0);
  const updateAccount = (index: number, change: Partial<Account>) =>
    setAccounts((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );
  const updateRole = (index: number, change: Partial<Role>) =>
    setRoles((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );
  async function loadReviewedChart() {
    const row = overview.inventory.configurations.find(
      (item) =>
        item.id === predecessor &&
        item.kind === 'ACCOUNT_ROLES' &&
        item.state === 'REVIEWED_INACTIVE',
    );
    if (!row || !loadPredecessor) return;
    const sequence = ++predecessorSequence.current;
    setLoading(true);
    setError('');
    try {
      const snapshot = reviewedChart.parse(
        (await loadPredecessor(row)).payload,
      );
      if (sequence !== predecessorSequence.current) return;
      if (
        !snapshot.proposal.supportedProfiles.includes(
          overview.inventory.book.business_profile,
        )
      )
        throw new Error('Profile mismatch');
      setChartCode(snapshot.proposal.chartCode);
      setAccounts(snapshot.proposal.accounts);
      setRoles(
        snapshot.proposal.roles.map(
          ({ requiredDimensions, dependencyRefs, ...role }) => ({
            ...role,
            dimensionsText: requiredDimensions.join(', '),
            dependenciesText: dependencyRefs.join(', '),
          }),
        ),
      );
      setSource('');
      setSourceChoices({});
      setSourceReason('');
    } catch {
      if (sequence === predecessorSequence.current)
        setError(
          'The reviewed chart could not be loaded for this book. Refresh and select a current version.',
        );
    } finally {
      if (sequence === predecessorSequence.current) setLoading(false);
    }
  }
  function prepare() {
    setError('');
    if (
      !key.trim() ||
      !chartCode.trim() ||
      !from ||
      !reason.trim() ||
      ((!source || !overview.inventory.accounts.length) &&
        !sourceReason.trim()) ||
      !Number.isSafeInteger(Number(version)) ||
      Number(version) < 1 ||
      !accounts.length ||
      !roles.length
    ) {
      setError(
        'Supply the chart identity, dates, reason, source treatment, at least one account and one role.',
      );
      return;
    }
    if (to && to <= from) {
      setError('The end date must be after the start date.');
      return;
    }
    if (
      accounts.some(
        (a) => !a.code.trim() || !a.name.trim() || !a.type || !a.normalBalance,
      ) ||
      roles.some(
        (r) => !r.code.trim() || !r.accountType || !r.dependenciesText.trim(),
      )
    ) {
      setError(
        'Every account and role requires an explicit code, type and account balance direction.',
      );
      return;
    }
    const issue = chartDraftIssue(accounts, roles);
    if (issue) {
      setError(issue);
      return;
    }
    if (
      source &&
      overview.inventory.accounts.some(
        (account) =>
          sourceChoices[account.id]?.state === 'PROPOSED' &&
          !sourceChoices[account.id]?.roleCode,
      )
    ) {
      setError('Select an assigned role for every proposed source mapping.');
      return;
    }
    if (
      source &&
      overview.inventory.accounts.some((account) => {
        const choice = sourceChoices[account.id];
        if (choice?.state !== 'PROPOSED') return false;
        const role = roles.find((value) => value.code === choice.roleCode);
        const target = accounts.find(
          (value) => value.code === role?.accountCode,
        );
        return (
          account.is_active !== true ||
          typeof account.is_control_account !== 'boolean' ||
          ['2100', '4200'].includes(account.account_code) ||
          !role?.accountCode ||
          role.accountType !== account.account_type ||
          !target ||
          target.control !== account.is_control_account
        );
      })
    ) {
      setError(
        'Proposed mappings require an active, non-quarantined source and an assigned same-type role with matching control status.',
      );
      return;
    }
    if (
      source &&
      overview.inventory.accounts.some(
        (account) => !sourceChoices[account.id]?.reason.trim(),
      )
    ) {
      setError('Record a reason for every source-account disposition.');
      return;
    }
    const legacy = source
      ? {
          mode: 'SCOPED_INVENTORY',
          sourceMapId: source,
          dispositions: overview.inventory.accounts.map((account) => ({
            sourceAccountId: account.id,
            state: sourceChoices[account.id]?.state ?? 'HELD',
            roleCode:
              sourceChoices[account.id]?.state === 'PROPOSED'
                ? sourceChoices[account.id].roleCode
                : null,
            reason: sourceChoices[account.id].reason.trim(),
          })),
          emptyInventoryReason: overview.inventory.accounts.length
            ? null
            : sourceReason.trim(),
        }
      : { mode: 'UNBOUND', reason: sourceReason.trim() };
    const split = (text: string) =>
      text
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    const dependencies = [
      ...new Set([
        'DEC-01',
        'DEC-06',
        'DEC-12',
        ...roles.flatMap((role) => split(role.dependenciesText)),
      ]),
    ];
    submit(
      {
        kind: 'ACCOUNT_ROLES',
        key: key.trim(),
        version: Number(version),
        supersedesId: predecessor || null,
        effectiveFrom: from,
        effectiveTo: to || null,
        dependencyRefs: dependencies,
        payload: {
          schema: 'FINANCE_CHART_V1',
          chartCode: chartCode.trim(),
          supportedProfiles: [overview.inventory.book.business_profile],
          accounts,
          roles: roles.map(({ dimensionsText, dependenciesText, ...role }) => ({
            ...role,
            requiredDimensions: split(dimensionsText),
            dependencyRefs: split(dependenciesText),
          })),
          legacy,
        },
      },
      reason.trim(),
    );
  }
  return (
    <details className="rounded-md border p-4">
      <summary className="cursor-pointer font-semibold">
        Prepare chart of accounts
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm">
          Creates an inactive, versioned proposal. Source mappings require
          independent review; this does not enable posting.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Supersede reviewed chart (optional)
            <select
              className={cls}
              value={predecessor}
              onChange={(event) => {
                const id = event.target.value;
                predecessorSequence.current++;
                setLoading(false);
                setPredecessor(id);
                const previous = overview.inventory.configurations.find(
                  (item) => item.id === id,
                );
                if (previous) {
                  setKey(previous.configuration_key);
                  setVersion(String(previous.version + 1));
                }
              }}
            >
              <option value="">No predecessor</option>
              {overview.inventory.configurations
                .filter(
                  (item) =>
                    item.kind === 'ACCOUNT_ROLES' &&
                    item.state === 'REVIEWED_INACTIVE',
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.configuration_key} / v{item.version}
                  </option>
                ))}
            </select>
          </label>
          {predecessor && loadPredecessor && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={loadReviewedChart}
            >
              {loading
                ? 'Loading reviewed chart…'
                : 'Load reviewed chart accounts and roles'}
            </Button>
          )}
          <label>
            Configuration key
            <input
              className={cls}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <label>
            Chart code
            <input
              className={cls}
              value={chartCode}
              onChange={(e) => setChartCode(e.target.value)}
            />
          </label>
          <label>
            Version
            <input
              className={cls}
              type="number"
              min="1"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
          <label>
            Effective from
            <input
              className={cls}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Effective until (exclusive)
            <input
              className={cls}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <fieldset className="space-y-3 rounded border p-3">
          <legend>Accounts</legend>
          {accounts.map((a, i) => (
            <div
              key={i}
              className="grid gap-2 rounded border p-3 sm:grid-cols-2"
            >
              <label>
                Account code
                <input
                  className={cls}
                  value={a.code}
                  onChange={(e) => updateAccount(i, { code: e.target.value })}
                />
              </label>
              <label>
                Account name
                <input
                  className={cls}
                  value={a.name}
                  onChange={(e) => updateAccount(i, { name: e.target.value })}
                />
              </label>
              <label>
                Account type
                <select
                  className={cls}
                  value={a.type}
                  onChange={(e) =>
                    updateAccount(i, { type: e.target.value as AccountType })
                  }
                >
                  <option value="">Choose…</option>
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Normal balance
                <select
                  className={cls}
                  value={a.normalBalance}
                  onChange={(e) =>
                    updateAccount(i, {
                      normalBalance: e.target.value as 'DR' | 'CR',
                    })
                  }
                >
                  <option value="">Choose…</option>
                  <option>DR</option>
                  <option>CR</option>
                </select>
              </label>
              <label>
                Parent account code
                <input
                  className={cls}
                  value={a.parentCode ?? ''}
                  onChange={(e) =>
                    updateAccount(i, { parentCode: e.target.value || null })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={a.posting}
                  onChange={(e) =>
                    updateAccount(i, {
                      posting: e.target.checked,
                      ...(e.target.checked ? {} : { control: false }),
                    })
                  }
                />{' '}
                Posting account
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={a.control}
                  disabled={!a.posting}
                  onChange={(e) =>
                    updateAccount(i, { control: e.target.checked })
                  }
                />{' '}
                Control account
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setAccounts((rows) => rows.filter((_, n) => n !== i))
                }
              >
                Remove account {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setAccounts((rows) => [
                ...rows,
                {
                  code: '',
                  name: '',
                  type: '',
                  normalBalance: '',
                  posting: false,
                  control: false,
                  parentCode: null,
                },
              ])
            }
          >
            Add account
          </Button>
        </fieldset>
        <fieldset className="space-y-3 rounded border p-3">
          <legend>Account roles</legend>
          {roles.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 rounded border p-3 sm:grid-cols-2"
            >
              <label>
                Role code
                <input
                  className={cls}
                  value={r.code}
                  onChange={(e) => updateRole(i, { code: e.target.value })}
                />
              </label>
              <label>
                Role type
                <select
                  className={cls}
                  value={r.accountType}
                  onChange={(e) =>
                    updateRole(i, {
                      accountType: e.target.value as AccountType,
                      accountCode: null,
                    })
                  }
                >
                  <option value="">Choose…</option>
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Assigned posting account
                <select
                  className={cls}
                  value={r.accountCode ?? ''}
                  onChange={(e) =>
                    updateRole(i, { accountCode: e.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {accounts
                    .filter(
                      (a) => a.posting && a.type === r.accountType && a.code,
                    )
                    .map((a, n) => (
                      <option key={n} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Required dimensions (comma separated)
                <input
                  className={cls}
                  value={r.dimensionsText}
                  onChange={(e) =>
                    updateRole(i, { dimensionsText: e.target.value })
                  }
                />
              </label>
              <label>
                Decision references (comma separated)
                <input
                  className={cls}
                  value={r.dependenciesText}
                  onChange={(e) =>
                    updateRole(i, { dependenciesText: e.target.value })
                  }
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setRoles((rows) => rows.filter((_, n) => n !== i))
                }
              >
                Remove role {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRoles((rows) => [
                ...rows,
                {
                  code: '',
                  accountCode: null,
                  accountType: '',
                  dimensionsText: '',
                  dependenciesText: '',
                },
              ])
            }
          >
            Add role
          </Button>
        </fieldset>
        <label>
          Source association
          <select
            className={cls}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setSourceChoices({});
            }}
          >
            <option value="">Unbound — source not supplied</option>
            {overview.inventory.sourceMaps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.source_system} / {map.legal_role} / v{map.mapping_version}
              </option>
            ))}
          </select>
        </label>
        {source &&
          overview.inventory.accounts.map((account) => {
            const choice = sourceChoices[account.id] ?? {
              state: 'HELD' as const,
              roleCode: null,
              reason: '',
            };
            return (
              <div
                className="grid gap-2 rounded border p-3 sm:grid-cols-2"
                key={account.id}
              >
                <p className="sm:col-span-2">
                  {account.account_code} — {account.account_name} (
                  {account.account_type})
                </p>
                <label>
                  Disposition for {account.account_code}
                  <select
                    className={cls}
                    value={choice.state}
                    onChange={(e) =>
                      setSourceChoices((current) => ({
                        ...current,
                        [account.id]: {
                          state: e.target.value as 'HELD' | 'PROPOSED',
                          roleCode: null,
                          reason: choice.reason,
                        },
                      }))
                    }
                  >
                    <option value="HELD">Held</option>
                    <option value="PROPOSED">Proposed mapping</option>
                  </select>
                </label>
                {choice.state === 'PROPOSED' && (
                  <label>
                    Target role for {account.account_code}
                    <select
                      className={cls}
                      value={choice.roleCode ?? ''}
                      onChange={(e) =>
                        setSourceChoices((current) => ({
                          ...current,
                          [account.id]: {
                            state: 'PROPOSED',
                            roleCode: e.target.value || null,
                            reason: choice.reason,
                          },
                        }))
                      }
                    >
                      <option value="">Select a role</option>
                      {roles
                        .filter(
                          (r) =>
                            r.accountCode &&
                            r.accountType === account.account_type,
                        )
                        .map((r, index) => (
                          <option key={index} value={r.code}>
                            {r.code} — {r.accountCode}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="sm:col-span-2">
                  Reason for {account.account_code}
                  <textarea
                    className={cls}
                    value={choice.reason}
                    onChange={(e) =>
                      setSourceChoices((current) => ({
                        ...current,
                        [account.id]: { ...choice, reason: e.target.value },
                      }))
                    }
                  />
                </label>
              </div>
            );
          })}
        {(!source || !overview.inventory.accounts.length) && (
          <label>
            {source
              ? 'Reason source inventory is empty'
              : 'Reason source is unbound'}
            <textarea
              className={cls}
              value={sourceReason}
              onChange={(e) => setSourceReason(e.target.value)}
            />
          </label>
        )}
        <label>
          Preparation reason
          <textarea
            className={cls}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <Button type="button" onClick={prepare}>
          Create inactive chart draft
        </Button>
      </div>
    </details>
  );
}
