import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SERVICE_ENDPOINT_KEY } from '../decorators/authorization.decorator';

@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isServiceEndpoint = this.reflector.getAllAndOverride<boolean>(
      SERVICE_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || isServiceEndpoint) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser,
    information: unknown,
  ): TUser {
    if (error || !user) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid authenticated session is required.',
        details: {
          reason: information instanceof Error ? information.message : null,
        },
      });
    }

    return user;
  }
}
