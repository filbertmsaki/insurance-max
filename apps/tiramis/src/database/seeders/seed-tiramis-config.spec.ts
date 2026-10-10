import {
  buildTiramisConfigurationSeeds,
  resolveTiramisSeedOptions,
} from './seed-tiramis-config';

const baseEnvironment = {
  APP_ENV: 'development',
};

describe('seed-tiramis-config', () => {
  it('seeds company-only configuration rows for test and live', () => {
    const options = resolveTiramisSeedOptions(baseEnvironment, []);
    const seeds = buildTiramisConfigurationSeeds(baseEnvironment, options);

    expect(options.includeLive).toBe(true);
    expect(options.skippedLiveKeys).toEqual([]);
    expect(seeds.map((seed) => seed.environment)).toEqual(['test', 'live']);
    for (const seed of seeds) {
      // System identity is platform-wide (env), never seeded per company.
      for (const field of [
        'systemCode',
        'clientCode',
        'clientKey',
        'baseUrl',
      ]) {
        expect(seed).not.toHaveProperty(field);
      }
    }
  });

  it('supports the explicit test-only CLI flag', () => {
    const options = resolveTiramisSeedOptions(baseEnvironment, ['--test-only']);
    const seeds = buildTiramisConfigurationSeeds(baseEnvironment, options);

    expect(options.includeLive).toBe(false);
    expect(seeds.map((seed) => seed.environment)).toEqual(['test']);
  });

  it('keeps deprecated TIRAMIS_SEED_ENVIRONMENTS=test behavior compatible', () => {
    const options = resolveTiramisSeedOptions(
      {
        ...baseEnvironment,
        TIRAMIS_SEED_ENVIRONMENTS: 'test',
      },
      [],
    );

    expect(options.includeLive).toBe(false);
    expect(options.legacySeedEnvironment).toBe('test');
  });
});
