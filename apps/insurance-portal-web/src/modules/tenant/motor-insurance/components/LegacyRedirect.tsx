import { Navigate, useLocation, useParams } from 'react-router-dom';

export type LegacyRedirectParams = Record<string, string | undefined>;

/** Redirects to `to(params)`, keeping the query string (e.g. ?type=). */
export function LegacyRedirect({
  to,
}: {
  to: (params: LegacyRedirectParams) => string;
}) {
  const params = useParams();
  const { search } = useLocation();
  const target = to(params);
  const joiner = target.includes('?') ? '&' : '?';
  return (
    <Navigate
      to={search ? `${target}${joiner}${search.slice(1)}` : target}
      replace
    />
  );
}
