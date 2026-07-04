import { QueryFailedError } from 'typeorm';

export function isDuplicateEntryError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = (
    error as QueryFailedError & {
      driverError?: { code?: string | number };
    }
  ).driverError;

  return (
    driverError?.code === '23505' ||
    driverError?.code === 'ER_DUP_ENTRY' ||
    String(driverError?.code ?? '') === '1062'
  );
}
