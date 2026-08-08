import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CompanyConfigsService } from './company-configs.service';
import { ConfigValueType } from './entities/company-config.entity';

function makeHarness() {
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
    remove: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new CompanyConfigsService(repository);

  return { service, repository };
}

describe('CompanyConfigsService', () => {
  describe('upsert', () => {
    it('rejects a NUMBER value_type when config_value is not a number', async () => {
      const { service } = makeHarness();

      await expect(
        service.upsert('company-1', 'RENEWAL_FIRST_NOTICE_DAYS', {
          config_value: 'thirty',
          value_type: ConfigValueType.NUMBER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a BOOLEAN value_type when config_value is not a boolean', async () => {
      const { service } = makeHarness();

      await expect(
        service.upsert('company-1', 'FEATURE_FLAG', {
          config_value: 'true',
          value_type: ConfigValueType.BOOLEAN,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a new config row when none exists yet', async () => {
      const { service, repository } = makeHarness();
      repository.findOne.mockResolvedValue(null);

      const result = await service.upsert(
        'company-1',
        'RENEWAL_FIRST_NOTICE_DAYS',
        {
          config_value: 45,
          value_type: ConfigValueType.NUMBER,
          description: 'Days before expiry',
        },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'company-1',
          config_key: 'RENEWAL_FIRST_NOTICE_DAYS',
        }),
      );
      expect(result.config_value).toBe(45);
      expect(result.is_active).toBe(true);
    });

    it('updates the existing row in place instead of creating a duplicate', async () => {
      const { service, repository } = makeHarness();
      const existing = {
        company_id: 'company-1',
        config_key: 'RENEWAL_FIRST_NOTICE_DAYS',
        config_value: 30,
        value_type: ConfigValueType.NUMBER,
        description: 'old',
        is_active: true,
      };
      repository.findOne.mockResolvedValue(existing);

      const result = await service.upsert(
        'company-1',
        'RENEWAL_FIRST_NOTICE_DAYS',
        {
          config_value: 60,
          value_type: ConfigValueType.NUMBER,
        },
      );

      expect(repository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
      expect(result.config_value).toBe(60);
      // Description wasn't supplied on this update — keeps the prior value.
      expect(result.description).toBe('old');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the key does not exist for the company', async () => {
      const { service, repository } = makeHarness();
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('company-1', 'MISSING'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getValue', () => {
    it('returns the fallback when the key is missing', async () => {
      const { service, repository } = makeHarness();
      repository.findOne.mockResolvedValue(null);

      const value = await service.getValue(
        'company-1',
        'CANCELLATION_DEFAULT_METHOD',
        'PRO_RATA',
      );

      expect(value).toBe('PRO_RATA');
    });

    it('returns the fallback instead of throwing when the stored value does not match its declared type', async () => {
      const { service, repository } = makeHarness();
      repository.findOne.mockResolvedValue({
        config_value: 'not-a-number',
        value_type: ConfigValueType.NUMBER,
      });

      const value = await service.getValue(
        'company-1',
        'RENEWAL_FIRST_NOTICE_DAYS',
        30,
      );

      expect(value).toBe(30);
    });

    it('returns the real stored value when it is present and well-typed', async () => {
      const { service, repository } = makeHarness();
      repository.findOne.mockResolvedValue({
        config_value: 45,
        value_type: ConfigValueType.NUMBER,
      });

      const value = await service.getValue(
        'company-1',
        'RENEWAL_FIRST_NOTICE_DAYS',
        30,
      );

      expect(value).toBe(45);
    });
  });
});
