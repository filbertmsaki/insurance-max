import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { FinanceConfigurationService } from './finance-configuration.service';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
  isFinanceDate,
  type FinanceConfigurationActor,
  type FinanceConfigurationInput,
} from './finance-configuration.types';

describe('Exact configuration subject encoding', () => {
  it('sorts object keys while preserving array order and exact string whitespace', () => {
    expect(canonicalFinanceJson({ z: true, a: [1, ' x '] })).toBe(
      '{"a":[1," x "],"z":true}',
    );
    // SHA-256 oracle independently calculated over the literal canonical UTF-8.
    expect(financeConfigurationHash({ z: true, a: [1, ' x '] })).toBe(
      'dc304ab040316db057eca91ebc0487e7904540863409ccf7282a21a66dc543dd',
    );
    expect(financeConfigurationHash({ a: [1, ' x '], z: true })).toBe(
      financeConfigurationHash({ z: true, a: [1, ' x '] }),
    );
    expect(financeConfigurationHash({ a: ' x ' })).not.toBe(
      financeConfigurationHash({ a: 'x' }),
    );
    expect(financeConfigurationHash([1, 2])).not.toBe(
      financeConfigurationHash([2, 1]),
    );
  });

  it.each([
    undefined,
    NaN,
    Infinity,
    BigInt(1),
    () => 1,
    new Date('2026-01-01'),
    new Array(2),
    { value: undefined },
  ])('rejects values that JSON would lose or coerce (%s)', (value) => {
    expect(() => canonicalFinanceJson(value)).toThrow(BadRequestException);
  });

  it('rejects cycles and symbol keys', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalFinanceJson(cyclic)).toThrow(BadRequestException);
    expect(() => canonicalFinanceJson({ [Symbol('hidden')]: 'value' })).toThrow(
      BadRequestException,
    );
  });

  it('validates actual calendar dates rather than normalizing impossible dates', () => {
    expect(isFinanceDate('2028-02-29')).toBe(true);
    for (const date of [
      '2027-02-29',
      '2026-02-30',
      '2026-13-01',
      '0000-01-01',
      '2026-1-1',
      '2026-01-01T00:00:00Z',
    ])
      expect(isFinanceDate(date)).toBe(false);
  });
});

describe('Inactive configuration input and identity boundaries', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const actor: FinanceConfigurationActor = {
    tenantId: id,
    subjectId: id,
    naturalPersonId: id,
    kind: 'USER',
  };
  const scope = { legalEntityId: id, bookId: id };
  const input: FinanceConfigurationInput = {
    kind: 'DIMENSIONS',
    key: 'test',
    version: 1,
    effectiveFrom: '2026-01-01',
    payload: { schemaVersion: 1 },
    dependencyRefs: ['DEC-14'],
  };

  it.each([
    null,
    { companyId: id, userType: 'SUPER_ADMIN' },
    { ...actor, kind: 'WORKER' },
    { ...actor, naturalPersonId: '' },
  ])(
    'rejects unverified or nonhuman configuration identity before transactions (%j)',
    async (invalid) => {
      const transaction = jest.fn(),
        service = new FinanceConfigurationService({
          transaction,
        } as unknown as DataSource);
      await expect(
        service.createDraft(
          invalid as FinanceConfigurationActor,
          scope,
          input,
          'test',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    { version: 0 },
    { version: 1.5 },
    { version: 2147483648 },
    { effectiveFrom: '2026-02-30' },
    { effectiveTo: '2026-01-01' },
    { dependencyRefs: ['DEC-14', 'DEC-14'] },
    { dependencyRefs: [''] },
    { key: ' padded ' },
    { sourceMapIds: ['not-a-uuid'] },
  ])(
    'rejects invalid version, interval or dependency input before transactions (%j)',
    async (overrides) => {
      const transaction = jest.fn(),
        service = new FinanceConfigurationService({
          transaction,
        } as unknown as DataSource);
      await expect(
        service.createDraft(actor, scope, { ...input, ...overrides }, 'test'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
