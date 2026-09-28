import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { filter, interval, map, merge, Observable, of, Subject } from 'rxjs';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import type {
  PortalNotificationEvent,
  PublishPortalNotificationEvent,
} from './notification-event.interface';

@Injectable()
export class NotificationBusService {
  private readonly events$ = new Subject<PortalNotificationEvent>();

  publish(event: PublishPortalNotificationEvent): PortalNotificationEvent {
    const normalized: PortalNotificationEvent = {
      ...event,
      id: randomUUID(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    };

    this.events$.next(normalized);

    return normalized;
  }

  streamForUser(user: AuthenticatedUser): Observable<MessageEvent> {
    return merge(
      of({
        type: 'notification.ready',
        data: {
          type: 'notification.ready',
          occurredAt: new Date().toISOString(),
        },
      }),
      interval(25_000).pipe(
        map(() => ({
          type: 'notification.heartbeat',
          data: {
            type: 'notification.heartbeat',
            occurredAt: new Date().toISOString(),
          },
        })),
      ),
      this.events$.pipe(
        filter((event) => this.canReceive(user, event)),
        map((event) => ({
          id: event.id,
          type: event.type,
          data: event,
        })),
      ),
    );
  }

  private canReceive(
    user: AuthenticatedUser,
    event: PortalNotificationEvent,
  ): boolean {
    if (event.targetUserIds?.length) {
      return event.targetUserIds.includes(user.id);
    }

    if (!event.companyId) {
      return user.scope === 'platform';
    }

    if (user.scope === 'platform') {
      return true;
    }

    return user.companyId === event.companyId;
  }
}
