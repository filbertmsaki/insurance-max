import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { PortalAccount } from '../entities/portal-account.entity';

export const CurrentPortalAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PortalAccount => {
    const request = context
      .switchToHttp()
      .getRequest<{ portalAccount: PortalAccount }>();

    return request.portalAccount;
  },
);
