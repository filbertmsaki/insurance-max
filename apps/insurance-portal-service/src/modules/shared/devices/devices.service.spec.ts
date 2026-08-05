import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { DevicesService } from './devices.service';
import { Device } from './entities/device.entity';
import { SessionsService } from '../sessions/sessions.service';

const USER_ID = 'uuid-user-1';
const PEPPER = 'a-test-device-token-pepper-value-32bytes';
const VALID_DEVICE_TOKEN = 'a'.repeat(40);
const OTHER_DEVICE_TOKEN = 'b'.repeat(40);

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let sessionsService: jest.Mocked<SessionsService>;

  beforeEach(async () => {
    deviceRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest
        .fn()
        .mockImplementation((e) => Promise.resolve({ ...e, id: 'device-1' })),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
        {
          provide: SessionsService,
          useValue: { revokeDeviceSessions: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                'app.auth.trustedDeviceDays': 30,
              };
              return map[key] ?? def;
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              if (key === 'AUTH_DEVICE_TOKEN_PEPPER') return PEPPER;
              throw new Error(`Missing config: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get(DevicesService);
    sessionsService = module.get(SessionsService);
  });

  describe('isTrusted', () => {
    it('returns false when no device token is provided, even if a legacy device would match', async () => {
      const result = await service.isTrusted(USER_ID, undefined);

      expect(result).toBe(false);
      expect(deviceRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a malformed device token', async () => {
      await expect(service.isTrusted(USER_ID, 'too-short')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns false when the device exists but is not trusted', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      const result = await service.isTrusted(USER_ID, VALID_DEVICE_TOKEN);

      expect(result).toBe(false);
    });

    it('returns true when a trusted, non-expired device matches the fingerprint', async () => {
      deviceRepo.findOne.mockResolvedValue({ id: 'device-1', trusted: true });

      const result = await service.isTrusted(USER_ID, VALID_DEVICE_TOKEN);

      expect(result).toBe(true);
    });
  });

  describe('upsert', () => {
    it('reuses the same device across logins when the same device token is presented', async () => {
      const existing = { id: 'device-1', fingerprint: 'fp', device_name: null };
      deviceRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, last_used_at: new Date() });

      const device = await service.upsert({
        userId: USER_ID,
        deviceToken: VALID_DEVICE_TOKEN,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
        ipAddress: '10.0.0.1',
      });

      expect(deviceRepo.create).not.toHaveBeenCalled();
      expect(deviceRepo.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({ revoked_at: null }),
      );
      expect(device.id).toBe('device-1');
    });

    it('produces a different fingerprint (and a new device) for a different device token', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      await service.upsert({
        userId: USER_ID,
        deviceToken: VALID_DEVICE_TOKEN,
        userAgent: 'Chrome',
      });
      const firstFingerprint = deviceRepo.create.mock.calls[0][0].fingerprint;

      await service.upsert({
        userId: USER_ID,
        deviceToken: OTHER_DEVICE_TOKEN,
        userAgent: 'Chrome',
      });
      const secondFingerprint = deviceRepo.create.mock.calls[1][0].fingerprint;

      expect(firstFingerprint).not.toBe(secondFingerprint);
    });

    it('falls back to a legacy user-agent/IP fingerprint when no device token is presented', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      await service.upsert({
        userId: USER_ID,
        userAgent: 'Chrome',
        ipAddress: '10.0.0.1',
      });

      expect(deviceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ trusted: false, trusted_until: null }),
      );
    });
  });

  describe('trustDevice', () => {
    it('sets trusted_until roughly trustedDeviceDays in the future', async () => {
      deviceRepo.findOne.mockResolvedValue({ id: 'device-1', user_id: USER_ID });

      await service.trustDevice('device-1', USER_ID);

      const updateArgs = deviceRepo.update.mock.calls[0][1];
      const daysAhead =
        (updateArgs.trusted_until.getTime() - Date.now()) /
        (24 * 60 * 60 * 1000);

      expect(updateArgs.trusted).toBe(true);
      expect(daysAhead).toBeGreaterThan(29);
      expect(daysAhead).toBeLessThan(31);
    });

    it('throws NotFoundException when the device is not owned by the user', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      await expect(service.trustDevice('device-1', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeDevice', () => {
    it('revokes device sessions and marks the device as revoked', async () => {
      deviceRepo.findOne.mockResolvedValue({ id: 'device-1', user_id: USER_ID });

      await service.removeDevice('device-1', USER_ID);

      expect(sessionsService.revokeDeviceSessions).toHaveBeenCalledWith(
        USER_ID,
        'device-1',
      );
      expect(deviceRepo.update).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ revoked_at: expect.any(Date) }),
      );
    });
  });
});
