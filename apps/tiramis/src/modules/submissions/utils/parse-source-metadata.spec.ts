import { BadRequestException } from '@nestjs/common';

import {
  parseSourceMetadata,
  requirePortalWebhookUrl,
} from './parse-source-metadata';

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

describe('parseSourceMetadata', () => {
  it('decodes the portal webhook URL from the header', () => {
    const metadata = parseSourceMetadata(
      encode({
        sourceService: 'insurance-portal-service',
        portalWebhookUrl:
          'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
      }),
    );

    expect(metadata?.portalWebhookUrl).toBe(
      'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
    );
  });
});

describe('requirePortalWebhookUrl', () => {
  it('returns the trimmed URL when present', () => {
    expect(
      requirePortalWebhookUrl(
        '  https://portal.example/api/v1/webhooks/tiramis/notifications ',
      ),
    ).toBe('https://portal.example/api/v1/webhooks/tiramis/notifications');
  });

  it.each([undefined, null, '', '   '])(
    'rejects a missing portalWebhookUrl (%p)',
    (value) => {
      expect(() => requirePortalWebhookUrl(value)).toThrow(BadRequestException);
    },
  );

  it.each(['not-a-url', 'ftp://portal.example/hook', '/api/v1/webhooks'])(
    'rejects a non-http(s) portalWebhookUrl (%p)',
    (value) => {
      expect(() => requirePortalWebhookUrl(value)).toThrow(BadRequestException);
    },
  );
});
