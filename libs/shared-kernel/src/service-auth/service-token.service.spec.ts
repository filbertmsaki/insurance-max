import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { ServiceTokenService } from './service-token.service';

const ENV: Record<string, string> = {
  SERVICE_AUTH_SECRET: 'a-shared-secret-that-is-long-enough-1234567890',
  SERVICE_AUTH_ISSUER: 'insurance-portal-service',
  SERVICE_AUTH_SUBJECT: 'insurance-portal-service',
  SERVICE_AUTH_AUDIENCE: 'insurance-portal-service',
  SERVICE_AUTH_ALLOWED_ISSUERS: 'tiramis-service, tiramis-service-staging',
  SERVICE_AUTH_TOKEN_EXPIRATION: '60s',
  SERVICE_AUTH_CLOCK_TOLERANCE_SECONDS: '5',
};

describe('ServiceTokenService', () => {
  let service: ServiceTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        ServiceTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              return ENV[key] ?? def;
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              if (!(key in ENV)) throw new Error(`Missing config: ${key}`);
              return ENV[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ServiceTokenService);
  });

  it('issues a token that verifies successfully when the audience matches self', () => {
    const token = service.issue('tiramis-service', ['tiramis:invoke']);

    const payload = service.verify(token);

    expect(payload.iss).toBe('insurance-portal-service');
    expect(payload.aud).toBe('insurance-portal-service');
    expect(payload.scopes).toEqual(['tiramis:invoke']);
  });

  it('rejects tokens issued for a different audience', () => {
    const token = service.issue('some-other-service', ['tiramis:invoke']);

    expect(() => service.verify(token)).toThrow();
  });

  it('rejects tokens signed with a different secret', () => {
    const jwt = new JwtService();
    const forged = jwt.sign(
      { scopes: ['tiramis:invoke'] },
      {
        secret: 'a-completely-different-secret',
        issuer: 'tiramis-service',
        subject: 'tiramis-service',
        audience: 'insurance-portal-service',
        expiresIn: '60s',
      },
    );

    expect(() => service.verify(forged)).toThrow();
  });

  it('rejects tokens from an issuer that is not in the allow-list', () => {
    const jwt = new JwtService();
    const forged = jwt.sign(
      { scopes: ['tiramis:invoke'] },
      {
        secret: ENV.SERVICE_AUTH_SECRET,
        issuer: 'an-untrusted-service',
        subject: 'an-untrusted-service',
        audience: ENV.SERVICE_AUTH_AUDIENCE,
        expiresIn: '60s',
      },
    );

    expect(() => service.verify(forged)).toThrow();
  });

  it('accepts tokens from any issuer in the allow-list', () => {
    const jwt = new JwtService();
    const forged = jwt.sign(
      { scopes: ['tiramis:notify'] },
      {
        secret: ENV.SERVICE_AUTH_SECRET,
        issuer: 'tiramis-service-staging',
        subject: 'tiramis-service-staging',
        audience: ENV.SERVICE_AUTH_AUDIENCE,
        expiresIn: '60s',
      },
    );

    const payload = service.verify(forged);
    expect(payload.iss).toBe('tiramis-service-staging');
  });
});
