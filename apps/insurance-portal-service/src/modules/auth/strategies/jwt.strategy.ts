import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  AuthenticatedUser,
  PLATFORM_USER_TYPES,
} from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CompaniesService } from '../../companies/companies.service';
import { UsersService } from '../../users/users.service';
import { RedisService } from '../../redis/redis.service';
import { SessionsService } from '../../sessions/sessions.service';

type JwtAccessPayload = {
  sub: string;
  jti: string;
  email: string;
  scope?: 'platform' | 'company';
  userType?: string;
  companyId?: string;
  roles?: string[];
  permissions?: string[];
  sessionId?: string;
  type?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private readonly companiesService: CompaniesService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtAccessPayload,
  ): Promise<AuthenticatedUser> {
    if (
      payload.type !== 'access' ||
      !payload.sub ||
      !payload.email ||
      !payload.jti ||
      !payload.sessionId
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const isBlacklisted = await this.redisService.isBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const isSessionActive = await this.sessionsService.isSessionActive(
      payload.sessionId,
      payload.sub,
    );
    if (!isSessionActive) {
      throw new UnauthorizedException('Session has been revoked');
    }

    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('User account is no longer available');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is inactive');
    }

    if (payload.scope === 'platform') {
      if (!PLATFORM_USER_TYPES.includes(user.user_type)) {
        throw new UnauthorizedException('Invalid platform access token');
      }

      const permissions = new Set<string>();
      user.permissions?.forEach((p) => p?.name && permissions.add(p.name));
      user.roles?.forEach((role) =>
        role.permissions?.forEach((p) => p?.name && permissions.add(p.name)),
      );

      return {
        id: user.id,
        email: user.email,
        scope: 'platform',
        userType: user.user_type,
        roles: user.roles?.map((r) => r.name) ?? [],
        permissions: Array.from(permissions),
      };
    }

    if (payload.scope !== 'company' || !payload.companyId) {
      throw new UnauthorizedException('Invalid company access token');
    }

    try {
      const companyContext = await this.companiesService.getMembershipContext(
        payload.sub,
        payload.companyId,
      );

      return {
        id: payload.sub,
        email: payload.email,
        scope: 'company',
        userType: payload.userType as any,
        companyId: companyContext.companyId,
        companyName: companyContext.companyName,
        companySlug: companyContext.companySlug,
        companyMembershipId: companyContext.membershipId,
        roles: companyContext.roles,
        permissions: companyContext.permissions,
      };
    } catch {
      throw new UnauthorizedException('Company access is no longer available');
    }
  }
}
