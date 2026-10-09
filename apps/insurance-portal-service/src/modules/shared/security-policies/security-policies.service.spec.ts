import { SecurityPolicyStatus } from '@insurance-max/contracts';
import { SecurityPoliciesService } from './security-policies.service';

function profile(overrides: Record<string, unknown>) {
  return {
    id: 'profile',
    status: SecurityPolicyStatus.ACTIVE,
    version_number: 1,
    effective_from: null,
    effective_to: null,
    created_at: new Date(),
    policy: {},
    ...overrides,
  } as any;
}

function makeService(params: {
  global?: any[];
  company?: any[];
  env?: Record<string, unknown>;
}) {
  const repository = {
    find: jest.fn(async ({ where }: any) =>
      where.company_id && typeof where.company_id === 'string'
        ? (params.company ?? [])
        : (params.global ?? []),
    ),
  };
  const configService = {
    get: jest.fn((key: string) => params.env?.[key]),
  };
  return new SecurityPoliciesService(repository as any, configService as any);
}

describe('SecurityPoliciesService', () => {
  it('falls back to environment defaults when no policy exists', async () => {
    const layers = await makeService({}).resolveLayers('company-1');

    expect(layers.baselineSource).toBe('DEFAULTS');
    expect(layers.companyProfile).toBeNull();
    expect(layers.effective.requireTwoFactorForRoles).toEqual([
      'ADMINISTRATOR',
      'SUPER_ADMIN',
    ]);
  });

  it('uses an active global policy as the baseline', async () => {
    const service = makeService({
      global: [
        profile({
          policy: { twoFactor: { requireForRoles: ['UNDERWRITER'] } },
        }),
      ],
    });

    const layers = await service.resolveLayers(null);

    expect(layers.baselineSource).toBe('GLOBAL_POLICY');
    expect(layers.effective.requireTwoFactorForRoles).toEqual(['UNDERWRITER']);
  });

  it('lets a company policy add requirements on top of the baseline', async () => {
    const service = makeService({
      company: [
        profile({
          policy: {
            twoFactor: {
              requireForRoles: ['CLAIMS_MANAGER'],
              requireForAllUsers: true,
              allowTrustedDeviceBypass: false,
            },
          },
        }),
      ],
    });

    const policy = await service.getEffectivePolicy('company-1');

    expect(policy.requireTwoFactorForRoles).toEqual([
      'ADMINISTRATOR',
      'SUPER_ADMIN',
      'CLAIMS_MANAGER',
    ]);
    expect(policy.requireTwoFactorForAllUsers).toBe(true);
    expect(policy.allowTrustedDeviceBypass).toBe(false);
  });

  it('never lets a company policy weaken the platform baseline', async () => {
    const service = makeService({
      env: {
        SECURITY_REQUIRE_2FA_FOR_ALL_USERS: true,
        AUTH_ALLOW_TRUSTED_DEVICE_BYPASS: false,
      },
      company: [
        profile({
          policy: {
            twoFactor: {
              requireForAllUsers: false,
              requireForRoles: [],
              requireForUserTypes: [],
              allowTrustedDeviceBypass: true,
            },
          },
        }),
      ],
    });

    const policy = await service.getEffectivePolicy('company-1');

    expect(policy.requireTwoFactorForAllUsers).toBe(true);
    expect(policy.requireTwoFactorForRoles).toEqual([
      'ADMINISTRATOR',
      'SUPER_ADMIN',
    ]);
    expect(policy.requireTwoFactorForUserTypes).toEqual([
      'SUPER_ADMIN',
      'COMPANY_ADMIN',
    ]);
    expect(policy.allowTrustedDeviceBypass).toBe(false);
  });

  it('keeps step-up as a platform setting even if a company sets it', async () => {
    const service = makeService({
      company: [profile({ policy: { stepUp: { maxAgeMinutes: 600 } } })],
    });

    const policy = await service.getEffectivePolicy('company-1');

    expect(policy.stepUpMaxAgeMinutes).toBe(10);
  });

  it('ignores company profiles outside their effective window', async () => {
    const service = makeService({
      company: [
        profile({
          effective_from: new Date(Date.now() + 86_400_000),
          policy: { twoFactor: { requireForAllUsers: true } },
        }),
      ],
    });

    const layers = await service.resolveLayers('company-1');

    expect(layers.companyProfile).toBeNull();
    expect(layers.effective.requireTwoFactorForAllUsers).toBe(false);
  });

  it('ignores malformed policy values instead of failing', async () => {
    const service = makeService({
      company: [
        profile({
          policy: {
            twoFactor: { requireForAllUsers: 'yes', requireForRoles: 'ALL' },
          },
        }),
      ],
    });

    const policy = await service.getEffectivePolicy('company-1');

    expect(policy.requireTwoFactorForAllUsers).toBe(false);
    expect(policy.requireTwoFactorForRoles).toEqual([
      'ADMINISTRATOR',
      'SUPER_ADMIN',
    ]);
  });

  it('requires 2FA for a user holding a role the company added', async () => {
    const service = makeService({
      company: [
        profile({
          policy: { twoFactor: { requireForRoles: ['CLAIMS_MANAGER'] } },
        }),
      ],
    });

    const requirement = await service.resolveTwoFactorRequirement(
      {
        is_two_factor_enabled: false,
        user_type: 'STAFF',
        roles: [{ name: 'CLAIMS_MANAGER', permissions: [] }],
        permissions: [],
      } as any,
      'company-1',
    );

    expect(requirement).toMatchObject({ required: true, enrolled: false });
  });
});
