import { useState } from 'react';
import { WifiOff, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConnectivityStore } from '../store/connectivity.store';
import { retryConnectionNow } from '../lib/connectivity-monitor';

export function ConnectionLostOverlay() {
  const status = useConnectivityStore((state) => state.status);
  const [retrying, setRetrying] = useState(false);

  if (status !== 'offline') {
    return null;
  }

  const handleRetry = async () => {
    setRetrying(true);
    await retryConnectionNow();
    setRetrying(false);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-50 p-6"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <WifiOff className="h-8 w-8 text-red-600" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-slate-900">
          Connection Lost
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re unable to connect to the server right now. Please check
          your internet connection. The application will automatically reconnect
          when the connection is restored.
        </p>

        <Button className="mt-6" onClick={handleRetry} disabled={retrying}>
          <RotateCw className={retrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Retry Connection
        </Button>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          Checking connection automatically&hellip;
        </p>
      </div>
    </div>
  );
}
