import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { PricingQuoteMetadata } from '../types/pricing';
import {
  formatPricingDate,
  isPricingQuoteExpired,
  isPricingQuoteStale,
} from '../utilities/pricing';
import { PricingErrorDisplay } from './PricingErrorDisplay';
import { PricingWarningDisplay } from './PricingWarningDisplay';

interface Props {
  minimumAmount?: number | string | null;
  isPending?: boolean;
  errorMessage?: string | null;
  metadata?: PricingQuoteMetadata | null;
  showQuoteMetadata?: boolean;
  compact?: boolean;
}

export function PricingStatusAlert({
  minimumAmount,
  isPending = false,
  errorMessage,
  metadata,
  showQuoteMetadata = true,
  compact = false,
}: Props) {
  const expired = isPricingQuoteExpired(metadata);
  const stale = isPricingQuoteStale(metadata);
  const hasValidationErrors = (metadata?.validation_errors?.length ?? 0) > 0;
  const hasValidationWarnings =
    (metadata?.validation_warnings?.length ?? 0) > 0;

  if (
    !minimumAmount &&
    !isPending &&
    !errorMessage &&
    !metadata &&
    !hasValidationErrors &&
    !hasValidationWarnings
  ) {
    return null;
  }

  const lines: string[] = [];
  if (minimumAmount !== null && minimumAmount !== undefined && minimumAmount !== '') {
    lines.push(`Minimum premium: ${Number(minimumAmount).toFixed(2)}`);
  }
  if (showQuoteMetadata && metadata?.pricing_quote_id) {
    lines.push(`Pricing quote: ${metadata.pricing_quote_id}`);
  }
  if (showQuoteMetadata && metadata?.expires_at) {
    const formattedExpiry = formatPricingDate(metadata.expires_at);
    if (formattedExpiry) {
      lines.push(`Expires: ${formattedExpiry}`);
    }
  }
  if (showQuoteMetadata && metadata?.exchange_rate_snapshot) {
    const snapshot = metadata.exchange_rate_snapshot;
    lines.push(
      `Exchange: ${snapshot.quotation_currency_code} -> ${snapshot.base_currency_code} @ ${snapshot.exchange_rate}`,
    );
    lines.push(
      `Rate date: ${snapshot.exchange_rate_date} (${snapshot.exchange_rate_source.toLowerCase()})`,
    );
  }

  const variant = errorMessage || hasValidationErrors || expired || stale
    ? 'destructive'
    : hasValidationWarnings || metadata?.minimum_applied
      ? 'warning'
      : 'success';

  return (
    <Alert variant={variant} className={compact ? 'p-3 [&>svg]:top-3' : undefined}>
      {isPending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : errorMessage || hasValidationErrors || expired || stale ? (
        <AlertTriangle className="h-4 w-4" />
      ) : metadata ? (
        expired ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Clock3 className="h-4 w-4" />
      )}
      <AlertTitle>
        {isPending
          ? 'Pricing in progress'
          : expired
            ? 'Pricing has expired'
            : stale
              ? 'Pricing is stale'
              : errorMessage || hasValidationErrors
              ? 'Pricing needs attention'
              : metadata?.minimum_applied
                ? 'Minimum premium applied'
                : 'Pricing available'}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        {isPending ? <p>Calculating premium...</p> : null}
        {errorMessage ? <p>{errorMessage}</p> : null}
        {expired ? (
          <p>The stored pricing quote has expired. Recalculate before continuing.</p>
        ) : null}
        {stale ? (
          <p>
            {metadata?.stale_reason ??
              'Risk data changed after the last calculation. Recalculate before continuing.'}
          </p>
        ) : null}
        {lines.length > 0 ? (
          <div className="space-y-0.5 text-xs text-current/90">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        <PricingErrorDisplay errors={metadata?.validation_errors ?? []} />
        <PricingWarningDisplay warnings={metadata?.validation_warnings ?? []} />
      </AlertDescription>
    </Alert>
  );
}
