import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { API_BASE_URL, API_WITH_CREDENTIALS } from '@/modules/shared/config';

export type NotificationStreamEvent = {
  type?: string;
  targetRecordType?: string | null;
  targetRecordId?: string | null;
  payload?: Record<string, unknown>;
};

type ParsedSseMessage = {
  event: string;
  data: string;
  id?: string;
};

function parseSseMessage(rawMessage: string): ParsedSseMessage | null {
  const lines = rawMessage.split('\n');
  const data: string[] = [];
  let event = 'message';
  let id: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const value =
      separatorIndex >= 0
        ? line.slice(separatorIndex + 1).replace(/^ /, '')
        : '';

    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'data') {
      data.push(value);
    } else if (field === 'id') {
      id = value;
    }
  }

  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join('\n'),
    id,
  };
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: NotificationStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex >= 0) {
      const rawMessage = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const parsed = parseSseMessage(rawMessage);
      if (!parsed) {
        boundaryIndex = buffer.indexOf('\n\n');
        continue;
      }

      try {
        const event = JSON.parse(parsed.data) as NotificationStreamEvent;
        onEvent({ ...event, type: event.type || parsed.event });
      } catch {
        // Ignore malformed stream frames; the connection itself can continue.
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }
  }
}

/**
 * Subscribes to the portal notification SSE stream while `enabled`,
 * reconnecting after drops. `onEvent` may change between renders.
 */
export function useNotificationStream(
  enabled: boolean,
  onEvent: (event: NotificationStreamEvent) => void,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !accessToken) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const waitBeforeReconnect = () =>
      new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, 3000);
      });

    const connect = async () => {
      while (!cancelled) {
        try {
          const response = await fetch(`${API_BASE_URL}/notifications/stream`, {
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: API_WITH_CREDENTIALS ? 'include' : 'same-origin',
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error('Notification stream failed to open');
          }

          await readSseStream(response.body, (event) =>
            onEventRef.current(event),
          );
        } catch {
          if (cancelled || controller.signal.aborted) {
            return;
          }
        }

        if (!cancelled) {
          await waitBeforeReconnect();
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller.abort();

      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [accessToken, enabled]);
}
