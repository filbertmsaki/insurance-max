import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { UserSession } from './entities/user-session.entity';
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

@Injectable()
export class SessionsService {
  private readonly refreshTtlDays: number;

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepo: Repository<UserSession>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const expiration = configService.get<string>('jwt.refreshExpiration', '7d');
    this.refreshTtlDays = parseInt(expiration, 10) || 7;
  }

  async create(options: CreateSessionOptions): Promise<UserSession> {
    const tokenHash = await hashToken(options.refreshToken ?? randomUUID());
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTtlDays);

    const session = this.sessionRepo.create({
      user_id: options.userId,
      refresh_token_hash: tokenHash,
      device_id: options.deviceId ?? null,
      ip_address: options.ipAddress ?? null,
      user_agent: options.userAgent ?? null,
      device_info: options.deviceInfo ?? null,
      expires_at: expiresAt,
    });

    const saved = await this.sessionRepo.save(session);

    // Cache session in Redis
    const ttlSeconds = this.refreshTtlDays * 24 * 3600;
    await this.redisService.setJson(
      `session:${saved.id}`,
      { userId: options.userId },
      ttlSeconds,
    );

    return saved;
  }

  async bindRefreshToken(
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = await hashToken(refreshToken);
    await this.sessionRepo.update(sessionId, { refresh_token_hash: tokenHash });
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
      : { id: sessionId, revoked: false, expires_at: MoreThan(new Date()) };

    const session = await this.sessionRepo.findOne({
      where,
      select: { id: true, user_id: true, expires_at: true },
    });

    if (!session) {
      return false;
    }

    const ttlSeconds = Math.max(
      1,
      Math.floor((session.expires_at.getTime() - Date.now()) / 1000),
    );
    await this.redisService.setJson(
      `session:${session.id}`,
      { userId: session.user_id },
      ttlSeconds,
    );

    return true;
  }

  async validateRefreshToken(
    sessionId: string,
    refreshToken: string,
    userId?: string,
  ): Promise<UserSession> {
    const where = userId
      ? { id: sessionId, user_id: userId, revoked: false }
      : { id: sessionId, revoked: false };
    const session = await this.sessionRepo.findOne({ where });
    if (!session) throw new ForbiddenException('Session not found or revoked');

    if (new Date() > session.expires_at) {
      await this.revoke(sessionId);
      throw new ForbiddenException('Session has expired');
    }

    const valid = await verifyToken(refreshToken, session.refresh_token_hash);
    if (!valid) throw new ForbiddenException('Invalid refresh token');

    return session;
  }

  async revoke(sessionId: string, userId?: string): Promise<void> {
    const where = userId
      ? { id: sessionId, user_id: userId, revoked: false }
      : { id: sessionId, revoked: false };
    const session = await this.sessionRepo.findOne({
      where,
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.sessionRepo.update(session.id, {
      revoked: true,
      revoked_at: new Date(),
    });
    await this.redisService.del(`session:${session.id}`);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.sessionRepo.find({
      where: { user_id: userId, revoked: false },
      select: { id: true },
    });

    await this.sessionRepo.update(
      { user_id: userId, revoked: false },
      { revoked: true, revoked_at: new Date() },
    );

    for (const s of sessions) {
      await this.redisService.del(`session:${s.id}`);
    }
  }

  async findUserSessions(userId: string): Promise<UserSession[]> {
    return this.sessionRepo.find({
      where: { user_id: userId, revoked: false },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<UserSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async rotateToken(
    sessionId: string,
    oldToken: string,
    newToken: string,
  ): Promise<void> {
    const session = await this.validateRefreshToken(sessionId, oldToken);
    const newHash = await hashToken(newToken);

    await this.sessionRepo.update(session.id, {
      refresh_token_hash: newHash,
      expires_at: this.newExpiry(),
    });
  }

  async cleanExpiredSessions(): Promise<void> {
    await this.sessionRepo.delete({ expires_at: LessThan(new Date()) });
  }

  private newExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + this.refreshTtlDays);
    return d;
  }
}
