import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { Button } from '@/components/ui/button';

import type { FoundationScope } from '../foundation/api';

export function FirstFinanceBook({
  identity,
  created,
  scope,
}: {
  identity: string[];
  created: () => void;
  scope?: FoundationScope;
}) {
  const staff = useQuery({
    queryKey: ['finance-setup', ...identity, 'onboarding-members'],
    queryFn: async () =>
      (
        await apiClient.get<{
          members: { id: string; firstName: string; lastName: string }[];
          currency: string;
        }>('/tenant/finance/setup/onboarding/members')
      ).data,
  });
  const [values, set] = useState({
    bookCode: scope ? '' : 'PRIMARY',
    businessProfile: scope?.business_profile ?? '',
    preparerUserId: '',
    authorityReference: '',
    validUntil: '',
    approvalRole: '',
    maximum: '',
  });
  const [checkers, setCheckers] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<
    { currency: string; maximum: string }[]
  >([]);
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) =>
      set({ ...values, [key]: e.target.value }),
    required: true,
  });
  const create = useMutation({
    mutationFn: async () => {
      const { maximum, ...body } = values;
      const appointment = {
        ...body,
        additionalCheckerUserIds: checkers.filter(
          (id) => id !== body.preparerUserId,
        ),
        limits: Object.fromEntries([
          [staff.data!.currency, maximum],
          ...currencies.map((c) => [c.currency, c.maximum]),
        ]),
      };
      if (scope)
        await apiClient.post('/tenant/finance/setup/books', {
          scope: { legalEntityId: scope.legalEntityId, bookId: scope.bookId },
          bookCode: body.bookCode,
          appointment,
        });
      else
        await apiClient.post('/tenant/finance/setup/onboarding', appointment);
    },
    onSuccess: created,
  });
  return (
    <form
      className="grid max-w-xl gap-3 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const codes = [
          staff.data?.currency,
          ...currencies.map((c) => c.currency),
        ];
        if (new Set(codes).size === codes.length) create.mutate();
      }}
    >
      <h2 className="font-semibold">
        {scope
          ? 'Set up another book for ' + scope.entity_code
          : 'Set up the first finance book'}
      </h2>
      <p>
        You will review and release this book. Select a different company member
        to prepare its configuration.
      </p>
      <label>
        {scope ? 'Code for the new book' : 'Book code'}{' '}
        <input {...field('bookCode')} maxLength={50} />
      </label>
      <label>
        Business profile{' '}
        <select disabled={!!scope} {...field('businessProfile')}>
          <option value="">Select a business profile</option>
          {['GENERAL_INSURER', 'INSURER', 'BROKER', 'REINSURER', 'OTHER'].map(
            (p) => (
              <option key={p} value={p}>
                {p.replace('_', ' ')}
              </option>
            ),
          )}
        </select>
      </label>
      <label>
        Finance preparer{' '}
        <select {...field('preparerUserId')}>
          <option value="">Select a member</option>
          {staff.data?.members.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Appointment reference{' '}
        <input {...field('authorityReference')} maxLength={200} />
      </label>
      <label>
        Appointment ends before <input type="date" {...field('validUntil')} />
      </label>
      <label>
        Journal approval role{' '}
        <input
          {...field('approvalRole')}
          placeholder="FINANCE_REVIEWER"
          pattern="[A-Z][A-Z0-9_.:-]*"
        />
      </label>
      <label>
        Journal approval limit ({staff.data?.currency}){' '}
        <input {...field('maximum')} inputMode="decimal" />
      </label>
      <fieldset className="space-y-2">
        <legend>Additional journal reviewers</legend>
        {staff.data?.members
          .filter((p) => p.id !== values.preparerUserId)
          .map((p) => (
            <label className="block" key={p.id}>
              <input
                type="checkbox"
                checked={checkers.includes(p.id)}
                onChange={(e) =>
                  setCheckers(
                    e.target.checked
                      ? [...checkers, p.id]
                      : checkers.filter((id) => id !== p.id),
                  )
                }
              />{' '}
              {p.firstName} {p.lastName}
            </label>
          ))}
      </fieldset>
      {currencies.map((c, i) => (
        <div className="flex gap-2" key={i}>
          <label>
            Currency{' '}
            <input
              required
              pattern="[A-Z]{3}"
              maxLength={3}
              value={c.currency}
              onChange={(e) =>
                setCurrencies(
                  currencies.map((v, n) =>
                    n === i
                      ? { ...v, currency: e.target.value.trim().toUpperCase() }
                      : v,
                  ),
                )
              }
            />
          </label>
          <label>
            Approval limit{' '}
            <input
              required
              inputMode="decimal"
              value={c.maximum}
              onChange={(e) =>
                setCurrencies(
                  currencies.map((v, n) =>
                    n === i ? { ...v, maximum: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrencies(currencies.filter((_, n) => n !== i))}
          >
            Remove currency
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setCurrencies([...currencies, { currency: '', maximum: '' }])
        }
      >
        Add currency limit
      </Button>
      {(create.isError || staff.isError) && (
        <p role="alert">
          {String(
            (create.error ?? staff.error) instanceof Error
              ? (create.error ?? staff.error)?.message
              : 'Check the selected member and appointment details.',
          )}
        </p>
      )}
      {new Set([staff.data?.currency, ...currencies.map((c) => c.currency)])
        .size <
        currencies.length + 1 && <p role="alert">Enter each currency once.</p>}
      <Button type="submit" disabled={!staff.data || create.isPending}>
        Create draft book and appoint reviewers
      </Button>
    </form>
  );
}
