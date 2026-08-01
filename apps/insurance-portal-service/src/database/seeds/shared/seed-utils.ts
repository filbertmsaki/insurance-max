import { environment } from '@insurance-max/shared-config';
import { DataSource, QueryRunner } from 'typeorm';

export async function withSeedTransaction<T>(
  dataSource: DataSource,
  lockName: string,
  handler: (queryRunner: QueryRunner) => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      lockName,
    ]);

    const result = await handler(queryRunner);

    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function requireColumns(
  queryRunner: QueryRunner,
  tableName: string,
  columns: string[],
): Promise<void> {
  const rows = await queryRunner.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName],
  );

  const existingColumns = new Set(
    rows.map((row: { column_name: string }) => row.column_name),
  );
  const missingColumns = columns.filter(
    (column) => !existingColumns.has(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `[seed-validation] Table "${tableName}" is missing columns: ${missingColumns.join(', ')}`,
    );
  }
}

export function mustEnv(name: string): string {
  const value = environment[name];

  if (!value?.trim()) {
    throw new Error(
      `[seed-env] Missing required environment variable: ${name}`,
    );
  }

  return value.trim();
}

export function slugify(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
