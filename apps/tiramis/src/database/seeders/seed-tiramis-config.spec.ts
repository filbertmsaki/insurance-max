import {
  buildTiramisConfigurationSeeds,
  resolveSeedEnvironments,
  resolveTiramisSeedOptions,
} from './seed-tiramis-config';

const baseEnvironment = {
  APP_ENV: 'development',
};

describe('seed-tiramis-config', () => {
  it('seeds only the active UAT environment by default', () => {
    const options = resolveTiramisSeedOptions(baseEnvironment, []);
    const seeds = buildTiramisConfigurationSeeds(baseEnvironment, options);

    expect(options.environment).toBe('uat');
    expect(resolveSeedEnvironments(options)).toEqual(['uat']);
    expect(seeds.map((seed) => seed.environment)).toEqual(['uat']);
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

  it('maps the production TIRA environment to production seeds', () => {
    const activeEnvironment = { TIRA_ENV: 'production' };
    const options = resolveTiramisSeedOptions(activeEnvironment, []);
    const seeds = buildTiramisConfigurationSeeds(activeEnvironment, options);

    expect(options.environment).toBe('production');
    expect(seeds.map((seed) => seed.environment)).toEqual(['production']);
  });

  it('maps legacy test TIRA_ENV values to UAT and records deprecated seed configuration', () => {
    const options = resolveTiramisSeedOptions(
      {
        ...baseEnvironment,
        TIRA_ENV: 'test',
        TIRAMIS_SEED_ENVIRONMENTS: 'test',
      },
      [],
    );

    expect(options.environment).toBe('uat');
    expect(options.legacySeedEnvironment).toBe('test');
    expect(resolveSeedEnvironments(options)).toEqual(['uat']);
  });
});
