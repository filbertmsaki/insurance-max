import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

type PortalAdminAccessToken = {
  sub?: string;
  email?: string;
  scope?: string;
  userType?: string;
  type?: string;
  jti?: string;
  sessionId?: string;
};

/** Accepts only short-lived administrator access tokens issued by the portal IDP. */
@Injectable()
export class TiramisAdministratorGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token)
      throw new UnauthorizedException('Administrator login is required');

    let payload: PortalAdminAccessToken;
    try {
      payload = await this.jwtService.verifyAsync<PortalAdminAccessToken>(
        token,
        {
          secret: this.config.getOrThrow<string>(
            'PORTAL_ADMIN_JWT_ACCESS_SECRET',
          ),
          issuer: this.config.get<string>(
            'PORTAL_ADMIN_JWT_ISSUER',
            'insurance-idp.tz',
          ),
          audience: this.config.get<string>(
            'PORTAL_ADMIN_JWT_AUDIENCE',
            'insurance-platform',
          ),
        },
      );
    } catch {
      throw new UnauthorizedException(
        'Administrator session is invalid or expired',
      );
    }

    if (
      payload.type !== 'access' ||
      payload.scope !== 'platform' ||
      !['SUPER_ADMIN', 'OWNER'].includes(payload.userType ?? '') ||
      !payload.sub ||
      !payload.jti ||
      !payload.sessionId
    ) {
      throw new UnauthorizedException(
        'Platform administrator access is required',
      );
    }
    Object.assign(request, {
      tiramisAdministrator: { id: payload.sub, email: payload.email },
    });
    return true;
  }
}
