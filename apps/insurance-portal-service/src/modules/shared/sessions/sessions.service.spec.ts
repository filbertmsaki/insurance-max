import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
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
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    last_used_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as UserSession;
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
  };
  let redisService: jest.Mocked<RedisService>;

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(UserSession), useValue: sessionRepo },
        {
          provide: RedisService,
          useValue: {
            setJson: jest.fn(),
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
      await service.revoke(SESSION_ID);

      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ revoked: true }),
      );
      expect(redisService.del).toHaveBeenCalledWith(`session:${SESSION_ID}`);
    });
  });

  describe('validateRefreshToken', () => {
    it('throws ForbiddenException when session not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateRefreshToken(SESSION_ID, 'any-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when session is expired', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ expires_at: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.validateRefreshToken(SESSION_ID, 'any-token'),
      ).rejects.toThrow(ForbiddenException);
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

  describe('findById', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns session when found', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      const result = await service.findById(SESSION_ID);
      expect(result.id).toBe(SESSION_ID);
    });
  });
});
