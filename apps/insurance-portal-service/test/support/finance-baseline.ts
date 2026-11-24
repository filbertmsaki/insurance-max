import type { QueryRunner } from 'typeorm';
import { BaselineMigration1786736437722 } from '../../src/database/migrations/1786736437722-BaselineMigration';

/** Apply the generated baseline's ordered, parameter-free DDL in fewer round trips to the isolated server. */
export async function installFinanceBaseline(runner: QueryRunner) {
  const statements: string[] = [];
  const batch = Object.assign(Object.create(runner), {
    async query(sql: string, parameters?: unknown[]) {
      if (parameters?.length)
        throw new Error(
          'A parameterized baseline statement requires a separate execution.',
        );
      statements.push(sql);
      return [];
    },
  }) as QueryRunner;
  await new BaselineMigration1786736437722().up(batch);
  for (let i = 0; i < statements.length; i += 75)
    await runner.query(statements.slice(i, i + 75).join(';\n'));
}
