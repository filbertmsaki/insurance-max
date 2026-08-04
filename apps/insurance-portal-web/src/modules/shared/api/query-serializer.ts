export type QueryPrimitive = string | number | boolean | Date;

export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;

export type QueryParameters = Record<string, QueryValue>;

function serializeValue(value: QueryPrimitive): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function serializeQueryParameters(parameters: unknown): string {
  if (!parameters || typeof parameters !== 'object') {
    return '';
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(parameters as QueryParameters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const arrayValue of value) {
        search.append(key, serializeValue(arrayValue));
      }

      continue;
    }

    search.set(key, serializeValue(value));
  }

  return search.toString();
}
