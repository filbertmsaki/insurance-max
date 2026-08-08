import { NotFoundException } from '@nestjs/common';

import { SystemConfigsService } from './system-configs.service';

function makeHarness() {
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
    remove: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new SystemConfigsService(repository);

  return { service, repository };
}

describe('SystemConfigsService', () => {
  it('creates a new row when the key does not exist yet', async () => {
    const { service, repository } = makeHarness();
    repository.findOne.mockResolvedValue(null);

    const result = await service.upsert('TIRAMIS_RETRY_CEILING', {
      config_value: { maxRetries: 5 },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ config_key: 'TIRAMIS_RETRY_CEILING' }),
    );
    expect(result.config_value).toEqual({ maxRetries: 5 });
    expect(result.is_active).toBe(true);
  });

  it('updates the existing row in place', async () => {
    const { service, repository } = makeHarness();
    const existing = {
      config_key: 'TIRAMIS_RETRY_CEILING',
      config_value: { maxRetries: 3 },
      description: null,
      is_active: true,
    };
    repository.findOne.mockResolvedValue(existing);

    const result = await service.upsert('TIRAMIS_RETRY_CEILING', {
      config_value: { maxRetries: 5 },
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(result).toBe(existing);
    expect(result.config_value).toEqual({ maxRetries: 5 });
  });

  it('throws NotFoundException for a missing key', async () => {
    const { service, repository } = makeHarness();
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne('MISSING')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getValue returns the fallback when inactive or missing', async () => {
    const { service, repository } = makeHarness();
    repository.findOne.mockResolvedValue(null);

    const value = await service.getValue('MISSING', { defaultOnly: true });

    expect(value).toEqual({ defaultOnly: true });
  });
});
