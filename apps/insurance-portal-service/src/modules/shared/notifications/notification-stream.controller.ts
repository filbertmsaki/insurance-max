import { Controller, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';

import { RawResponse } from '@insurance-max/shared-kernel';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { NotificationBusService } from './notification-bus.service';

@Controller('notifications')
export class NotificationStreamController {
  constructor(private readonly notificationBus: NotificationBusService) {}

  @RawResponse()
  @Sse('stream')
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return this.notificationBus.streamForUser(user);
  }
}
