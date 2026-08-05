import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';

import type { ServiceTokenPayload } from '@insurance-max/contracts';

@Injectable()
export class ServiceTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issue(targetAudience: string, scopes: string[]): string {
    const secret = this.configService.getOrThrow<string>('SERVICE_AUTH_SECRET');
    const issuer = this.configService.getOrThrow<string>('SERVICE_AUTH_ISSUER');
    const subject = this.configService.getOrThrow<string>(
      'SERVICE_AUTH_SUBJECT',
    );
    const expiresIn = (this.configService.get<string>(
      'SERVICE_AUTH_TOKEN_EXPIRATION',
    ) ?? '60s') as StringValue;

    return this.jwtService.sign(
      { scopes },
      {
        secret,
        issuer,
        subject,
        audience: targetAudience,
        expiresIn,
        jwtid: randomUUID(),
      },
    );
  }

  verify(token: string): ServiceTokenPayload {
    const secret = this.configService.getOrThrow<string>('SERVICE_AUTH_SECRET');
    const audience = this.configService.getOrThrow<string>(
      'SERVICE_AUTH_AUDIENCE',
    );
    const [firstIssuer, ...remainingIssuers] = this.configService
      .getOrThrow<string>('SERVICE_AUTH_ALLOWED_ISSUERS')
      .split(',')
      .map((issuer) => issuer.trim())
      .filter(Boolean);

    if (!firstIssuer) {
      throw new Error('SERVICE_AUTH_ALLOWED_ISSUERS must list at least one issuer');
    }

    const clockTolerance = Number(
      this.configService.get<string>(
        'SERVICE_AUTH_CLOCK_TOLERANCE_SECONDS',
      ) ?? 5,
    );

    return this.jwtService.verify<ServiceTokenPayload>(token, {
      secret,
      audience,
      issuer: [firstIssuer, ...remainingIssuers],
      clockTolerance,
    });
  }
}
