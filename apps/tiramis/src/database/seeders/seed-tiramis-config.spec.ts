import {
  buildTiramisConfigurationSeeds,
  resolveTiramisSeedOptions,
} from './seed-tiramis-config';

const baseEnvironment = {
  APP_ENV: 'development',
};

describe('seed-tiramis-config', () => {
  it('includes test and live configuration rows without reading env credentials', () => {
    const options = resolveTiramisSeedOptions(baseEnvironment, []);
    const seeds = buildTiramisConfigurationSeeds(baseEnvironment, options);

    expect(options.includeLive).toBe(true);
    expect(options.skippedLiveKeys).toEqual([]);
    expect(seeds.map((seed) => seed.environment)).toEqual(['test', 'live']);
    expect(seeds[0]).not.toHaveProperty('clientKey');
    expect(seeds[1]).not.toHaveProperty('baseUrl');
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
