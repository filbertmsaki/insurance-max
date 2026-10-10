import { TiramisSystemProfileService } from './tiramis-system-profile.service';

function createService(stored: Record<string, unknown>[] = []) {
  const rows = [...stored];
  const repository = {
    find: jest.fn(async () => rows),
    findOne: jest.fn(
      async ({ where }: any) =>
        rows.find((row: any) => row.environment === where.environment) ?? null,
    ),
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => {
      const index = rows.findIndex(
        (row: any) => row.environment === value.environment,
      );
      if (index >= 0) rows[index] = value;
      else rows.push(value);
      return value;
    }),
  };
  const secretCrypto = {
    encrypt: jest.fn((value: string) => `enc:${value}`),
    decryptIfEncrypted: jest.fn((value: string | null) =>
      value?.startsWith('enc:') ? value.slice(4) : value,
    ),
  };
  const env: Record<string, string> = {
    TIRA_ENV: 'uat',
    TIRA_CLIENT_CODE: 'ENV-CLIENT',
    TIRA_CLIENT_KEY: 'env-key',
    TIRA_SYSTEM_CODE: 'ENV-SYSTEM',
    TIRAMIS_BASE_URL: 'https://tira.env',
    TIRAMIS_CERTIFICATE_BASE_DIR: '/certs',
  };
  const service = new TiramisSystemProfileService(
    repository as any,
    secretCrypto as any,
    { get: (key: string) => env[key] } as any,
  );
  return { service, rows, secretCrypto };
}

describe('TiramisSystemProfileService', () => {
  it('uses the stored platform profile first and environment variables as fallback', async () => {
    const { service } = createService([
      {
        environment: 'uat',
        clientCode: 'PROFILE-CLIENT',
        clientKeyEncrypted: 'enc:profile-key',
        systemCode: null,
      },
    ]);
    await service.refresh();

    const effective = service.getEffective('uat');

    expect(effective).toMatchObject({
      clientCode: 'PROFILE-CLIENT',
      clientKey: 'profile-key',
      systemCode: 'ENV-SYSTEM',
      baseUrl: 'https://tira.env',
      signatureAlgorithm: 'sha1WithRSAEncryption',
    });
    expect(effective.sources).toMatchObject({
      clientCode: 'profile',
      clientKey: 'profile',
      systemCode: 'environment',
      systemName: 'missing',
      signatureAlgorithm: 'default',
    });
    expect(effective.clientCertificatePath.replace(/\\/g, '/')).toBe(
      '/certs/uat/clientprivate.pfx',
    );
  });

  it('stores secrets encrypted, resets validation, and never exposes them', async () => {
    const { service, rows } = createService([
      { environment: 'uat', validationStatus: 'VALID' },
    ]);

    await service.update(
      'uat',
      { clientKey: 'new-key', clientCode: 'PROD-CLIENT' },
      'admin@example.com',
    );

    expect(rows[0]).toMatchObject({
      clientKeyEncrypted: 'enc:new-key',
      clientCode: 'PROD-CLIENT',
      validationStatus: 'NOT_VALIDATED',
      updatedBy: 'admin@example.com',
    });
    const view = service.describe('uat');
    expect(view.clientKeyMasked).toBe('****-key');
    expect(JSON.stringify(view)).not.toContain('new-key');
  });

  it('keeps a stored secret when an update omits it', async () => {
    const { service, rows } = createService([
      { environment: 'uat', clientKeyEncrypted: 'enc:kept' },
    ]);

    await service.update('local', { systemName: 'Platform' }, 'admin');

    expect(rows[0]).toMatchObject({
      clientKeyEncrypted: 'enc:kept',
      systemName: 'Platform',
    });
  });
});
