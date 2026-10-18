import type { QueryRunner } from 'typeorm';
import { WizardRecordSearch1794600000000 } from './migrations/1794600000000-WizardRecordSearch';

describe('WizardRecordSearch extension prerequisite', () => {
  it('fails before backfills or indexes with an actionable administrator instruction', async () => {
    const query = jest.fn().mockResolvedValue([{ installed: false }]);
    await expect(
      new WizardRecordSearch1794600000000().up({
        query,
      } as unknown as QueryRunner),
    ).rejects.toThrow(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;',
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('pg_extension');
  });

  it('runs backfills and all search indexes without attempting extension installation', async () => {
    const query = jest.fn(async (sql: string) => {
      if (/CREATE EXTENSION/i.test(sql))
        throw new Error('permission denied to create extension');
      return sql.includes('pg_extension') ? [{ installed: true }] : [];
    });
    await new WizardRecordSearch1794600000000().up({
      query,
    } as unknown as QueryRunner);
    expect(
      query.mock.calls.filter(([sql]) => /UPDATE "motor_vehicles"/.test(sql)),
    ).toHaveLength(2);
    expect(
      query.mock.calls.filter(([sql]) =>
        /CREATE INDEX IF NOT EXISTS/.test(sql),
      ),
    ).toHaveLength(3);
  });

  it('propagates actual index errors instead of silently omitting search indexes', async () => {
    const failure = new Error('index creation failed');
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('CREATE INDEX')) throw failure;
      return sql.includes('pg_extension') ? [{ installed: true }] : [];
    });
    await expect(
      new WizardRecordSearch1794600000000().up({
        query,
      } as unknown as QueryRunner),
    ).rejects.toBe(failure);
  });
});
