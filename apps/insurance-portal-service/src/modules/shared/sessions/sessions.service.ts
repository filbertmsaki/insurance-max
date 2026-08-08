import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, LessThan, MoreThan, Repository } from 'typeorm';

import { randomUUID } from 'node:crypto';

import {
  AuthenticationStrength,
  SecurityRiskLevel,
} from '@insurance-max/contracts';

import { UserSession } from './entities/user-session.entity';
import { SessionResponseDto } from './dto/session-response.dto';

import { RedisService } from '../redis/redis.service';

import {
  hashToken,
  verifyToken,
} from '@insurance-max/portal-shared/utils/hash.util';

interface CreateSessionOptions {
  userId: string;
  refreshToken?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
  familyId?: string;
  authenticationStrength?: AuthenticationStrength;
  twoFactorVerifiedAt?: Date | null;
  riskLevel?: SecurityRiskLevel;
}

interface RotateRefreshTokenOptions {
  sessionId: string;
  userId: string;
  oldRefreshToken: string;
  newRefreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionsService {
  private readonly refreshTtlDays: number;
  private readonly idleMinutes: number;
  private readonly absoluteHours: number;
  private readonly reuseDetectionEnabled: boolean;

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepo: Repository<UserSession>,

    private readonly dataSource: DataSource,

    private readonly redisService: RedisService,

    private readonly configService: ConfigService,
  ) {
    const expiration = configService.get<string>('jwt.refreshExpiration', '7d');

    this.refreshTtlDays = Number.parseInt(expiration, 10) || 7;
    this.idleMinutes =
      configService.get<number>('SESSION_IDLE_MINUTES') ??
      configService.get<number>('PORTAL_SESSION_IDLE_MINUTES') ??
      30;
    this.absoluteHours =
      configService.get<number>('SESSION_ABSOLUTE_HOURS') ??
      this.refreshTtlDays * 24;
    this.reuseDetectionEnabled =
      configService.get<boolean>('SESSION_REFRESH_REUSE_DETECTION') ?? true;
  }

  async create(options: CreateSessionOptions): Promise<UserSession> {
    const rawToken = options.refreshToken ?? randomUUID();

    const tokenHash = await hashToken(rawToken);
    const now = new Date();
    const absoluteExpiry = this.newAbsoluteExpiry(now);
    const idleExpiry = this.newIdleExpiry(now);

    const session = this.sessionRepo.create({
      user_id: options.userId,
      refresh_token_hash: tokenHash,
      device_id: options.deviceId ?? null,
      family_id: options.familyId ?? randomUUID(),
      ip_address: options.ipAddress ?? null,
      user_agent: options.userAgent ?? null,
      device_info: options.deviceInfo ?? null,
      expires_at: this.effectiveExpiry(absoluteExpiry, idleExpiry),
      absolute_expires_at: absoluteExpiry,
      idle_expires_at: idleExpiry,
      authentication_strength:
        options.authenticationStrength ?? AuthenticationStrength.PASSWORD,
      two_factor_verified_at: options.twoFactorVerifiedAt ?? null,
      last_used_at: now,
      last_activity_at: now,
      last_ip_address: options.ipAddress ?? null,
      risk_level: options.riskLevel ?? SecurityRiskLevel.LOW,
      compromised_at: null,
      previous_refresh_token_hash: null,
      previous_refresh_rotated_at: null,
      security_events: [
        this.securityEvent('session.created', {
          ipAddress: options.ipAddress ?? null,
          authenticationStrength:
            options.authenticationStrength ?? AuthenticationStrength.PASSWORD,
        }),
      ],
      revoked: false,
      revoked_at: null,
      revocation_reason: null,
    });

    const saved = await this.sessionRepo.save(session);

    await this.cacheSession(saved);

    return saved;
  }

  async bindRefreshToken(
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = await hashToken(refreshToken);

    await this.sessionRepo.update(sessionId, {
      refresh_token_hash: tokenHash,
      updated_at: new Date(),
    });
  }

  async markTwoFactorVerified(
    sessionId: string,
    userId: string,
    verifiedAt = new Date(),
  ): Promise<void> {
    const session = await this.getSessionForSecurityUpdate(sessionId, userId);

    const securityEvents = this.appendSecurityEvent(
      session.security_events,
      this.securityEvent('session.step_up_verified', {
        verifiedAt: verifiedAt.toISOString(),
      }),
    );

    await this.sessionRepo.update(sessionId, {
      two_factor_verified_at: verifiedAt,
      security_events: securityEvents as any,
      updated_at: new Date(),
    });

    await this.redisService.del(`session:${sessionId}`);
    await this.cacheSessionById(sessionId);
  }

  async getActiveSession(
    sessionId: string,
    userId?: string,
  ): Promise<UserSession | null> {
    const where = userId
      ? { id: sessionId, user_id: userId, revoked: false }
      : { id: sessionId, revoked: false };

    const session = await this.sessionRepo.findOne({ where });

    if (!session) {
      return null;
    }

    if (this.isExpired(session)) {
      await this.revoke(session.id, userId, 'expired');
      return null;
    }

    return session;
  }

  async rotateRefreshToken(options: RotateRefreshTokenOptions): Promise<void> {
    const newHash = await hashToken(options.newRefreshToken);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserSession);

      const session = await repository
        .createQueryBuilder('session')
        .addSelect('session.refresh_token_hash')
        .setLock('pessimistic_write')
        .where('session.id = :sessionId', {
          sessionId: options.sessionId,
        })
        .andWhere('session.user_id = :userId', {
          userId: options.userId,
        })
        .getOne();

      if (!session) {
        throw new UnauthorizedException('Session does not exist.');
      }

      if (session.revoked) {
        throw new UnauthorizedException('Session has been revoked.');
      }

      await this.assertSessionUsable(repository, session, options.userId);

      const valid = await verifyToken(
        options.oldRefreshToken,
        session.refresh_token_hash,
      );

      if (!valid) {
        await this.handleRefreshTokenMismatch(
          repository,
          session,
          options.oldRefreshToken,
        );
        throw new UnauthorizedException(
          'Refresh token reuse was detected. The session has been revoked.',
        );
      }

      const now = new Date();
      const idleExpiry = this.newIdleExpiry(now);
      const absoluteExpiry =
        session.absolute_expires_at ?? this.newAbsoluteExpiry(now);

      await repository.update(session.id, {
        refresh_token_hash: newHash,
        previous_refresh_token_hash: session.refresh_token_hash,
        previous_refresh_rotated_at: now,
        expires_at: this.effectiveExpiry(absoluteExpiry, idleExpiry),
        idle_expires_at: idleExpiry,
        last_used_at: now,
        last_activity_at: now,
        last_ip_address: options.ipAddress ?? session.last_ip_address,
        ip_address: options.ipAddress ?? session.ip_address,
        user_agent: options.userAgent ?? session.user_agent,
        security_events: this.appendSecurityEvent(
          session.security_events,
          this.securityEvent('session.refresh_rotated', {
            ipAddress: options.ipAddress ?? session.ip_address,
          }),
        ) as any,
        updated_at: now,
      });
    });

    await this.redisService.del(`session:${options.sessionId}`);

    await this.cacheSessionById(options.sessionId);
  }

  async isSessionActive(sessionId: string, userId?: string): Promise<boolean> {
    const cached = await this.redisService.getJson<{
      userId: string;
      expiresAt: string;
      idleExpiresAt: string | null;
      absoluteExpiresAt: string | null;
      revoked: boolean;
      compromisedAt: string | null;
    }>(`session:${sessionId}`);

    if (cached) {
      if (cached.revoked || cached.compromisedAt) {
        return false;
      }

      const effectiveExpiry = this.effectiveExpiry(
        cached.absoluteExpiresAt ? new Date(cached.absoluteExpiresAt) : null,
        cached.idleExpiresAt ? new Date(cached.idleExpiresAt) : null,
        new Date(cached.expiresAt),
      );

      if (effectiveExpiry.getTime() <= Date.now()) {
        await this.redisService.del(`session:${sessionId}`);
        return false;
      }

      return !userId || cached.userId === userId;
    }

    const session = await this.getActiveSession(sessionId, userId);

    if (!session) {
      return false;
    }

    await this.cacheSession(session);

    return true;
  }

  async validateRefreshToken(
    sessionId: string,
    refreshToken: string,
    userId?: string,
  ): Promise<UserSession> {
    const query = this.sessionRepo
      .createQueryBuilder('session')
      .addSelect('session.refresh_token_hash')
      .where('session.id = :sessionId', {
        sessionId,
      })
      .andWhere('session.revoked = false');

    if (userId) {
      query.andWhere('session.user_id = :userId', {
        userId,
      });
    }

    const session = await query.getOne();

    if (!session) {
      throw new ForbiddenException('Session not found or revoked.');
    }

    if (this.isExpired(session)) {
      await this.revoke(session.id, userId, 'expired');

      throw new ForbiddenException('Session has expired.');
    }

    const valid = await verifyToken(refreshToken, session.refresh_token_hash);

    if (!valid) {
      await this.revoke(session.id, userId, 'refresh_token_reuse');

      throw new ForbiddenException('Refresh token reuse detected.');
    }

    return session;
  }

  async revoke(
    sessionId: string,
    userId?: string,
    reason = 'user_revoked',
  ): Promise<void> {
    const where = userId
      ? {
          id: sessionId,
          user_id: userId,
          revoked: false,
        }
      : {
          id: sessionId,
          revoked: false,
        };

    const session = await this.sessionRepo.findOne({
      where,
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    await this.sessionRepo.update(session.id, {
      revoked: true,
      revoked_at: new Date(),
      revocation_reason: reason,
      compromised_at: reason === 'refresh_token_reuse' ? new Date() : undefined,
    });

    await this.redisService.del(`session:${session.id}`);
  }

  async revokeAllUserSessions(
    userId: string,
    reason = 'revoke_all',
  ): Promise<void> {
    const sessions = await this.sessionRepo.find({
      where: {
        user_id: userId,
        revoked: false,
      },
      select: {
        id: true,
      },
    });

    await this.sessionRepo.update(
      {
        user_id: userId,
        revoked: false,
      },
      {
        revoked: true,
        revoked_at: new Date(),
        revocation_reason: reason,
      },
    );

    await Promise.all(
      sessions.map((session) => this.redisService.del(`session:${session.id}`)),
    );
  }

  async revokeOtherUserSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    const sessions = await this.sessionRepo
      .createQueryBuilder('session')
      .select(['session.id'])
      .where('session.user_id = :userId', {
        userId,
      })
      .andWhere('session.id != :currentSessionId', {
        currentSessionId,
      })
      .andWhere('session.revoked = false')
      .getMany();

    await this.sessionRepo
      .createQueryBuilder()
      .update(UserSession)
      .set({
        revoked: true,
        revoked_at: new Date(),
        revocation_reason: 'revoke_other_sessions',
      })
      .where('user_id = :userId', {
        userId,
      })
      .andWhere('id != :currentSessionId', {
        currentSessionId,
      })
      .andWhere('revoked = false')
      .execute();

    await Promise.all(
      sessions.map((session) => this.redisService.del(`session:${session.id}`)),
    );
  }

  async revokeDeviceSessions(userId: string, deviceId: string): Promise<void> {
    const sessions = await this.sessionRepo.find({
      where: {
        user_id: userId,
        device_id: deviceId,
        revoked: false,
      },
      select: {
        id: true,
      },
    });

    await this.sessionRepo.update(
      {
        user_id: userId,
        device_id: deviceId,
        revoked: false,
      },
      {
        revoked: true,
        revoked_at: new Date(),
        revocation_reason: 'device_removed',
      },
    );

    await Promise.all(
      sessions.map((session) => this.redisService.del(`session:${session.id}`)),
    );
  }

  async findUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        user_id: userId,
        revoked: false,
        expires_at: MoreThan(new Date()),
      },
      order: {
        last_used_at: 'DESC',
        created_at: 'DESC',
      },
    });

    return sessions.map(
      (session) => new SessionResponseDto(session, currentSessionId),
    );
  }

  async cleanExpiredSessions(): Promise<void> {
    const now = new Date();

    await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .from(UserSession)
      .where('expires_at < :now', { now })
      .orWhere(
        'absolute_expires_at IS NOT NULL AND absolute_expires_at < :now',
        {
          now,
        },
      )
      .orWhere('idle_expires_at IS NOT NULL AND idle_expires_at < :now', {
        now,
      })
      .execute();
  }

  private async cacheSession(session: UserSession): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.floor(
        (this.effectiveExpiry(
          session.absolute_expires_at,
          session.idle_expires_at,
          session.expires_at,
        ).getTime() -
          Date.now()) /
          1000,
      ),
    );

    await this.redisService.setJson(
      `session:${session.id}`,
      {
        userId: session.user_id,
        expiresAt: session.expires_at.toISOString(),
        idleExpiresAt: session.idle_expires_at?.toISOString() ?? null,
        absoluteExpiresAt: session.absolute_expires_at?.toISOString() ?? null,
        revoked: session.revoked,
        compromisedAt: session.compromised_at?.toISOString() ?? null,
      },
      ttlSeconds,
    );
  }

  private async cacheSessionById(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: {
        id: sessionId,
        revoked: false,
      },
    });

    if (session) {
      await this.cacheSession(session);
    }
  }

  private newExpiry(): Date {
    const expiry = new Date();

    expiry.setDate(expiry.getDate() + this.refreshTtlDays);

    return expiry;
  }

  private newAbsoluteExpiry(base = new Date()): Date {
    const expiry = new Date(base);
    expiry.setHours(expiry.getHours() + this.absoluteHours);
    return expiry;
  }

  private newIdleExpiry(base = new Date()): Date {
    return new Date(base.getTime() + this.idleMinutes * 60 * 1000);
  }

  private effectiveExpiry(
    absoluteExpiry: Date | null,
    idleExpiry: Date | null,
    fallback?: Date,
  ): Date {
    const candidates = [absoluteExpiry, idleExpiry, fallback].filter(
      (value): value is Date => value instanceof Date,
    );

    return candidates.sort(
      (left, right) => left.getTime() - right.getTime(),
    )[0];
  }

  private isExpired(
    session: Pick<
      UserSession,
      'expires_at' | 'absolute_expires_at' | 'idle_expires_at'
    >,
  ): boolean {
    return (
      this.effectiveExpiry(
        session.absolute_expires_at,
        session.idle_expires_at,
        session.expires_at,
      ).getTime() <= Date.now()
    );
  }

  private async assertSessionUsable(
    repository: Repository<UserSession>,
    session: UserSession,
    userId: string,
  ): Promise<void> {
    if (!this.isExpired(session)) {
      return;
    }

    await repository.update(session.id, {
      revoked: true,
      revoked_at: new Date(),
      revocation_reason: 'expired',
    });

    throw new UnauthorizedException('Session has expired.');
  }

  private async handleRefreshTokenMismatch(
    repository: Repository<UserSession>,
    session: UserSession,
    presentedToken: string,
  ): Promise<void> {
    const matchedPrevious =
      this.reuseDetectionEnabled &&
      session.previous_refresh_token_hash &&
      (await verifyToken(presentedToken, session.previous_refresh_token_hash));

    if (matchedPrevious) {
      await this.revokeFamily(
        repository,
        session.family_id,
        'refresh_token_reuse',
      );
      return;
    }

    await repository.update(session.id, {
      revoked: true,
      revoked_at: new Date(),
      revocation_reason: 'refresh_token_reuse',
      compromised_at: new Date(),
      security_events: this.appendSecurityEvent(
        session.security_events,
        this.securityEvent('session.refresh_reuse_detected', {}),
      ) as any,
    });
  }

  private async revokeFamily(
    repository: Repository<UserSession>,
    familyId: string,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    const sessions = await repository.find({
      where: { family_id: familyId, revoked: false },
      select: { id: true },
    });

    await repository.update(
      {
        family_id: familyId,
        revoked: false,
      },
      {
        revoked: true,
        revoked_at: now,
        revocation_reason: reason,
        compromised_at: now,
      },
    );

    await Promise.all(
      sessions.map((item) => this.redisService.del(`session:${item.id}`)),
    );
  }

  private async getSessionForSecurityUpdate(
    sessionId: string,
    userId: string,
  ): Promise<UserSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, user_id: userId, revoked: false },
    });

    if (!session || this.isExpired(session)) {
      throw new UnauthorizedException('Session not found or expired.');
    }

    return session;
  }

  private appendSecurityEvent(
    events: Array<Record<string, unknown>> | null,
    event: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    return [...(events ?? []).slice(-24), event];
  }

  private securityEvent(
    type: string,
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      type,
      occurredAt: new Date().toISOString(),
      ...metadata,
    };
  }
}
