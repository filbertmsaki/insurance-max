import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { hashToken } from '@insurance-max/portal-shared/utils/hash.util';

import { SessionsService } from './sessions.service';
import { UserSession } from './entities/user-session.entity';
import { RedisService } from '../redis/redis.service';

const SESSION_ID = 'uuid-session-1';
const USER_ID = 'uuid-user-1';

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    refresh_token_hash: '$argon2id$v=19$m=16384,t=3,p=1$abc$def',
    device_id: null,
    ip_address: '127.0.0.1',
    user_agent: 'Jest/1.0',
    device_info: null,
    revoked: false,
    revoked_at: null,
    revocation_reason: null,
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    last_used_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as UserSession;
}

function makeQueryBuilder(session: UserSession | null) {
  const builder: any = {
    addSelect: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(session),
    getMany: jest.fn().mockResolvedValue(session ? [session] : []),
  };
  return builder;
}

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let redisService: jest.Mocked<RedisService>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    sessionRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest
        .fn()
        .mockImplementation((e) => Promise.resolve({ ...e, id: SESSION_ID })),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation(async (callback) => {
        const manager = { getRepository: () => sessionRepo };
        return callback(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(UserSession), useValue: sessionRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: RedisService,
          useValue: {
            setJson: jest.fn(),
            getJson: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                'jwt.refreshExpiration': '7d',
              };
              return map[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(SessionsService);
    redisService = module.get(RedisService);
  });

  describe('create', () => {
    it('creates a session and caches it in Redis', async () => {
      const result = await service.create({
        userId: USER_ID,
        refreshToken: 'raw-refresh-token',
        ipAddress: '127.0.0.1',
      });

      expect(result.id).toBe(SESSION_ID);
      expect(sessionRepo.save).toHaveBeenCalled();
      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:${SESSION_ID}`,
        expect.objectContaining({ userId: USER_ID }),
        expect.any(Number),
      );
    });
  });

  describe('revoke', () => {
    it('marks session as revoked and removes from Redis', async () => {
      sessionRepo.findOne.mockResolvedValue({ id: SESSION_ID });

      await service.revoke(SESSION_ID);

      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ revoked: true }),
      );
      expect(redisService.del).toHaveBeenCalledWith(`session:${SESSION_ID}`);
    });

    it('throws NotFoundException when the session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.revoke(SESSION_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('rotates the hash when the old refresh token matches', async () => {
      const oldToken = 'old-refresh-token';
      const hash = await hashToken(oldToken);
      const session = makeSession({ refresh_token_hash: hash });

      sessionRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder(session));
      sessionRepo.findOne.mockResolvedValue(session);

      await service.rotateRefreshToken({
        sessionId: SESSION_ID,
        userId: USER_ID,
        oldRefreshToken: oldToken,
        newRefreshToken: 'new-refresh-token',
      });

      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ refresh_token_hash: expect.any(String) }),
      );
      expect(redisService.del).toHaveBeenCalledWith(`session:${SESSION_ID}`);
    });

    it('revokes the session and throws when the old refresh token does not match (reuse detection)', async () => {
      const hash = await hashToken('the-real-token');
      const session = makeSession({ refresh_token_hash: hash });

      sessionRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder(session));

      await expect(
        service.rotateRefreshToken({
          sessionId: SESSION_ID,
          userId: USER_ID,
          oldRefreshToken: 'a-stolen-token',
          newRefreshToken: 'new-refresh-token',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({
          revoked: true,
          revocation_reason: 'refresh_token_reuse',
        }),
      );
    });

    it('throws when the session does not exist', async () => {
      sessionRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder(null));

      await expect(
        service.rotateRefreshToken({
          sessionId: SESSION_ID,
          userId: USER_ID,
          oldRefreshToken: 'any',
          newRefreshToken: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('revokes and throws when the session is already expired', async () => {
      const session = makeSession({
        expires_at: new Date(Date.now() - 1000),
      });

      sessionRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder(session));

      await expect(
        service.rotateRefreshToken({
          sessionId: SESSION_ID,
          userId: USER_ID,
          oldRefreshToken: 'any',
          newRefreshToken: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ revoked: true, revocation_reason: 'expired' }),
      );
    });
  });

  describe('revokeAllUserSessions', () => {
    it('revokes all active sessions and clears Redis cache', async () => {
      const sessions = [{ id: 'session-a' }, { id: 'session-b' }];
      sessionRepo.find.mockResolvedValue(sessions);

      await service.revokeAllUserSessions(USER_ID);

      expect(sessionRepo.update).toHaveBeenCalledWith(
        { user_id: USER_ID, revoked: false },
        expect.objectContaining({ revoked: true }),
      );
      expect(redisService.del).toHaveBeenCalledTimes(sessions.length);
    });
  });

  describe('revokeOtherUserSessions', () => {
    it('revokes sessions other than the current one', async () => {
      const other = makeSession({ id: 'other-session' });
      const builder = makeQueryBuilder(other);
      builder.execute = jest.fn().mockResolvedValue({ affected: 1 });
      sessionRepo.createQueryBuilder.mockReturnValue(builder);

      await service.revokeOtherUserSessions(USER_ID, SESSION_ID);

      expect(builder.execute).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(`session:other-session`);
    });
  });

  describe('findUserSessions', () => {
    it('marks the matching session as current', async () => {
      const session = makeSession();
      sessionRepo.find.mockResolvedValue([session]);

      const result = await service.findUserSessions(USER_ID, SESSION_ID);

      expect(result).toHaveLength(1);
      expect(result[0].is_current).toBe(true);
      expect((result[0] as any).refresh_token_hash).toBeUndefined();
    });

    it('marks sessions as not current when currentSessionId does not match', async () => {
      const session = makeSession();
      sessionRepo.find.mockResolvedValue([session]);

      const result = await service.findUserSessions(USER_ID, 'some-other-id');

      expect(result[0].is_current).toBe(false);
    });
  });
});
