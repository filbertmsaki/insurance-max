/**
 * Rows from a raw `query()` that may be an UPDATE/DELETE ... RETURNING.
 *
 * TypeORM's Postgres driver returns plain rows for SELECT and INSERT, but
 * `[rows, rowCount]` for UPDATE and DELETE (including CTEs whose final
 * statement is UPDATE/DELETE). Treating that pair as rows silently yields
 * `[]` or `undefined` ids, so always read RETURNING rows through this.
 */
export function returningRows<T>(result: unknown): T[] {
  if (
    Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as T[];
  }

  return Array.isArray(result) ? (result as T[]) : [];
}
