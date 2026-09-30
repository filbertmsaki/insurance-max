import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { claimErrorLines } from '../utils';

/**
 * Shows a failed claim request with every line the API returned, e.g. the
 * TIRAMIS field rules a notification broke, instead of only the headline.
 */
export function ClaimErrorAlert({
  error,
  title,
}: {
  error: unknown;
  title?: string;
}) {
  if (!error) return null;
  const { message, lines } = claimErrorLines(error);

  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title ?? message}</AlertTitle>
      <AlertDescription>
        {title ? <p>{message}</p> : null}
        {lines.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
