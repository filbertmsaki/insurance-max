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

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepo: Repository<UserSession>,

    private readonly dataSource: DataSource,

    private readonly redisService: RedisService,

    private readonly configService: ConfigService,
  ) {
    const expiration = configService.get<string>(
      'jwt.refreshExpiration',
      '7d',
    );

    this.refreshTtlDays = Number.parseInt(expiration, 10) || 7;
  }

  async create(options: CreateSessionOptions): Promise<UserSession> {
    const rawToken = options.refreshToken ?? randomUUID();

    const tokenHash = await hashToken(rawToken);

    const session = this.sessionRepo.create({
      user_id: options.userId,
      refresh_token_hash: tokenHash,
      device_id: options.deviceId ?? null,
      ip_address: options.ipAddress ?? null,
      user_agent: options.userAgent ?? null,
      device_info: options.deviceInfo ?? null,
      expires_at: this.newExpiry(),
      last_used_at: new Date(),
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

      if (session.expires_at.getTime() <= Date.now()) {
        await repository.update(session.id, {
          revoked: true,
          revoked_at: new Date(),
          revocation_reason: 'expired',
        });

        throw new UnauthorizedException('Session has expired.');
      }

      const valid = await verifyToken(
        options.oldRefreshToken,
        session.refresh_token_hash,
      );

      if (!valid) {
        await repository.update(session.id, {
          revoked: true,
          revoked_at: new Date(),
          revocation_reason: 'refresh_token_reuse',
        });

        throw new UnauthorizedException(
          'Refresh token reuse was detected. The session has been revoked.',
        );
      }

      await repository.update(session.id, {
        refresh_token_hash: newHash,
        expires_at: this.newExpiry(),
        last_used_at: new Date(),
        ip_address: options.ipAddress ?? session.ip_address,
        user_agent: options.userAgent ?? session.user_agent,
        updated_at: new Date(),
      });
    });

    await this.redisService.del(`session:${options.sessionId}`);

    await this.cacheSessionById(options.sessionId);
  }

  async isSessionActive(sessionId: string, userId?: string): Promise<boolean> {
    const cached = await this.redisService.getJson<{ userId: string }>(
      `session:${sessionId}`,
    );

    if (cached) {
      return !userId || cached.userId === userId;
    }

    const where = userId
      ? {
          id: sessionId,
          user_id: userId,
          revoked: false,
          expires_at: MoreThan(new Date()),
        }
      : {
          id: sessionId,
          revoked: false,
          expires_at: MoreThan(new Date()),
        };

    const session = await this.sessionRepo.findOne({
      where,
    });

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

    if (session.expires_at.getTime() <= Date.now()) {
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
      sessions.map((session) =>
        this.redisService.del(`session:${session.id}`),
      ),
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
      sessions.map((session) =>
        this.redisService.del(`session:${session.id}`),
      ),
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
      sessions.map((session) =>
        this.redisService.del(`session:${session.id}`),
      ),
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
    await this.sessionRepo.delete({
      expires_at: LessThan(new Date()),
    });
  }

  private async cacheSession(session: UserSession): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.floor((session.expires_at.getTime() - Date.now()) / 1000),
    );

    await this.redisService.setJson(
      `session:${session.id}`,
      {
        userId: session.user_id,
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
}
