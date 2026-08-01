export type UrlQuery = Record<
  string,
  string | number | boolean | null | undefined
>;

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function trimSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function normalizeBaseUrl(value: string): string {
  return trimTrailingSlashes(value.trim());
}

export function buildUrl(
  baseUrl: string,
  ...parts: Array<string | number | null | undefined | UrlQuery>
): string {
  const query =
    parts.length > 0 && isQuery(parts[parts.length - 1])
      ? (parts.pop() as UrlQuery)
      : undefined;
  const path = parts
    .filter(
      (part): part is string | number => part !== null && part !== undefined,
    )
    .map((part) => trimSegment(String(part)))
    .filter(Boolean)
    .join('/');
  const url = path
    ? `${normalizeBaseUrl(baseUrl)}/${path}`
    : normalizeBaseUrl(baseUrl);

  if (!query) {
    return url;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      search.set(key, String(value));
    }
  }
  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function isQuery(value: unknown): value is UrlQuery {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
