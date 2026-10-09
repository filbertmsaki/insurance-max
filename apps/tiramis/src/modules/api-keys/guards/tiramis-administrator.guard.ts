import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

type PortalAdminAccessToken = {
  sub?: string;
  email?: string;
  scope?: string;
  userType?: string;
  roles?: string[];
  permissions?: string[];
  type?: string;
  jti?: string;
  sessionId?: string;
  authorizationVersion?: number;
  mfaVerifiedAt?: string;
  twoFactorVerifiedAt?: string;
};

/** Accepts only short-lived administrator access tokens issued by the portal IDP. */
@Injectable()
export class TiramisAdministratorGuard implements CanActivate {
  private readonly logger = new Logger(TiramisAdministratorGuard.name);
  private readonly rateLimitBuckets = new Map<
    string,
    { count: number; resetsAt: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
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

    this.assertRequiredPermissions(payload);
    this.assertMfaFreshness(payload);
    this.assertAdminRateLimit(request, payload);
    await this.assertLivePortalSession(token, payload);

    Object.assign(request, {
      tiramisAdministrator: {
        id: payload.sub,
        email: payload.email,
        sessionId: payload.sessionId,
        accessTokenId: payload.jti,
        userType: payload.userType,
      },
    });
    return true;
  }

  private assertRequiredPermissions(payload: PortalAdminAccessToken): void {
    const required = this.csvConfig('PORTAL_ADMIN_REQUIRED_PERMISSIONS');
    if (!required.length) return;

    const permissions = new Set(payload.permissions ?? []);
    const missing = required.filter(
      (permission) => !permissions.has(permission),
    );
    if (missing.length) {
      throw new UnauthorizedException(
        'Administrator token is missing required TIRAMIS permissions',
      );
    }
  }

  private assertMfaFreshness(payload: PortalAdminAccessToken): void {
    const maxAgeMinutes = this.config.get<number>(
      'PORTAL_ADMIN_MFA_MAX_AGE_MINUTES',
      0,
    );
    if (!maxAgeMinutes) return;

    const verifiedAt =
      payload.mfaVerifiedAt ?? payload.twoFactorVerifiedAt ?? '';
    const parsed = Date.parse(verifiedAt);
    if (
      !Number.isFinite(parsed) ||
      Date.now() - parsed > maxAgeMinutes * 60 * 1000
    ) {
      throw new UnauthorizedException(
        'Fresh administrator MFA verification is required',
      );
    }
  }

  private async assertLivePortalSession(
    token: string,
    payload: PortalAdminAccessToken,
  ): Promise<void> {
    const enabled = this.config.get<boolean>(
      'PORTAL_ADMIN_SESSION_VALIDATION_ENABLED',
      false,
    );
    if (!enabled) return;

    const introspectionUrl = this.config.get<string>(
      'PORTAL_ADMIN_SESSION_INTROSPECTION_URL',
      '',
    );

    if (introspectionUrl) {
      await this.assertRemoteAuthorizationContext(
        token,
        payload,
        introspectionUrl,
      );
      return;
    }

    await this.assertLocalPortalSession(payload);
  }

  private assertAdminRateLimit(
    request: Request,
    payload: PortalAdminAccessToken,
  ): void {
    const maxRequests = this.config.get<number>(
      'PORTAL_ADMIN_RATE_LIMIT_MAX',
      60,
    );
    if (!maxRequests) return;

    const windowMs = this.config.get<number>(
      'PORTAL_ADMIN_RATE_LIMIT_WINDOW_MS',
      60_000,
    );
    const now = Date.now();
    const key = [
      payload.sub || 'unknown-admin',
      payload.sessionId || 'unknown-session',
      request.ip || 'unknown-ip',
    ].join(':');
    const current = this.rateLimitBuckets.get(key);
    const bucket =
      current && current.resetsAt > now
        ? current
        : { count: 0, resetsAt: now + Math.max(windowMs, 1000) };

    bucket.count += 1;
    this.rateLimitBuckets.set(key, bucket);
    this.pruneExpiredRateLimitBuckets(now);

    if (bucket.count > maxRequests) {
      throw new HttpException(
        'Too many administrator requests; retry after the rate limit window.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private pruneExpiredRateLimitBuckets(now: number): void {
    if (this.rateLimitBuckets.size < 1000) return;
    for (const [key, bucket] of this.rateLimitBuckets.entries()) {
      if (bucket.resetsAt <= now) {
        this.rateLimitBuckets.delete(key);
      }
    }
  }

  private async assertRemoteAuthorizationContext(
    token: string,
    payload: PortalAdminAccessToken,
    introspectionUrl: string,
  ): Promise<void> {
    try {
      const response = await fetch(introspectionUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new UnauthorizedException('Administrator session was revoked');
      }
      const context = (await response.json()) as {
        userId?: string;
        sessionId?: string;
        scope?: string;
        permissions?: string[];
        authorizationVersion?: number;
      };

      if (
        context.userId !== payload.sub ||
        context.sessionId !== payload.sessionId ||
        context.scope !== 'platform'
      ) {
        throw new UnauthorizedException(
          'Administrator session context changed',
        );
      }

      if (
        payload.authorizationVersion !== undefined &&
        context.authorizationVersion !== undefined &&
        payload.authorizationVersion !== context.authorizationVersion
      ) {
        throw new UnauthorizedException(
          'Administrator authorization context changed',
        );
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(
        `Administrator session introspection failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new UnauthorizedException(
        'Administrator session could not be verified',
      );
    }
  }

  private async assertLocalPortalSession(
    payload: PortalAdminAccessToken,
  ): Promise<void> {
    try {
      const [session] = await this.dataSource.query(
        `SELECT "id", "user_id", "revoked", "expires_at", "idle_expires_at", "absolute_expires_at", "compromised_at"
         FROM "user_sessions"
         WHERE "id" = $1 AND "user_id" = $2
         LIMIT 1`,
        [payload.sessionId, payload.sub],
      );
      if (!session || session.revoked || session.compromised_at) {
        throw new UnauthorizedException('Administrator session was revoked');
      }

      const expiries = [
        session.expires_at,
        session.idle_expires_at,
        session.absolute_expires_at,
      ]
        .filter(Boolean)
        .map((value: string | Date) => new Date(value).getTime());
      if (expiries.length && Math.min(...expiries) <= Date.now()) {
        throw new UnauthorizedException('Administrator session has expired');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(
        `Local administrator session validation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new UnauthorizedException(
        'Administrator session could not be verified',
      );
    }
  }

  private csvConfig(key: string): string[] {
    return this.config
      .get<string>(key, '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
}
